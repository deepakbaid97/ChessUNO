using System;
using System.Collections.Generic;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Events;
using ChessUno.Core.GameEngine;

namespace ChessUno.Core.Effects;

public record EffectExecutionContext(
    GameState CurrentState,
    PlayerColor Player,
    CardInstance Card,
    EffectDefinitionConfig EffectConfig,
    IChessEngine ChessEngine,
    long SequenceNumber
);

public record EffectExecutionResult(
    bool IsSuccess,
    GameState ResultState,
    IReadOnlyList<IGameEvent> EmittedEvents,
    string? ErrorMessage = null,
    int RemainingMoves = 0,
    int RemainingRevivals = 0,
    bool CanSwap = false,
    bool SkipOpponent = false,
    bool AwaitingChoice = false,
    IReadOnlyList<string>? AvailableChoices = null,
    IReadOnlyList<string>? PendingSequence = null
)
{
    public static EffectExecutionResult Success(
        GameState state,
        IEnumerable<IGameEvent> events,
        int moves = 0,
        int revivals = 0,
        bool swap = false,
        bool skip = false,
        bool choice = false,
        IReadOnlyList<string>? choices = null,
        IReadOnlyList<string>? sequence = null) =>
        new(
            IsSuccess: true,
            ResultState: state,
            EmittedEvents: new List<IGameEvent>(events),
            RemainingMoves: moves,
            RemainingRevivals: revivals,
            CanSwap: swap,
            SkipOpponent: skip,
            AwaitingChoice: choice,
            AvailableChoices: choices,
            PendingSequence: sequence
        );

    public static EffectExecutionResult Failure(GameState state, IEnumerable<IGameEvent> events, string error) =>
        new(
            IsSuccess: false,
            ResultState: state,
            EmittedEvents: new List<IGameEvent>(events),
            ErrorMessage: error
        );
}

public interface ICardEffectHandler
{
    string EffectType { get; }
    EffectExecutionResult Handle(EffectExecutionContext context);
}

