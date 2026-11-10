using System;
using System.IO;
using ChessUno.Core.Cards;
using Xunit;

namespace CardEngine.Tests.Loading;

public class CardRepositoryTests
{
    private readonly string _validConfigPath;

    public CardRepositoryTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));
        _validConfigPath = Path.Combine(projectRoot, "configs", "chess-uno.json");
    }

    [Fact]
    public void LoadFromPath_ValidConfig_LoadsAllCardDefinitions()
    {
        var repository = new JsonCardRepository();
        var cards = repository.LoadFromPath(_validConfigPath);

        Assert.NotEmpty(cards);
        // Total deck count configured is 108 cards across definitions
        var totalQuantity = repository.GetTotalDeckCardCount();
        Assert.Equal(108, totalQuantity);
    }

    [Fact]
    public void LoadFromJson_DuplicateCardId_ThrowsInvalidOperationException()
    {
        var repository = new JsonCardRepository();
        var jsonWithDuplicates = @"
        {
          ""schemaVersion"": ""1.0.0"",
          ""cards"": [
            { ""id"": ""card-1"", ""name"": ""Card 1"", ""category"": ""NUMBER"", ""quantity"": 1, ""effectKey"": ""MOVE_1"", ""description"": """" },
            { ""id"": ""card-1"", ""name"": ""Duplicate Card"", ""category"": ""NUMBER"", ""quantity"": 1, ""effectKey"": ""MOVE_1"", ""description"": """" }
          ],
          ""effects"": {
            ""MOVE_1"": { ""type"": ""MOVE_PIECES"", ""description"": """", ""moveCount"": 1 }
          }
        }";

        var ex = Assert.Throws<InvalidOperationException>(() => repository.LoadFromJson(jsonWithDuplicates));
        Assert.Contains("duplicate", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LoadFromJson_UnknownEffectKey_ThrowsInvalidOperationException()
    {
        var repository = new JsonCardRepository();
        var jsonWithUnknownEffect = @"
        {
          ""schemaVersion"": ""1.0.0"",
          ""cards"": [
            { ""id"": ""card-x"", ""name"": ""Card X"", ""category"": ""ACTION"", ""quantity"": 1, ""effectKey"": ""UNKNOWN_EFFECT"", ""description"": """" }
          ],
          ""effects"": {
            ""MOVE_1"": { ""type"": ""MOVE_PIECES"", ""description"": """", ""moveCount"": 1 }
          }
        }";

        var ex = Assert.Throws<InvalidOperationException>(() => repository.LoadFromJson(jsonWithUnknownEffect));
        Assert.Contains("UNKNOWN_EFFECT", ex.Message);
    }

    [Fact]
    public void GetCardDefinition_ReturnsMatchingCard()
    {
        var repository = new JsonCardRepository();
        repository.LoadFromPath(_validConfigPath);

        var card0 = repository.GetById("card-0");
        Assert.NotNull(card0);
        Assert.Equal("card-0", card0.Id);
        Assert.Equal("PASS_TURN_EFFECT", card0.EffectKey);
    }
}

