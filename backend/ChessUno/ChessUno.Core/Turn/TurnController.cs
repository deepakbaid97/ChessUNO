using System;
using System.Collections.Generic;
using System.Linq;
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
using ChessDotNet;

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
        GameState initialGame,
        TurnState? currentTurn = null,
        long sequenceNumber = 1)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _chessEngine = chessEngine ?? throw new ArgumentNullException(nameof(chessEngine));
        _deckManager = deckManager ?? throw new ArgumentNullException(nameof(deckManager));
        _effectExecutor = effectExecutor ?? throw new ArgumentNullException(nameof(effectExecutor));
        _validator = validator ?? throw new ArgumentNullException(nameof(validator));
        ChessState = initialGame ?? throw new ArgumentNullException(nameof(initialGame));
        CurrentTurn = currentTurn ?? TurnState.StartDrawPhase(PlayerColor.White);
        _sequenceNumber = sequenceNumber;
    }

    public void InjectNextCard(CardInstance card)
    {
        _injectedNextCard = card;
    }

    public void StartGame()
    {
        ChessState = ChessState with
        {
            ActivePlayer = PlayerColor.White,
            Fen = ChessEngine.SetFenActivePlayer(ChessState.Fen, PlayerColor.White)
        };
        CurrentTurn = TurnState.StartDrawPhase(PlayerColor.White);
        EmitEvent(new TurnChangedEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, PlayerColor.White, 1));
    }

    public CardInstance DrawCard(PlayerColor player)
    {
        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            throw new InvalidOperationException($"Cannot draw card in terminal game state '{ChessState.Status}'.");
        }

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

        int playerReservesCount = ChessState.Reserves.TryGetValue(player, out var res) ? res.Count : 0;
        bool canEscapeWithRevival = execution.RemainingRevivals > 0 && playerReservesCount > 0;

        // Immediate defeat if in check and drawn card gives 0 moves/escape routes
        if (ChessState.InCheck &&
            execution.RemainingMoves == 0 &&
            !execution.CanSwap &&
            !canEscapeWithRevival &&
            !execution.AwaitingChoice &&
            (execution.PendingSequence == null || execution.PendingSequence.Count == 0))
        {
            ChessState = ChessState with
            {
                Status = GameStatus.Checkmate,
                Winner = player.Opponent()
            };
            CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded };
            return card;
        }

        ApplyExecutionResult(execution, card);
        return card;
    }

    public ActionResult SubmitChoice(PlayerColor player, string choiceEffectKey)
    {
        if (player != ActivePlayer)
        {
            return ActionResult.Failure($"Not player '{player}' turn.");
        }

        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return ActionResult.Failure($"Cannot submit choice in terminal game state '{ChessState.Status}'.");
        }

        if (CurrentTurn.Phase != TurnPhase.AwaitingChoice)
        {
            return ActionResult.Failure("Cannot submit choice outside AwaitingChoice phase.");
        }

        if (CurrentTurn.AvailableChoices == null || !CurrentTurn.AvailableChoices.Contains(choiceEffectKey, StringComparer.OrdinalIgnoreCase))
        {
            return ActionResult.Failure($"Invalid choice '{choiceEffectKey}'.");
        }

        EmitEvent(new EffectChosenEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, player, choiceEffectKey));

        var execution = _effectExecutor.ExecuteEffectKey(ChessState, player, choiceEffectKey, _sequenceNumber++);
        foreach (var evt in execution.EmittedEvents)
        {
            _eventLog.Add(evt);
        }

        if (!execution.IsSuccess)
        {
            return ActionResult.Failure(execution.ErrorMessage ?? "Choice execution failed.");
        }

        ApplyExecutionResult(execution, CurrentTurn.ActiveCard);
        return ActionResult.Success();
    }

    public ActionResult SubmitChessMove(PlayerColor player, ChessMove move)
    {
        if (player != ActivePlayer)
        {
            return ActionResult.Failure($"Not player '{player}' turn.");
        }

        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return ActionResult.Failure($"Cannot move in terminal game state '{ChessState.Status}'.");
        }

        if (CurrentTurn.Phase != TurnPhase.ActionPhase || CurrentTurn.RemainingMoves <= 0)
        {
            return ActionResult.Failure("No remaining chess moves available.");
        }

        try
        {
            bool hasMoreMoves = CurrentTurn.RemainingMoves > 1;
            ChessState = _chessEngine.ApplyMove(ChessState, move, toggleTurn: !hasMoreMoves);

            if (_chessEngine.IsTerminalState(ChessState.Status))
            {
                CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded, RemainingMoves = 0 };
                return ActionResult.Success();
            }

            int remaining = CurrentTurn.RemainingMoves - 1;
            CurrentTurn = CurrentTurn with { RemainingMoves = remaining };

            if (remaining == 0)
            {
                OnActionStepCompleted();
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

        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return ActionResult.Failure($"Cannot revive in terminal game state '{ChessState.Status}'.");
        }

        if (CurrentTurn.Phase != TurnPhase.ActionPhase || CurrentTurn.RemainingRevivals <= 0)
        {
            return ActionResult.Failure("No remaining revivals available.");
        }

        try
        {
            ChessState = _chessEngine.ApplyRevival(ChessState, player, pieceType, targetSquare);

            if (_chessEngine.IsTerminalState(ChessState.Status))
            {
                CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded, RemainingRevivals = 0 };
                return ActionResult.Success();
            }

            int remaining = CurrentTurn.RemainingRevivals - 1;
            CurrentTurn = CurrentTurn with { RemainingRevivals = remaining };

            if (remaining == 0)
            {
                OnActionStepCompleted();
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

        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return ActionResult.Failure($"Cannot swap in terminal game state '{ChessState.Status}'.");
        }

        if (!CurrentTurn.CanSwap)
        {
            return ActionResult.Failure("Swap action is not permitted.");
        }

        try
        {
            ChessState = _chessEngine.ApplySwap(ChessState, player, sq1, sq2);
            CurrentTurn = CurrentTurn with { CanSwap = false };

            if (_chessEngine.IsTerminalState(ChessState.Status))
            {
                CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded };
                return ActionResult.Success();
            }

            OnActionStepCompleted();
            return ActionResult.Success();
        }
        catch (Exception ex)
        {
            return ActionResult.Failure(ex.Message);
        }
    }

    public IReadOnlyList<ChessMove> GetLegalMoves()
    {
        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return Array.Empty<ChessMove>();
        }
        return _chessEngine.GetLegalMoves(ChessState, ActivePlayer);
    }

    public ActionResult Resign(PlayerColor player)
    {
        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return ActionResult.Failure($"Game is already in terminal state '{ChessState.Status}'.");
        }

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

        if (_chessEngine.IsTerminalState(ChessState.Status))
        {
            return ActionResult.Failure($"Cannot end turn in terminal game state '{ChessState.Status}'.");
        }

        if (CurrentTurn.Phase != TurnPhase.ActionPhase)
        {
            return ActionResult.Failure("Cannot end turn outside ActionPhase.");
        }

        // King Safety check: if player's King is in check, they cannot legally end turn! That triggers Checkmate / Defeat.
        var game = new ChessGame(ChessState.Fen);
        var cdnPlayer = player == PlayerColor.White ? ChessDotNet.Player.White : ChessDotNet.Player.Black;
        if (game.IsInCheck(cdnPlayer))
        {
            ChessState = ChessState with
            {
                Status = GameStatus.Checkmate,
                Winner = player.Opponent()
            };
            CurrentTurn = CurrentTurn with { Phase = TurnPhase.TurnEnded };
            return ActionResult.Success();
        }

        // If a pending sequence step remains, advance to the next step
        if (CurrentTurn.PendingSequence != null && CurrentTurn.PendingSequence.Count > 0)
        {
            OnActionStepCompleted();
            return ActionResult.Success();
        }

        EndTurnInternal();
        return ActionResult.Success();
    }

    private void ApplyExecutionResult(EffectExecutionResult execution, CardInstance? card)
    {
        if (execution.SkipOpponent)
        {
            ChessState = ChessState with
            {
                ActivePlayer = ActivePlayer,
                Fen = ChessEngine.SetFenActivePlayer(ChessState.Fen, ActivePlayer)
            };
            CurrentTurn = TurnState.StartDrawPhase(ActivePlayer);
            EmitEvent(new TurnChangedEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, ActivePlayer, ChessState.FullMoveNumber));
            return;
        }

        if (execution.AwaitingChoice)
        {
            CurrentTurn = CurrentTurn with
            {
                Phase = TurnPhase.AwaitingChoice,
                ActiveCard = card,
                AvailableChoices = execution.AvailableChoices
            };
            return;
        }

        if (execution.PendingSequence != null && execution.PendingSequence.Count > 0)
        {
            string firstKey = execution.PendingSequence[0];
            var remaining = execution.PendingSequence.Skip(1).ToList();
            var stepExec = _effectExecutor.ExecuteEffectKey(ChessState, ActivePlayer, firstKey, _sequenceNumber++);
            foreach (var evt in stepExec.EmittedEvents)
            {
                _eventLog.Add(evt);
            }

            CurrentTurn = CurrentTurn with
            {
                Phase = TurnPhase.ActionPhase,
                ActiveCard = card,
                RemainingMoves = stepExec.RemainingMoves,
                RemainingRevivals = stepExec.RemainingRevivals,
                CanSwap = stepExec.CanSwap,
                PendingSequence = remaining
            };
            return;
        }

        CurrentTurn = CurrentTurn with
        {
            Phase = TurnPhase.ActionPhase,
            ActiveCard = card,
            RemainingMoves = execution.RemainingMoves,
            RemainingRevivals = execution.RemainingRevivals,
            CanSwap = execution.CanSwap,
            PendingSequence = execution.PendingSequence
        };

        if (CurrentTurn.RemainingMoves == 0 && !CurrentTurn.CanSwap && CurrentTurn.RemainingRevivals == 0)
        {
            EndTurnInternal();
        }
    }

    private void OnActionStepCompleted()
    {
        if (CurrentTurn.PendingSequence != null && CurrentTurn.PendingSequence.Count > 0)
        {
            string nextKey = CurrentTurn.PendingSequence[0];
            var remaining = CurrentTurn.PendingSequence.Skip(1).ToList();
            var nextExec = _effectExecutor.ExecuteEffectKey(ChessState, ActivePlayer, nextKey, _sequenceNumber++);
            foreach (var evt in nextExec.EmittedEvents)
            {
                _eventLog.Add(evt);
            }

            CurrentTurn = CurrentTurn with
            {
                Phase = TurnPhase.ActionPhase,
                RemainingMoves = nextExec.RemainingMoves,
                RemainingRevivals = nextExec.RemainingRevivals,
                CanSwap = nextExec.CanSwap,
                PendingSequence = remaining
            };
            return;
        }

        EndTurnInternal();
    }

    private void EndTurnInternal()
    {
        var nextPlayer = ActivePlayer.Opponent();
        ChessState = ChessState with
        {
            ActivePlayer = nextPlayer,
            Fen = ChessEngine.SetFenActivePlayer(ChessState.Fen, nextPlayer)
        };
        CurrentTurn = TurnState.StartDrawPhase(nextPlayer);
        EmitEvent(new TurnChangedEvent(Guid.NewGuid(), _sequenceNumber++, DateTimeOffset.UtcNow, nextPlayer, ChessState.FullMoveNumber));
    }

    private void EmitEvent(IGameEvent evt)
    {
        _eventLog.Add(evt);
    }
}
