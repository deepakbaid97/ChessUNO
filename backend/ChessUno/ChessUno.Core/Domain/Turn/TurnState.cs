using System.Collections.Generic;
using System.Text.Json.Serialization;
using ChessUno.Core.Cards;
using ChessUno.Core.Domain.Common;

namespace ChessUno.Core.Domain.Turn;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TurnPhase
{
    DrawPhase,
    ActionPhase,
    AwaitingChoice,
    TurnEnded
}

public record TurnState(
    [property: JsonPropertyName("activePlayer")] PlayerColor ActivePlayer,
    [property: JsonPropertyName("phase")] TurnPhase Phase,
    [property: JsonPropertyName("activeCard")] CardInstance? ActiveCard = null,
    [property: JsonPropertyName("remainingMoves")] int RemainingMoves = 0,
    [property: JsonPropertyName("remainingRevivals")] int RemainingRevivals = 0,
    [property: JsonPropertyName("canSwap")] bool CanSwap = false,
    [property: JsonPropertyName("skipOpponent")] bool SkipOpponent = false,
    [property: JsonPropertyName("availableChoices")] IReadOnlyList<string>? AvailableChoices = null,
    [property: JsonPropertyName("pendingSequence")] IReadOnlyList<string>? PendingSequence = null
)
{
    public static TurnState StartDrawPhase(PlayerColor player) =>
        new(ActivePlayer: player, Phase: TurnPhase.DrawPhase);
}
