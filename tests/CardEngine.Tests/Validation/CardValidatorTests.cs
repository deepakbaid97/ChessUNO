using System;
using ChessUno.Core.Cards;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Validation;
using Xunit;

namespace CardEngine.Tests.Validation;

public class CardValidatorTests
{
    private readonly CardValidator _validator = new();

    [Fact]
    public void ValidateCardPlay_NullCard_FailsValidation()
    {
        var result = _validator.ValidateCardPlay(
            card: null,
            player: PlayerColor.White,
            activePlayer: PlayerColor.White,
            inCheck: false
        );

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("null", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void ValidateCardPlay_WrongPlayerTurn_FailsValidation()
    {
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-1", "1 Card", "NUMBER", 1, "MOVE_1", ""));

        // Black trying to play when it is White's turn
        var result = _validator.ValidateCardPlay(
            card: card,
            player: PlayerColor.Black,
            activePlayer: PlayerColor.White,
            inCheck: false
        );

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("turn", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void ValidateCardPlay_InCheck_CardWithZeroMoves_FailsValidation()
    {
        // Card 0 (PASS_TURN_EFFECT) played while in check cannot resolve check
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-0", "0 Card", "NUMBER", 1, "PASS_TURN_EFFECT", "", Value: 0));

        var result = _validator.ValidateCardPlay(
            card: card,
            player: PlayerColor.White,
            activePlayer: PlayerColor.White,
            inCheck: true
        );

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("check", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void ValidateCardPlay_ValidConditions_Succeeds()
    {
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-1", "1 Card", "NUMBER", 1, "MOVE_1", "", Value: 1));

        var result = _validator.ValidateCardPlay(
            card: card,
            player: PlayerColor.White,
            activePlayer: PlayerColor.White,
            inCheck: false
        );

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }
}

