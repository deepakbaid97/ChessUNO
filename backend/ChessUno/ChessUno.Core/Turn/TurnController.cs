using System;
using System.Collections.Generic;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Decks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Domain.Turn;
using ChessUno.Core.Effects;
using ChessUno.Core.Events;
using ChessUno.Core.GameEngine;
using ChessUno.Core.Validation;

namespace ChessUno.Core.Turn;

public record ActionResult(bool IsSuccess, string? Error = null)
{
    public static ActionResult Success() => new(true);
    public static ActionResult Failure(string error) => new(false, error);
}

public class TurnController
{
    private readonly GameConfig _config;
    private readonly IChessEngine _chessEngine;
    private readonly IDeckManager _deckManager;
    private readonly CardEffectExecutor _effectExecutor;
    private readonly ICardValidator _validator;

    private readonly List<IGameEvent> _eventLog = new();
    private long _sequenceNumber = 1;
    private CardInstance? _injectedNextCard;

    public GameState ChessState { get; private set; }
    public IDeckManager DeckManager => _deckManager;
    public TurnState CurrentTurn { get; private set; }
    public IReadOnlyList<IGameEvent> EventLog => _eventLog.AsReadOnly();
    public PlayerColor ActivePlayer => CurrentTurn.ActivePlayer;

