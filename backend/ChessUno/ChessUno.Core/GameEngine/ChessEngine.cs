using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Domain.Reserves;
using ChessDotNet;
using DomainPiece = ChessUno.Core.Domain.Pieces.Piece;

namespace ChessUno.Core.GameEngine;

public class ChessEngine : IChessEngine
{
    public const string InitialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    public bool IsTerminalState(GameStatus status) =>
        status is GameStatus.Checkmate
               or GameStatus.Stalemate
               or GameStatus.Resigned
               or GameStatus.Timeout
               or GameStatus.DrawByFiftyMoveRule
               or GameStatus.DrawByThreefoldRepetition
               or GameStatus.DrawByInsufficientMaterial;

    public GameState CreateInitialGame(string configVersion = "1.0.0")
    {
        return CreateFromFen(InitialFen, configVersion);
    }

    public GameState CreateFromFen(string fen, string configVersion = "1.0.0")
    {
        var game = new ChessGame(fen);
        var activePlayer = game.WhoseTurn == ChessDotNet.Player.White ? PlayerColor.White : PlayerColor.Black;
        var inCheck = game.IsInCheck(game.WhoseTurn);
        var status = GameStatus.Active;

        var fenParts = fen.Split(' ');
        int halfMoveClock = fenParts.Length > 4 && int.TryParse(fenParts[4], out int hmc) ? hmc : 0;
        int fullMoveNumber = fenParts.Length > 5 && int.TryParse(fenParts[5], out int fmn) ? fmn : 1;

        if (game.IsCheckmated(game.WhoseTurn))
        {
            status = GameStatus.Checkmate;
        }
        else if (game.IsStalemated(game.WhoseTurn))
        {
            status = GameStatus.Stalemate;
        }
        else if (IsInsufficientMaterial(game))
        {
            status = GameStatus.DrawByInsufficientMaterial;
        }
        else if (halfMoveClock >= 100)
        {
            status = GameStatus.DrawByFiftyMoveRule;
        }
        else if (inCheck)
        {
            status = GameStatus.Check;
        }

        var reserves = new Dictionary<PlayerColor, IReadOnlyList<ReservePiece>>
        {
            [PlayerColor.White] = new List<ReservePiece>(),
            [PlayerColor.Black] = new List<ReservePiece>()
        };

        return new GameState(
            GameId: Guid.NewGuid(),
            ConfigVersion: configVersion,
            EventSequenceNumber: 1,
            Fen: game.GetFen(),
            ActivePlayer: activePlayer,
            Status: status,
            Winner: status == GameStatus.Checkmate ? activePlayer.Opponent() : null,
            InCheck: inCheck,
            HalfMoveClock: halfMoveClock,
            FullMoveNumber: fullMoveNumber,
            Reserves: reserves,
            MoveHistory: new List<ChessActionRecord>(),
            InitialFen: game.GetFen()
        );
    }

    public IReadOnlyList<ChessMove> GetLegalMoves(GameState state, PlayerColor player)
    {
        if (IsTerminalState(state.Status) || player != state.ActivePlayer)
        {
            return Array.Empty<ChessMove>();
        }

        var fen = SetFenActivePlayer(state.Fen, player);
        var game = new ChessGame(fen);
        var cdnPlayer = player == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        var validMoves = game.GetValidMoves(cdnPlayer);

        return validMoves.Select(m => new ChessMove(
            From: new Square(m.OriginalPosition.ToString()[0], int.Parse(m.OriginalPosition.ToString().Substring(1))),
            To: new Square(m.NewPosition.ToString()[0], int.Parse(m.NewPosition.ToString().Substring(1))),
            PromotionPiece: m.Promotion.HasValue ? ParsePromotionPiece(m.Promotion.Value) : null
        )).ToList();
    }

