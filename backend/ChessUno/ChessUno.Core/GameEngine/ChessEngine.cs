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

        if (game.IsCheckmated(game.WhoseTurn))
        {
            status = GameStatus.Checkmate;
        }
        else if (game.IsStalemated(game.WhoseTurn))
        {
            status = GameStatus.Stalemate;
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

        var fenParts = fen.Split(' ');
        int halfMoveClock = fenParts.Length > 4 && int.TryParse(fenParts[4], out int hmc) ? hmc : 0;
        int fullMoveNumber = fenParts.Length > 5 && int.TryParse(fenParts[5], out int fmn) ? fmn : 1;

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
            MoveHistory: new List<ChessActionRecord>()
        );
    }

    public IReadOnlyList<ChessMove> GetLegalMoves(GameState state, PlayerColor player)
    {
        var game = new ChessGame(state.Fen);
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
        var game = new ChessGame(state.Fen);
        var cdnPlayer = player == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        var cdnMove = ToChessDotNetMove(move, cdnPlayer);
        return game.IsValidMove(cdnMove);
    }

    public GameState ApplyMove(GameState state, ChessMove move) =>
        ApplyMove(state, move, toggleTurn: true);

    public GameState ApplyMove(GameState state, ChessMove move, bool toggleTurn)
    {
        if (state.Status == GameStatus.Checkmate || state.Status == GameStatus.Stalemate)
        {
            throw new InvalidOperationException($"Cannot make a move in terminal game state '{state.Status}'.");
        }

        var game = new ChessGame(state.Fen);
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

        // Apply move
        var moveType = game.MakeMove(cdnMove, alreadyValidated: true);
        var newFen = game.GetFen();

        if (!toggleTurn)
        {
            // Keep the active player for sequential multi-moves
            newFen = SetFenActivePlayer(newFen, state.ActivePlayer);
            game = new ChessGame(newFen);
        }

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

        var nextPlayer = toggleTurn
            ? (game.WhoseTurn == ChessDotNet.Player.White ? PlayerColor.White : PlayerColor.Black)
            : state.ActivePlayer;

        var inCheck = game.IsInCheck(game.WhoseTurn);
        var newStatus = GameStatus.Active;
        PlayerColor? winner = null;

        if (game.IsCheckmated(game.WhoseTurn))
        {
            newStatus = GameStatus.Checkmate;
            winner = state.ActivePlayer;
        }
        else if (game.IsStalemated(game.WhoseTurn))
        {
            newStatus = GameStatus.Stalemate;
        }
        else if (inCheck)
        {
            newStatus = GameStatus.Check;
        }

        // Parse halfmove and fullmove from new FEN
        var fenParts = newFen.Split(' ');
        int halfMoveClock = fenParts.Length > 4 && int.TryParse(fenParts[4], out int hmc) ? hmc : 0;
        int fullMoveNumber = fenParts.Length > 5 && int.TryParse(fenParts[5], out int fmn) ? fmn : state.FullMoveNumber;

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
            MoveHistory: newHistory
        );
    }

    public GameState ApplyRevival(GameState state, PlayerColor player, PieceType pieceType, Square targetSquare)
    {
        if (state.Status == GameStatus.Checkmate || state.Status == GameStatus.Stalemate)
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

        var inCheck = game.IsInCheck(game.WhoseTurn);
        var status = GameStatus.Active;
        if (game.IsCheckmated(game.WhoseTurn))
        {
            status = GameStatus.Checkmate;
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
            Winner: status == GameStatus.Checkmate ? player : null,
            InCheck: inCheck,
            HalfMoveClock: state.HalfMoveClock,
            FullMoveNumber: state.FullMoveNumber,
            Reserves: newReserves,
            MoveHistory: newHistory
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

    private static string SetFenActivePlayer(string fen, PlayerColor player)
    {
        var parts = fen.Split(' ');
        if (parts.Length > 1)
        {
            parts[1] = player == PlayerColor.White ? "w" : "b";
        }
        // When active player does not change, previous en passant rights expire
        if (parts.Length > 3)
        {
            parts[3] = "-";
        }
        return string.Join(" ", parts);
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
