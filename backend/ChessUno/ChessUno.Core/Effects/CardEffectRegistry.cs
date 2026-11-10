using System;
using System.Collections.Generic;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Events;
using ChessUno.Core.GameEngine;

namespace ChessUno.Core.Effects;

public class CardEffectRegistry
{
    private readonly Dictionary<string, ICardEffectHandler> _handlers = new(StringComparer.OrdinalIgnoreCase);

    public CardEffectRegistry()
    {
        RegisterHandler(new MovePiecesEffectHandler());
        RegisterHandler(new RevivePiecesEffectHandler());
        RegisterHandler(new SwapPiecesEffectHandler());
        RegisterHandler(new SkipTurnEffectHandler());
        RegisterHandler(new PassTurnEffectHandler());
        RegisterHandler(new ChooseEffectHandler());
        RegisterHandler(new SequenceEffectHandler());
    }

    public void RegisterHandler(ICardEffectHandler handler)
    {
        if (handler == null) throw new ArgumentNullException(nameof(handler));
        _handlers[handler.EffectType] = handler;
    }

    public bool TryGetHandler(string effectType, out ICardEffectHandler? handler) =>
        _handlers.TryGetValue(effectType, out handler);
}

public class CardEffectExecutor
{
    private readonly GameConfig _config;
    private readonly CardEffectRegistry _registry;
    private readonly IChessEngine _chessEngine;

    public CardEffectExecutor(GameConfig config, CardEffectRegistry registry, IChessEngine chessEngine)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _registry = registry ?? throw new ArgumentNullException(nameof(registry));
        _chessEngine = chessEngine ?? throw new ArgumentNullException(nameof(chessEngine));
    }

    public EffectExecutionResult ExecuteCardEffect(GameState state, PlayerColor player, CardInstance card, long sequenceNumber) =>
        ExecuteEffectKey(state, player, card.EffectKey, sequenceNumber);

    public EffectExecutionResult ExecuteEffectKey(GameState state, PlayerColor player, string effectKey, long sequenceNumber)
    {
        var events = new List<IGameEvent>
        {
            new CardEffectStartedEvent(Guid.NewGuid(), sequenceNumber++, DateTimeOffset.UtcNow, player, effectKey)
        };

        if (!_config.Effects.TryGetValue(effectKey, out var effectDef))
        {
            var failEvent = new CardEffectFailedEvent(Guid.NewGuid(), sequenceNumber++, DateTimeOffset.UtcNow, player, effectKey, $"Unknown effectKey '{effectKey}'.");
            events.Add(failEvent);
            return EffectExecutionResult.Failure(state, events, $"Unknown effectKey '{effectKey}'.");
        }

        if (!_registry.TryGetHandler(effectDef.Type, out var handler) || handler == null)
        {
            var failEvent = new CardEffectFailedEvent(Guid.NewGuid(), sequenceNumber++, DateTimeOffset.UtcNow, player, effectKey, $"No registered handler for effect type '{effectDef.Type}'.");
            events.Add(failEvent);
            return EffectExecutionResult.Failure(state, events, $"No handler for '{effectDef.Type}'.");
        }

        var dummyDef = new CardDefinition("adhoc", effectKey, "ACTION", 1, effectKey, effectDef.Description);
        var dummyCard = new CardInstance(Guid.NewGuid(), dummyDef);
        var context = new EffectExecutionContext(state, player, dummyCard, effectDef, _chessEngine, sequenceNumber);
        try
        {
            var result = handler.Handle(context);
            events.AddRange(result.EmittedEvents);

            if (result.IsSuccess)
            {
                events.Add(new CardEffectResolvedEvent(Guid.NewGuid(), sequenceNumber++, DateTimeOffset.UtcNow, player, effectKey, effectDef.Description));
                return result with { EmittedEvents = events };
            }
            else
            {
                events.Add(new CardEffectFailedEvent(Guid.NewGuid(), sequenceNumber++, DateTimeOffset.UtcNow, player, effectKey, result.ErrorMessage ?? "Execution failed."));
                return result with { EmittedEvents = events };
            }
        }
        catch (Exception ex)
        {
            events.Add(new CardEffectFailedEvent(Guid.NewGuid(), sequenceNumber++, DateTimeOffset.UtcNow, player, effectKey, ex.Message));
            return EffectExecutionResult.Failure(state, events, ex.Message);
        }
    }
}

public class MovePiecesEffectHandler : ICardEffectHandler
{
    public string EffectType => "MOVE_PIECES";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        int moves = context.EffectConfig.MoveCount ?? 1;
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), moves: moves);
    }
}

public class RevivePiecesEffectHandler : ICardEffectHandler
{
    public string EffectType => "REVIVE_PIECES";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        int revivals = context.EffectConfig.MaxRevivals ?? 1;
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), revivals: revivals);
    }
}

public class SwapPiecesEffectHandler : ICardEffectHandler
{
    public string EffectType => "SWAP_PIECES";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), swap: true);
    }
}

public class SkipTurnEffectHandler : ICardEffectHandler
{
    public string EffectType => "SKIP_TURN";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), skip: true);
    }
}

public class PassTurnEffectHandler : ICardEffectHandler
{
    public string EffectType => "PASS_TURN";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), moves: 0);
    }
}

public class ChooseEffectHandler : ICardEffectHandler
{
    public string EffectType => "CHOOSE_EFFECT";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        var choices = context.EffectConfig.Choices != null ? new List<string>(context.EffectConfig.Choices) : null;
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), choice: true, choices: choices);
    }
}

public class SequenceEffectHandler : ICardEffectHandler
{
    public string EffectType => "SEQUENCE";

    public EffectExecutionResult Handle(EffectExecutionContext context)
    {
        var sequence = context.EffectConfig.Sequence != null ? new List<string>(context.EffectConfig.Sequence) : null;
        return EffectExecutionResult.Success(context.CurrentState, Array.Empty<IGameEvent>(), sequence: sequence);
    }
}