    public bool IsLegalMove(GameState state, PlayerColor player, ChessMove move)
    {
        if (IsTerminalState(state.Status) || player != state.ActivePlayer) return false;
        var fen = SetFenActivePlayer(state.Fen, player);
        var game = new ChessGame(fen);
        var cdnPlayer = player == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        var cdnMove = ToChessDotNetMove(move, cdnPlayer);
        return game.IsValidMove(cdnMove);
    }

    public GameState ApplyMove(GameState state, ChessMove move) =>
        ApplyMove(state, move, toggleTurn: true);

    public GameState ApplyMove(GameState state, ChessMove move, bool toggleTurn)
    {
        if (IsTerminalState(state.Status))
        {
            throw new InvalidOperationException($"Cannot make a move in terminal game state '{state.Status}'.");
        }

        var fen = SetFenActivePlayer(state.Fen, state.ActivePlayer);
        var game = new ChessGame(fen);
        var cdnPlayer = state.ActivePlayer == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        var cdnMove = ToChessDotNetMove(move, cdnPlayer);

        if (!game.IsValidMove(cdnMove))
        {
            throw new InvalidOperationException($"Illegal move '{move}' for player '{state.ActivePlayer}' in position '{state.Fen}'.");
        }

        var pieceAtFrom = state.GetPieceAt(move.From);
        var pieceAtTo = state.GetPieceAt(move.To);

        // Check if en passant capture
        PieceType? capturedType = pieceAtTo?.Type;
        if (pieceAtFrom?.Type == PieceType.Pawn && move.From.File != move.To.File && pieceAtTo == null)
        {
            capturedType = PieceType.Pawn; // En passant
        }

        // Apply move in ChessDotNet (this moves the piece and advances whoseTurn to opponent)
        var moveType = game.MakeMove(cdnMove, alreadyValidated: true);
        var newFen = game.GetFen();

        // Right after MakeMove, game.WhoseTurn is the OPPONENT!
        bool opponentCheckmated = game.IsCheckmated(game.WhoseTurn);
        bool opponentStalemated = game.IsStalemated(game.WhoseTurn);
        bool opponentInCheck = game.IsInCheck(game.WhoseTurn);

        // Update reserves (Graveyard style: captured piece goes to original owner's reserve pool)
        var newReserves = CloneReserves(state.Reserves);
        if (capturedType.HasValue && capturedType.Value != PieceType.King)
        {
            var capturedOwner = state.ActivePlayer.Opponent();
            var reserveList = new List<ReservePiece>(newReserves[capturedOwner])
            {
                new ReservePiece(Guid.NewGuid(), capturedType.Value, capturedOwner, state.FullMoveNumber)
            };
            newReserves[capturedOwner] = reserveList;
        }

        // If move captured the king or delivered checkmate, game ends immediately with victory regardless of remaining moves!
        if (capturedType == PieceType.King || opponentCheckmated)
        {
            var fenPartsImmediate = newFen.Split(' ');
            int hmcImmediate = fenPartsImmediate.Length > 4 && int.TryParse(fenPartsImmediate[4], out int hmc1) ? hmc1 : 0;
            int fmnImmediate = fenPartsImmediate.Length > 5 && int.TryParse(fenPartsImmediate[5], out int fmn1) ? fmn1 : state.FullMoveNumber;

            var actionTypeImmediate = DetermineActionType(moveType, capturedType.HasValue, move.PromotionPiece.HasValue);
            var recordImmediate = new ChessActionRecord(
                ActionNumber: state.MoveHistory.Count + 1,
                Player: state.ActivePlayer,
                ActionType: actionTypeImmediate,
                FromSquare: move.From,
                ToSquare: move.To,
                PieceType: pieceAtFrom?.Type ?? PieceType.Pawn,
                CapturedPieceType: capturedType,
                FenAfter: newFen,
                UciNotation: move.ToString(),
                Timestamp: DateTimeOffset.UtcNow
            );

            return new GameState(
                GameId: state.GameId,
                ConfigVersion: state.ConfigVersion,
                EventSequenceNumber: state.EventSequenceNumber + 1,
                Fen: newFen,
                ActivePlayer: state.ActivePlayer.Opponent(),
                Status: GameStatus.Checkmate,
                Winner: state.ActivePlayer,
                InCheck: true,
                HalfMoveClock: hmcImmediate,
                FullMoveNumber: fmnImmediate,
                Reserves: newReserves,
                MoveHistory: new List<ChessActionRecord>(state.MoveHistory) { recordImmediate },
                InitialFen: state.InitialFen ?? state.Fen
            );
        }

        if (!toggleTurn)
        {
            // Keep the active player for sequential multi-moves
            newFen = SetFenActivePlayer(newFen, state.ActivePlayer);
            game = new ChessGame(newFen);
        }

        var nextPlayer = toggleTurn
            ? (game.WhoseTurn == ChessDotNet.Player.White ? PlayerColor.White : PlayerColor.Black)
            : state.ActivePlayer;

        var inCheck = toggleTurn ? opponentInCheck : opponentInCheck;
        var newStatus = GameStatus.Active;
        PlayerColor? winner = null;

        var fenParts = newFen.Split(' ');
        int halfMoveClock = fenParts.Length > 4 && int.TryParse(fenParts[4], out int hmc) ? hmc : 0;
        int fullMoveNumber = fenParts.Length > 5 && int.TryParse(fenParts[5], out int fmn) ? fmn : state.FullMoveNumber;

        if (toggleTurn)
        {
            if (opponentStalemated)
            {
                newStatus = GameStatus.Stalemate;
            }
            else if (halfMoveClock >= 100)
            {
                newStatus = GameStatus.DrawByFiftyMoveRule;
            }
            else if (IsInsufficientMaterial(game))
            {
                newStatus = GameStatus.DrawByInsufficientMaterial;
            }
            else if (IsThreefoldRepetition(state.MoveHistory, newFen, state.InitialFen ?? state.Fen))
            {
                newStatus = GameStatus.DrawByThreefoldRepetition;
            }
            else if (inCheck)
            {
                newStatus = GameStatus.Check;
            }
        }
        else
        {
            if (inCheck)
            {
                newStatus = GameStatus.Check;
            }
        }

        var actionType = DetermineActionType(moveType, capturedType.HasValue, move.PromotionPiece.HasValue);
        var record = new ChessActionRecord(
            ActionNumber: state.MoveHistory.Count + 1,
            Player: state.ActivePlayer,
            ActionType: actionType,
            FromSquare: move.From,
            ToSquare: move.To,
            PieceType: pieceAtFrom?.Type ?? PieceType.Pawn,
            CapturedPieceType: capturedType,
            FenAfter: newFen,
            UciNotation: move.ToString(),
            Timestamp: DateTimeOffset.UtcNow
        );

        var newHistory = new List<ChessActionRecord>(state.MoveHistory) { record };

        return new GameState(
            GameId: state.GameId,
            ConfigVersion: state.ConfigVersion,
            EventSequenceNumber: state.EventSequenceNumber + 1,
            Fen: newFen,
            ActivePlayer: nextPlayer,
            Status: newStatus,
            Winner: winner,
            InCheck: inCheck,
            HalfMoveClock: halfMoveClock,
            FullMoveNumber: fullMoveNumber,
            Reserves: newReserves,
            MoveHistory: newHistory,
            InitialFen: state.InitialFen ?? state.Fen
        );
    }

