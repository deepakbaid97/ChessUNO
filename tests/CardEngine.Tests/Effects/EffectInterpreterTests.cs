using System;
using System.IO;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Turn;
using ChessUno.Core.Effects;
using Xunit;

namespace CardEngine.Tests.Effects;

public class EffectInterpreterTests
{
    private readonly GameConfig _config;
    private readonly EffectInterpreter _interpreter;

    public EffectInterpreterTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));
        var configPath = Path.Combine(projectRoot, "configs", "chess-uno.json");
        var json = File.ReadAllText(configPath);
        _config = System.Text.Json.JsonSerializer.Deserialize<GameConfig>(json)!;
        _interpreter = new EffectInterpreter(_config);
    }

    [Fact]
    public void PassTurnEffect_SetsActionsToZeroAndEndsTurn()
    {
        var turn = TurnState.StartDrawPhase(PlayerColor.White);
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-0", "0 Card", "NUMBER", 4, "PASS_TURN_EFFECT", "Pass turn", Value: 0));

        var resultTurn = _interpreter.ApplyEffect(turn, card);

        Assert.Equal(0, resultTurn.RemainingMoves);
        Assert.Equal(TurnPhase.TurnEnded, resultTurn.Phase);
    }

    [Theory]
    [InlineData("MOVE_1", 1)]
    [InlineData("MOVE_3", 3)]
    [InlineData("MOVE_9", 9)]
    public void MovePiecesEffect_SetsRemainingMovesToConfiguredCount(string effectKey, int expectedMoves)
    {
        var turn = TurnState.StartDrawPhase(PlayerColor.White);
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-x", "Move Card", "NUMBER", 8, effectKey, "Move pieces", Value: expectedMoves));

        var resultTurn = _interpreter.ApplyEffect(turn, card);

        Assert.Equal(expectedMoves, resultTurn.RemainingMoves);
        Assert.Equal(TurnPhase.ActionPhase, resultTurn.Phase);
    }

    [Fact]
    public void RevivePiecesEffect_SetsRemainingRevivals()
    {
        var turn = TurnState.StartDrawPhase(PlayerColor.White);
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-draw-two", "+2 Card", "ACTION", 8, "REVIVE_UP_TO_TWO", "Revive 2"));

        var resultTurn = _interpreter.ApplyEffect(turn, card);

        Assert.Equal(2, resultTurn.RemainingRevivals);
        Assert.Equal(TurnPhase.ActionPhase, resultTurn.Phase);
    }

    [Fact]
    public void SkipTurnEffect_SetsSkipOpponentFlag()
    {
        var turn = TurnState.StartDrawPhase(PlayerColor.White);
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-skip", "Skip", "ACTION", 8, "SKIP_OPPONENT", "Skip opponent"));

        var resultTurn = _interpreter.ApplyEffect(turn, card);

        Assert.True(resultTurn.SkipOpponent);
        Assert.Equal(TurnPhase.TurnEnded, resultTurn.Phase);
    }

    [Fact]
    public void ChooseEffect_TransitionsToAwaitingChoiceState()
    {
        var turn = TurnState.StartDrawPhase(PlayerColor.White);
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-wild", "Wild", "WILD", 4, "WILD_CHOICE", "Wild choice"));

        var resultTurn = _interpreter.ApplyEffect(turn, card);

        Assert.Equal(TurnPhase.AwaitingChoice, resultTurn.Phase);
        Assert.NotNull(resultTurn.AvailableChoices);
        Assert.Contains("MOVE_1", resultTurn.AvailableChoices);
        Assert.Contains("REVIVE_UP_TO_TWO", resultTurn.AvailableChoices);
        Assert.Contains("SWAP_OWN_PIECES", resultTurn.AvailableChoices);
    }

    [Fact]
    public void SequenceEffect_InitializesFirstStepAndStoresRemaining()
    {
        var turn = TurnState.StartDrawPhase(PlayerColor.White);
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-seq", "Sequence", "ACTION", 4, "REVIVE_TWO_AND_MOVE_TWO", "Seq"));

        var resultTurn = _interpreter.ApplyEffect(turn, card);

        // First step is REVIVE_UP_TO_TWO
        Assert.Equal(2, resultTurn.RemainingRevivals);
        Assert.Equal(TurnPhase.ActionPhase, resultTurn.Phase);
        Assert.NotNull(resultTurn.PendingSequence);
        Assert.Single(resultTurn.PendingSequence);
        Assert.Equal("MOVE_2", resultTurn.PendingSequence[0]);
    }
}