    public TurnController(
        GameConfig config,
        IChessEngine chessEngine,
        IDeckManager deckManager,
        CardEffectExecutor effectExecutor,
        ICardValidator validator,
        GameState initialGame)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _chessEngine = chessEngine ?? throw new ArgumentNullException(nameof(chessEngine));
        _deckManager = deckManager ?? throw new ArgumentNullException(nameof(deckManager));
        _effectExecutor = effectExecutor ?? throw new ArgumentNullException(nameof(effectExecutor));
        _validator = validator ?? throw new ArgumentNullException(nameof(validator));
        ChessState = initialGame ?? throw new ArgumentNullException(nameof(initialGame));
        CurrentTurn = TurnState.StartDrawPhase(PlayerColor.White);
    }

    public void InjectNextCard(CardInstance card)
    {
        _injectedNextCard = card;
    }

    public void StartGame()
    {
        CurrentTurn = TurnState.StartDrawPhase(PlayerColor.White);
        EmitEvent(new TurnChangedEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, PlayerColor.White, 1));
    }

    public CardInstance DrawCard(PlayerColor player)
    {
        if (player != ActivePlayer)
        {
            throw new InvalidOperationException($"Cannot draw out of turn. Active player is {ActivePlayer}.");
        }

        if (CurrentTurn.Phase != TurnPhase.DrawPhase)
        {
            throw new InvalidOperationException($"Cannot draw card during '{CurrentTurn.Phase}'. Expected 'DrawPhase'.");
        }

        CardInstance card;
        if (_injectedNextCard != null)
        {
            card = _injectedNextCard;
            _injectedNextCard = null;
            if (_deckManager.RemainingCount > 0)
            {
                _deckManager.Draw();
            }
        }
        else
        {
            card = _deckManager.Draw();
        }

        _deckManager.Discard(card);
        EmitEvent(new CardDrawnEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, player, card.InstanceId, card.Id, card.Name));

        // Evaluate Card Execution
        var execution = _effectExecutor.ExecuteCardEffect(ChessState, player, card, _sequenceNumber++);
        foreach (var evt in execution.EmittedEvents)
        {
            _eventLog.Add(evt);
        }

        if (!execution.IsSuccess)
        {
            throw new InvalidOperationException($"Card effect failed: {execution.ErrorMessage}");
        }

        // Check Decision A2: Immediate defeat if in check and drawn card gives 0 moves/escape
        if (ChessState.InCheck && execution.RemainingMoves == 0 && !execution.CanSwap && execution.RemainingRevivals == 0)
        {
            ChessState = ChessState with
            {
                Status = GameStatus.Checkmate,
                Winner = player.Opponent()
            };
            CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded };
            return card;
        }

        // Apply new TurnState
        if (execution.SkipOpponent)
        {
            // Skip opponent: active player draws again for a new turn!
            CurrentTurn = TurnState.StartDrawPhase(player);
            EmitEvent(new TurnChangedEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, player, ChessState.FullMoveNumber));
        }
        else if (execution.AwaitingChoice)
        {
            CurrentTurn = CurrentTurn with
            {
                Phase = TurnPhase.AwaitingChoice,
                ActiveCard = card,
                AvailableChoices = execution.AvailableChoices
            };
        }
        else
        {
            CurrentTurn = CurrentTurn with
            {
                Phase = TurnPhase.ActionPhase,
                ActiveCard = card,
                RemainingMoves = execution.RemainingMoves,
                RemainingRevivals = execution.RemainingRevivals,
                CanSwap = execution.CanSwap,
                PendingSequence = execution.PendingSequence
            };

            // If 0 moves and no actions, pass turn
            if (CurrentTurn.RemainingMoves == 0 && !CurrentTurn.CanSwap && CurrentTurn.RemainingRevivals == 0)
            {
                EndTurnInternal();
            }
        }

        return card;
    }

    public ActionResult SubmitChessMove(PlayerColor player, ChessMove move)
    {
        if (player != ActivePlayer)
        {
            return ActionResult.Failure($"Not player '{player}' turn.");
        }

        if (CurrentTurn.Phase != TurnPhase.ActionPhase || CurrentTurn.RemainingMoves <= 0)
        {
            return ActionResult.Failure("No remaining chess moves available.");
        }

        try
        {
            bool hasMoreMoves = CurrentTurn.RemainingMoves > 1;
            // When more moves remain on the card, keep turn initiative for sequential multi-moves
            ChessState = _chessEngine.ApplyMove(ChessState, move, toggleTurn: !hasMoreMoves);

            int remaining = CurrentTurn.RemainingMoves - 1;
            CurrentTurn = CurrentTurn with { RemainingMoves = remaining };

            if (remaining == 0)
            {
                // Move quota completed
                EndTurnInternal();
            }

            return ActionResult.Success();
        }
        catch (Exception ex)
        {
            return ActionResult.Failure(ex.Message);
        }
    }

    public ActionResult SubmitRevival(PlayerColor player, PieceType pieceType, Square targetSquare)
    {
        if (player != ActivePlayer)
        {
            return ActionResult.Failure($"Not player '{player}' turn.");
        }

        if (CurrentTurn.Phase != TurnPhase.ActionPhase || CurrentTurn.RemainingRevivals <= 0)
        {
            return ActionResult.Failure("No remaining revivals available.");
        }

        try
        {
            ChessState = _chessEngine.ApplyRevival(ChessState, player, pieceType, targetSquare);
            int remaining = CurrentTurn.RemainingRevivals - 1;
            CurrentTurn = CurrentTurn with { RemainingRevivals = remaining };

            if (remaining == 0)
            {
                EndTurnInternal();
            }

            return ActionResult.Success();
        }
        catch (Exception ex)
        {
            return ActionResult.Failure(ex.Message);
        }
    }

    public ActionResult SubmitSwap(PlayerColor player, Square sq1, Square sq2)
    {
        if (player != ActivePlayer)
        {
            return ActionResult.Failure($"Not player '{player}' turn.");
        }

        if (!CurrentTurn.CanSwap)
        {
            return ActionResult.Failure("Swap action is not permitted.");
        }

        var p1 = ChessState.GetPieceAt(sq1);
        var p2 = ChessState.GetPieceAt(sq2);

        if (p1 == null || p2 == null)
        {
            return ActionResult.Failure("Both squares must contain pieces to swap.");
        }

        if (p1.Color != player || p2.Color != player)
        {
            return ActionResult.Failure("Can only swap friendly pieces.");
        }

        if (p1.Type == PieceType.King || p2.Type == PieceType.King)
        {
            return ActionResult.Failure("Cannot swap Kings.");
        }

        // Perform swap by updating FEN
        string fenAfterSwap = SwapPiecesOnFen(ChessState.Fen, sq1, p1, sq2, p2);
        ChessState = ChessState with { Fen = fenAfterSwap };

        CurrentTurn = CurrentTurn with { CanSwap = false };
        EndTurnInternal();
        return ActionResult.Success();
    }

    public IReadOnlyList<ChessMove> GetLegalMoves()
    {
        return _chessEngine.GetLegalMoves(ChessState, ActivePlayer);
    }

    public ActionResult Resign(PlayerColor player)
    {
        ChessState = ChessState with
        {
            Status = GameStatus.Resigned,
            Winner = player.Opponent()
        };
        CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded };
        return ActionResult.Success();
    }

    public ActionResult EndTurn(PlayerColor player)
    {
        if (player != ActivePlayer)
        {
            return ActionResult.Failure($"Not player '{player}' turn.");
        }
        if (CurrentTurn.Phase != TurnPhase.ActionPhase)
        {
            return ActionResult.Failure("Cannot end turn outside ActionPhase.");
        }
        EndTurnInternal();
        return ActionResult.Success();
    }

    private void EndTurnInternal()
    {
        var nextPlayer = ActivePlayer.Opponent();
        CurrentTurn = TurnState.StartDrawPhase(nextPlayer);
        EmitEvent(new TurnChangedEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, nextPlayer, ChessState.FullMoveNumber));
    }

    private void EmitEvent(IGameEvent evt)
    {
        _eventLog.Add(evt);
    }

    private static string SwapPiecesOnFen(string fen, Square sq1, Domain.Pieces.Piece p1, Square sq2, Domain.Pieces.Piece p2)
    {
        // First place p2 on sq1
        var intermediate = PlacePiece(fen, sq1, p2);
        // Then place p1 on sq2
        return PlacePiece(intermediate, sq2, p1);
    }

    private static string PlacePiece(string fen, Square square, Domain.Pieces.Piece piece)
    {
        var parts = fen.Split(' ');
        var ranks = parts[0].Split('/');

        int rankIndex = 8 - square.Rank;
        string rankStr = ranks[rankIndex];

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