    public GameState ApplyRevival(GameState state, PlayerColor player, PieceType pieceType, Square targetSquare)
    {
        if (IsTerminalState(state.Status))
        {
            throw new InvalidOperationException($"Cannot revive pieces in terminal game state '{state.Status}'.");
        }

        if (player != state.ActivePlayer)
        {
            throw new InvalidOperationException($"Player '{player}' cannot revive out of turn (Active player: '{state.ActivePlayer}').");
        }

        if (pieceType == PieceType.King)
        {
            throw new InvalidOperationException("King can never be revived.");
        }

        // 1. Verify piece in player's reserve
        var playerReserve = state.Reserves[player];
        var pieceToRevive = playerReserve.FirstOrDefault(p => p.PieceType == pieceType);
        if (pieceToRevive == null)
        {
            throw new InvalidOperationException($"Player '{player}' does not have a '{pieceType}' in their reserve pool.");
        }

        // 2. Verify target square is in player's half
        bool inOwnHalf = player == PlayerColor.White ? targetSquare.Rank <= 4 : targetSquare.Rank >= 5;
        if (!inOwnHalf)
        {
            throw new InvalidOperationException($"Revival square '{targetSquare}' must be in player's own half of the board.");
        }

        // 3. Pawn placement restriction: cannot place pawn on rank 1 or 8
        if (pieceType == PieceType.Pawn && (targetSquare.Rank == 1 || targetSquare.Rank == 8))
        {
            throw new InvalidOperationException($"Pawn cannot be revived on rank '{targetSquare.Rank}'.");
        }

        // 4. Verify target square is unoccupied
        if (state.GetPieceAt(targetSquare) != null)
        {
            throw new InvalidOperationException($"Square '{targetSquare}' is already occupied.");
        }

        // 5. Construct new FEN with the revived piece placed
        string newFen = PlacePieceOnFen(state.Fen, targetSquare, new DomainPiece(pieceType, player));

        // 6. Verify king safety: reviving piece must NOT leave own king in check
        var game = new ChessGame(newFen);
        var cdnPlayer = player == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        if (game.IsInCheck(cdnPlayer))
        {
            throw new InvalidOperationException($"Revival on square '{targetSquare}' leaves player's King in check.");
        }

        // 7. Update reserve: remove revived piece from pool
        var newReserves = CloneReserves(state.Reserves);
        var updatedList = new List<ReservePiece>(newReserves[player]);
        updatedList.Remove(pieceToRevive);
        newReserves[player] = updatedList;

        var cdnOpponent = player == PlayerColor.White ? ChessDotNet.Player.Black : ChessDotNet.Player.White;
        var inCheck = game.IsInCheck(cdnOpponent);
        var status = GameStatus.Active;
        PlayerColor? winner = null;

        if (game.IsCheckmated(cdnOpponent))
        {
            status = GameStatus.Checkmate;
            winner = player;
        }
        else if (inCheck)
        {
            status = GameStatus.Check;
        }

        var record = new ChessActionRecord(
            ActionNumber: state.MoveHistory.Count + 1,
            Player: player,
            ActionType: ChessActionType.Revival,
            FromSquare: null,
            ToSquare: targetSquare,
            PieceType: pieceType,
            CapturedPieceType: null,
            FenAfter: newFen,
            UciNotation: $"@{targetSquare}={pieceType}",
            Timestamp: DateTimeOffset.UtcNow
        );

        var newHistory = new List<ChessActionRecord>(state.MoveHistory) { record };

        return new GameState(
            GameId: state.GameId,
            ConfigVersion: state.ConfigVersion,
            EventSequenceNumber: state.EventSequenceNumber + 1,
            Fen: newFen,
            ActivePlayer: state.ActivePlayer,
            Status: status,
            Winner: winner,
            InCheck: inCheck,
            HalfMoveClock: state.HalfMoveClock,
            FullMoveNumber: state.FullMoveNumber,
            Reserves: newReserves,
            MoveHistory: newHistory,
            InitialFen: state.InitialFen ?? state.Fen
        );
    }

