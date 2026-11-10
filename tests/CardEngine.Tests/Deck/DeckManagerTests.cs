using System;
using System.IO;
using System.Linq;
using ChessUno.Core.Cards;
using ChessUno.Core.Decks;
using Xunit;

namespace CardEngine.Tests.Deck;

public class DeckManagerTests
{
    private readonly JsonCardRepository _repository;
    private readonly string _configPath;

    public DeckManagerTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));
        _configPath = Path.Combine(projectRoot, "configs", "chess-uno.json");
        _repository = new JsonCardRepository();
        _repository.LoadFromPath(_configPath);
    }

    [Fact]
    public void DeckManager_InstantiatesWithExact108Cards()
    {
        var deckManager = new DeckManager(_repository.LoadFromPath(_configPath));
        Assert.Equal(108, deckManager.RemainingCount);
        Assert.Equal(0, deckManager.DiscardCount);
    }

    [Fact]
    public void DeckManager_DrawCard_RemovesCardFromDeck()
    {
        var deckManager = new DeckManager(_repository.LoadFromPath(_configPath));
        var card = deckManager.Draw();

        Assert.NotNull(card);
        Assert.Equal(107, deckManager.RemainingCount);
    }

    [Fact]
    public void DeckManager_Discard_AddsCardToDiscardPile()
    {
        var deckManager = new DeckManager(_repository.LoadFromPath(_configPath));
        var card = deckManager.Draw();

        deckManager.Discard(card);

        Assert.Equal(107, deckManager.RemainingCount);
        Assert.Equal(1, deckManager.DiscardCount);
        Assert.Equal(card.InstanceId, deckManager.TopDiscard?.InstanceId);
    }

    [Fact]
    public void DeckManager_SeededShuffling_ProducesReproducibleDrawOrder()
    {
        var cards = _repository.LoadFromPath(_configPath);
        var deck1 = new DeckManager(cards, seed: 42);
        var deck2 = new DeckManager(cards, seed: 42);

        var drawOrder1 = Enumerable.Range(0, 10).Select(_ => deck1.Draw().Id).ToList();
        var drawOrder2 = Enumerable.Range(0, 10).Select(_ => deck2.Draw().Id).ToList();

        Assert.Equal(drawOrder1, drawOrder2);
    }

    [Fact]
    public void DeckManager_EmptyDeck_AutomaticallyRecyclesDiscardPile()
    {
        var deckManager = new DeckManager(_repository.LoadFromPath(_configPath));
        
        // Draw and discard all 108 cards
        for (int i = 0; i < 108; i++)
        {
            var card = deckManager.Draw();
            deckManager.Discard(card);
        }

        Assert.Equal(0, deckManager.RemainingCount);
        Assert.Equal(108, deckManager.DiscardCount);

        // Drawing when empty reshuffles the discard pile
        var newCard = deckManager.Draw();

        Assert.NotNull(newCard);
        Assert.Equal(107, deckManager.RemainingCount);
        Assert.Equal(0, deckManager.DiscardCount);
    }

    [Fact]
    public void DeckManager_KnownSeeds_ProduceExpectedSpecialCards()
    {
        var cards = _repository.LoadFromPath(_configPath);
        Assert.Equal("card-reverse", new DeckManager(cards, seed: 15).Draw().Id);
        Assert.Equal("card-wild-draw-four", new DeckManager(cards, seed: 19).Draw().Id);
        Assert.Equal("card-draw-two", new DeckManager(cards, seed: 20).Draw().Id);
        Assert.Equal("card-skip", new DeckManager(cards, seed: 27).Draw().Id);
        Assert.Equal("card-wild", new DeckManager(cards, seed: 93).Draw().Id);
    }
}

