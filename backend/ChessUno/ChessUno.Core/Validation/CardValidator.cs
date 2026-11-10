using System;
using System.Collections.Generic;
using ChessUno.Core.Cards;
using ChessUno.Core.Domain.Common;

namespace ChessUno.Core.Validation;

public record CardValidationResult(bool IsValid, IReadOnlyList<string> Errors)
{
    public static CardValidationResult Success() => new(true, Array.Empty<string>());
    public static CardValidationResult Failure(params string[] errors) => new(false, errors);
    public static CardValidationResult Failure(IEnumerable<string> errors) => new(false, new List<string>(errors));
}

public interface ICardValidator
{
    CardValidationResult ValidateCardPlay(CardInstance? card, PlayerColor player, PlayerColor activePlayer, bool inCheck);
}

public class CardValidator : ICardValidator
{
    public CardValidationResult ValidateCardPlay(CardInstance? card, PlayerColor player, PlayerColor activePlayer, bool inCheck)
    {
        var errors = new List<string>();

        if (card == null)
        {
            return CardValidationResult.Failure("Card cannot be null.");
        }

        if (player != activePlayer)
        {
            errors.Add($"Cannot play card: It is {activePlayer}'s turn, but {player} attempted to play.");
        }

        // When in check, cards that grant 0 moves (like Card 0) cannot escape check
        if (inCheck && (card.Value == 0 || card.EffectKey == "PASS_TURN_EFFECT"))
        {
            errors.Add("Cannot play pass/0-move card while King is in check.");
        }

        return errors.Count == 0
            ? CardValidationResult.Success()
            : CardValidationResult.Failure(errors);
    }
}