    public GameState ApplySwap(GameState state, PlayerColor player, Square sq1, Square sq2)
    {
        if (IsTerminalState(state.Status))
        {
            throw new InvalidOperationException($"Cannot swap pieces in terminal game state '{state.Status}'.");
        }

        if (player != state.ActivePlayer)
        {
            throw new InvalidOperationException($"Player '{player}' cannot swap out of turn (Active player: '{state.ActivePlayer}').");
        }

        if (sq1.Equals(sq2))
        {
            throw new InvalidOperationException("Cannot swap a square with itself.");
        }

        var p1 = state.GetPieceAt(sq1);
        var p2 = state.GetPieceAt(sq2);

        if (p1 == null || p2 == null)
        {
            throw new InvalidOperationException("Both squares must contain pieces to swap.");
        }

        if (p1.Color != player || p2.Color != player)
        {
            throw new InvalidOperationException("Can only swap friendly pieces.");
        }

        if (p1.Type == PieceType.King || p2.Type == PieceType.King)
        {
            throw new InvalidOperationException("King cannot be swapped.");
        }

        // Perform swap on FEN
        string newFen = SwapPiecesOnFen(state.Fen, sq1, p1, sq2, p2);
        newFen = UpdateCastlingRightsAfterSwap(newFen, sq1, sq2);
        newFen = ClearEnPassant(newFen);

        // Verify King Safety: Swapping must NOT leave own King in check
        var game = new ChessGame(newFen);
        var cdnPlayer = player == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        if (game.IsInCheck(cdnPlayer))
        {
            throw new InvalidOperationException("Swap leaves player's King in check.");
        }

        // Check if swap puts opponent in check or checkmate
        var cdnOpponent = player == PlayerColor.White ? ChessDotNet.Player.Black : ChessDotNet.Player.White;
        var inCheck = game.IsInCheck(cdnOpponent);
        var status = GameStatus.Active;
        PlayerColor? winner = null;

        if (game.IsCheckmated(cdnOpponent))
        {
            status = GameStatus.Checkmate;
            winner = player;
        }
        else if (inCheck)
        {
            status = GameStatus.Check;
        }

        var record = new ChessActionRecord(
            ActionNumber: state.MoveHistory.Count + 1,
            Player: player,
            ActionType: ChessActionType.Swap,
            FromSquare: sq1,
            ToSquare: sq2,
            PieceType: p1.Type,
            CapturedPieceType: null,
            FenAfter: newFen,
            UciNotation: $"{sq1}<->{sq2}",
            Timestamp: DateTimeOffset.UtcNow
        );

        var newHistory = new List<ChessActionRecord>(state.MoveHistory) { record };

        return new GameState(
            GameId: state.GameId,
            ConfigVersion: state.ConfigVersion,
            EventSequenceNumber: state.EventSequenceNumber + 1,
            Fen: newFen,
            ActivePlayer: state.ActivePlayer,
            Status: status,
            Winner: winner,
            InCheck: inCheck,
            HalfMoveClock: state.HalfMoveClock + 1,
            FullMoveNumber: state.FullMoveNumber,
            Reserves: CloneReserves(state.Reserves),
            MoveHistory: newHistory,
            InitialFen: state.InitialFen ?? state.Fen
        );
    }

