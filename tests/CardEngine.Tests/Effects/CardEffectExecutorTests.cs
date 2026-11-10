using System;
using System.IO;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Effects;
using ChessUno.Core.GameEngine;
using Xunit;

namespace CardEngine.Tests.Effects;

public class CardEffectExecutorTests
{
    private readonly GameConfig _config;
    private readonly ChessEngine _chessEngine = new();
    private readonly CardEffectRegistry _registry = new();

    public CardEffectExecutorTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));
        var configPath = Path.Combine(projectRoot, "configs", "chess-uno.json");
        _config = System.Text.Json.JsonSerializer.Deserialize<GameConfig>(File.ReadAllText(configPath))!;
    }

    [Fact]
    public void ExecuteEffect_MoveEffect_SetsActionCounterAndEmitsEvents()
    {
        var executor = new CardEffectExecutor(_config, _registry, _chessEngine);
        var initialGame = _chessEngine.CreateInitialGame();
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-3", "3 Card", "NUMBER", 8, "MOVE_3", "", Value: 3));

        var result = executor.ExecuteCardEffect(initialGame, PlayerColor.White, card, sequenceNumber: 1);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.RemainingMoves);
        Assert.NotEmpty(result.EmittedEvents);
        Assert.Contains(result.EmittedEvents, e => e.EventType == "CardEffectResolvedEvent");
    }

    [Fact]
    public void ExecuteEffect_SkipEffect_SetsSkipFlagAndEmitsEvent()
    {
        var executor = new CardEffectExecutor(_config, _registry, _chessEngine);
        var initialGame = _chessEngine.CreateInitialGame();
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-skip", "Skip", "ACTION", 8, "SKIP_OPPONENT", ""));

        var result = executor.ExecuteCardEffect(initialGame, PlayerColor.White, card, sequenceNumber: 1);

        Assert.True(result.IsSuccess);
        Assert.True(result.SkipOpponent);
        Assert.Contains(result.EmittedEvents, e => e.EventType == "CardEffectResolvedEvent");
    }

    [Fact]
    public void ExecuteEffect_UnknownEffectKey_FailsSafelyAndEmitsFailureEvent()
    {
        var executor = new CardEffectExecutor(_config, _registry, _chessEngine);
        var initialGame = _chessEngine.CreateInitialGame();
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-bad", "Bad", "ACTION", 1, "NON_EXISTENT", ""));

        var result = executor.ExecuteCardEffect(initialGame, PlayerColor.White, card, sequenceNumber: 1);

        Assert.False(result.IsSuccess);
        Assert.Contains(result.EmittedEvents, e => e.EventType == "CardEffectFailedEvent");
    }

    [Fact]
    public void ExecuteEffect_ChooseEffect_ReturnsChoices()
    {
        var executor = new CardEffectExecutor(_config, _registry, _chessEngine);
        var initialGame = _chessEngine.CreateInitialGame();
        var card = new CardInstance(Guid.NewGuid(), new CardDefinition("card-wild", "Wild", "WILD", 4, "WILD_CHOICE", ""));

        var result = executor.ExecuteCardEffect(initialGame, PlayerColor.White, card, sequenceNumber: 1);

        Assert.True(result.IsSuccess);
        Assert.True(result.AwaitingChoice);
        Assert.NotNull(result.AvailableChoices);
        Assert.Equal(3, result.AvailableChoices.Count);
    }
}

