using System;
using ChessUno.Core.Domain.Common;

namespace ChessUno.Core.Events;

public interface IGameEvent
{
    Guid EventId { get; }
    long SequenceNumber { get; }
    DateTimeOffset Timestamp { get; }
    string EventType { get; }
}

public abstract record BaseGameEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    string EventType
) : IGameEvent;

public record CardDrawnEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor Player,
    Guid CardInstanceId,
    string CardId,
    string CardName
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(CardDrawnEvent));

public record CardPlayedEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor Player,
    Guid CardInstanceId,
    string CardId,
    string EffectKey
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(CardPlayedEvent));

public record CardEffectStartedEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor Player,
    string EffectKey
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(CardEffectStartedEvent));

public record CardEffectResolvedEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor Player,
    string EffectKey,
    string Summary
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(CardEffectResolvedEvent));

public record CardEffectFailedEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor Player,
    string EffectKey,
    string Reason
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(CardEffectFailedEvent));

public record EffectChosenEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor Player,
    string ChosenEffectKey
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(EffectChosenEvent));

public record TurnChangedEvent(
    Guid EventId,
    long SequenceNumber,
    DateTimeOffset Timestamp,
    PlayerColor NewPlayer,
    int TurnNumber
) : BaseGameEvent(EventId, SequenceNumber, Timestamp, nameof(TurnChangedEvent));