    public string Serialize(GameState state)
    {
        return JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true });
    }

    public GameState Deserialize(string json)
    {
        return JsonSerializer.Deserialize<GameState>(json)
            ?? throw new InvalidOperationException("Failed to deserialize GameState from JSON.");
    }

    public static string SetFenActivePlayer(string fen, PlayerColor player)
    {
        var parts = fen.Split(' ');
        if (parts.Length > 1)
        {
            parts[1] = player == PlayerColor.White ? "w" : "b";
        }
        if (parts.Length > 3 && parts[3] != "-")
        {
            char epRank = parts[3].Length > 1 ? parts[3][1] : ' ';
            bool validForWhite = player == PlayerColor.White && epRank == '6';
            bool validForBlack = player == PlayerColor.Black && epRank == '3';
            if (!validForWhite && !validForBlack)
            {
                parts[3] = "-";
            }
        }
        return string.Join(" ", parts);
    }

    private static string ClearEnPassant(string fen)
    {
        var parts = fen.Split(' ');
        if (parts.Length > 3)
        {
            parts[3] = "-";
        }
        return string.Join(" ", parts);
    }

    private static string UpdateCastlingRightsAfterSwap(string fen, Square sq1, Square sq2)
    {
        var parts = fen.Split(' ');
        if (parts.Length <= 2 || parts[2] == "-") return fen;

        var castling = parts[2];
        if (sq1.ToString() == "a1" || sq2.ToString() == "a1") castling = castling.Replace("Q", "");
        if (sq1.ToString() == "h1" || sq2.ToString() == "h1") castling = castling.Replace("K", "");
        if (sq1.ToString() == "a8" || sq2.ToString() == "a8") castling = castling.Replace("q", "");
        if (sq1.ToString() == "h8" || sq2.ToString() == "h8") castling = castling.Replace("k", "");

        if (string.IsNullOrEmpty(castling)) castling = "-";
        parts[2] = castling;
        return string.Join(" ", parts);
    }

    private static string SwapPiecesOnFen(string fen, Square sq1, DomainPiece p1, Square sq2, DomainPiece p2)
    {
        var intermediate = PlacePieceOnFen(fen, sq1, p2);
        return PlacePieceOnFen(intermediate, sq2, p1);
    }

    private static bool IsThreefoldRepetition(IReadOnlyList<ChessActionRecord> history, string currentFen, string? initialFen)
    {
        if (history == null || history.Count < 4) return false;

        string GetPositionKey(string fen)
        {
            var p = fen.Split(' ');
            return p.Length >= 4 ? $"{p[0]} {p[1]} {p[2]} {p[3]}" : fen;
        }

        var targetKey = GetPositionKey(currentFen);
        int occurrences = 1; // currentFen counts as 1

        if (!string.IsNullOrEmpty(initialFen) && GetPositionKey(initialFen) == targetKey)
        {
            occurrences++;
        }

        foreach (var record in history)
        {
            if (GetPositionKey(record.FenAfter) == targetKey)
            {
                occurrences++;
                if (occurrences >= 3) return true;
            }
        }

        return occurrences >= 3;
    }

    private static bool IsInsufficientMaterial(ChessGame game)
    {
        // Insufficient material check:
        // Bare Kings, King + Knight vs King, King + Bishop vs King, King + Bishop vs King + Bishop (same color squares)
        var board = game.GetBoard();
        var whitePieces = new List<(ChessDotNet.Piece Piece, int Rank, int File)>();
        var blackPieces = new List<(ChessDotNet.Piece Piece, int Rank, int File)>();

        for (int rank = 0; rank < 8; rank++)
        {
            for (int file = 0; file < 8; file++)
            {
                var piece = board[rank][file];
                if (piece != null)
                {
                    if (piece.Owner == ChessDotNet.Player.White)
                        whitePieces.Add((piece, rank, file));
                    else
                        blackPieces.Add((piece, rank, file));
                }
            }
        }

        var whiteNonKing = whitePieces.Where(p => !(p.Piece is ChessDotNet.Pieces.King)).ToList();
        var blackNonKing = blackPieces.Where(p => !(p.Piece is ChessDotNet.Pieces.King)).ToList();

        // 1. King vs King
        if (whiteNonKing.Count == 0 && blackNonKing.Count == 0) return true;

        // 2. King + minor piece (Bishop or Knight) vs King
        if (whiteNonKing.Count == 1 && blackNonKing.Count == 0)
        {
            var p = whiteNonKing[0].Piece;
            if (p is ChessDotNet.Pieces.Bishop || p is ChessDotNet.Pieces.Knight) return true;
        }
        if (blackNonKing.Count == 1 && whiteNonKing.Count == 0)
        {
            var p = blackNonKing[0].Piece;
            if (p is ChessDotNet.Pieces.Bishop || p is ChessDotNet.Pieces.Knight) return true;
        }

        // 3. King + Bishop vs King + Bishop on same color squares
        if (whiteNonKing.Count == 1 && blackNonKing.Count == 1)
        {
            var wp = whiteNonKing[0];
            var bp = blackNonKing[0];
            if (wp.Piece is ChessDotNet.Pieces.Bishop && bp.Piece is ChessDotNet.Pieces.Bishop)
            {
                bool whiteSquareColor = (wp.Rank + wp.File) % 2 == 0;
                bool blackSquareColor = (bp.Rank + bp.File) % 2 == 0;
                if (whiteSquareColor == blackSquareColor) return true;
            }
        }

        return false;
    }

    private static ChessDotNet.Move ToChessDotNetMove(ChessMove move, ChessDotNet.Player player)
    {
        var origPos = new ChessDotNet.Position(move.From.ToString());
        var newPos = new ChessDotNet.Position(move.To.ToString());
        char? promo = move.PromotionPiece.HasValue ? ToPromoChar(move.PromotionPiece.Value) : null;
        return new ChessDotNet.Move(origPos, newPos, player, promo);
    }

    private static char ToPromoChar(PieceType type) => type switch
    {
        PieceType.Queen => 'Q',
        PieceType.Rook => 'R',
        PieceType.Bishop => 'B',
        PieceType.Knight => 'N',
        _ => 'Q'
    };

    private static PieceType ParsePromotionPiece(char c) => char.ToUpperInvariant(c) switch
    {
        'Q' => PieceType.Queen,
        'R' => PieceType.Rook,
        'B' => PieceType.Bishop,
        'N' => PieceType.Knight,
        _ => PieceType.Queen
    };

    private static ChessActionType DetermineActionType(MoveType moveType, bool isCapture, bool isPromotion)
    {
        if (moveType.HasFlag(MoveType.Castling)) return ChessActionType.Castling;
        if (moveType.HasFlag(MoveType.EnPassant)) return ChessActionType.EnPassant;
        if (isPromotion) return ChessActionType.PawnPromotion;
        if (isCapture) return ChessActionType.Capture;
        return ChessActionType.StandardMove;
    }

    private static Dictionary<PlayerColor, IReadOnlyList<ReservePiece>> CloneReserves(IReadOnlyDictionary<PlayerColor, IReadOnlyList<ReservePiece>> original)
    {
        return new Dictionary<PlayerColor, IReadOnlyList<ReservePiece>>
        {
            [PlayerColor.White] = new List<ReservePiece>(original[PlayerColor.White]),
            [PlayerColor.Black] = new List<ReservePiece>(original[PlayerColor.Black])
        };
    }

    private static string PlacePieceOnFen(string fen, Square square, DomainPiece piece)
    {
        var parts = fen.Split(' ');
        var ranks = parts[0].Split('/');

        int rankIndex = 8 - square.Rank;
        string rankStr = ranks[rankIndex];

        // Expand rank digits into dots
        var expanded = new System.Text.StringBuilder();
        foreach (char c in rankStr)
        {
            if (char.IsDigit(c))
                expanded.Append(new string('.', c - '0'));
            else
                expanded.Append(c);
        }

        int fileIndex = square.File - 'a';
        expanded[fileIndex] = piece.ToChar();

        // Compress back into FEN notation
        var compressed = new System.Text.StringBuilder();
        int emptyCount = 0;
        foreach (char c in expanded.ToString())
        {
            if (c == '.')
            {
                emptyCount++;
            }
            else
            {
                if (emptyCount > 0)
                {
                    compressed.Append(emptyCount);
                    emptyCount = 0;
                }
                compressed.Append(c);
            }
        }
        if (emptyCount > 0)
        {
            compressed.Append(emptyCount);
        }

        ranks[rankIndex] = compressed.ToString();
        parts[0] = string.Join("/", ranks);
        return string.Join(" ", parts);
    }
}
