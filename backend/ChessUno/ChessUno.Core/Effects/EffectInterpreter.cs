using System;
using System.Collections.Generic;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Domain.Turn;

namespace ChessUno.Core.Effects;

public class EffectInterpreter
{
    private readonly GameConfig _config;

    public EffectInterpreter(GameConfig config)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
    }

    public TurnState ApplyEffect(TurnState turn, CardInstance card)
    {
        return ApplyEffectKey(turn, card.EffectKey, card);
    }

    public TurnState ApplyEffectKey(TurnState turn, string effectKey, CardInstance? card = null)
    {
        if (!_config.Effects.TryGetValue(effectKey, out var effect))
        {
            throw new InvalidOperationException($"Undefined effectKey '{effectKey}' in configuration.");
        }

        var activeCard = card ?? turn.ActiveCard;

        switch (effect.Type)
        {
            case "PASS_TURN":
                return turn with
                {
                    ActiveCard = activeCard,
                    Phase = TurnPhase.TurnEnded,
                    RemainingMoves = 0,
                    RemainingRevivals = 0,
                    CanSwap = false
                };

            case "MOVE_PIECES":
                return turn with
                {
                    ActiveCard = activeCard,
                    Phase = TurnPhase.ActionPhase,
                    RemainingMoves = effect.MoveCount ?? 1,
                    RemainingRevivals = 0,
                    CanSwap = false
                };

            case "REVIVE_PIECES":
                return turn with
                {
                    ActiveCard = activeCard,
                    Phase = TurnPhase.ActionPhase,
                    RemainingMoves = 0,
                    RemainingRevivals = effect.MaxRevivals ?? 1,
                    CanSwap = false
                };

            case "SWAP_PIECES":
                return turn with
                {
                    ActiveCard = activeCard,
                    Phase = TurnPhase.ActionPhase,
                    RemainingMoves = 0,
                    RemainingRevivals = 0,
                    CanSwap = true
                };

            case "SKIP_TURN":
                return turn with
                {
                    ActiveCard = activeCard,
                    Phase = TurnPhase.TurnEnded,
                    SkipOpponent = true
                };

            case "CHOOSE_EFFECT":
                return turn with
                {
                    ActiveCard = activeCard,
                    Phase = TurnPhase.AwaitingChoice,
                    AvailableChoices = effect.Choices != null ? new List<string>(effect.Choices) : null
                };

            case "SEQUENCE":
                if (effect.Sequence == null || effect.Sequence.Count == 0)
                {
                    return turn with { ActiveCard = activeCard, Phase = TurnPhase.TurnEnded };
                }

                // Step 1: execute first step
                var firstStepKey = effect.Sequence[0];
                var remainingSteps = effect.Sequence.Count > 1
                    ? effect.Sequence.GetRange(1, effect.Sequence.Count - 1)
                    : null;

                var initialStepTurn = ApplyEffectKey(turn, firstStepKey, activeCard);
                return initialStepTurn with
                {
                    PendingSequence = remainingSteps
                };

            default:
                throw new InvalidOperationException($"Unsupported effect type '{effect.Type}'.");
        }
    }
}
