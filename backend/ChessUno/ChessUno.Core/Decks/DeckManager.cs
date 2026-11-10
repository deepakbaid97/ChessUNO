using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using ChessUno.Core.Cards;

namespace ChessUno.Core.Decks;

public interface IDeckManager
{
    int RemainingCount { get; }
    int DiscardCount { get; }
    CardInstance? TopDiscard { get; }
    CardInstance Draw();
    void Discard(CardInstance card);
    void Shuffle();
    IReadOnlyList<CardInstance> PeekAll();
}

public class DeckManager : IDeckManager
{
    private readonly List<CardInstance> _drawPile = new();
    private readonly List<CardInstance> _discardPile = new();
    private readonly Random? _seededRandom;

    public int RemainingCount => _drawPile.Count;
    public int DiscardCount => _discardPile.Count;
    public CardInstance? TopDiscard => _discardPile.Count > 0 ? _discardPile[^1] : null;

    public DeckManager(IEnumerable<CardDefinition> cardDefinitions, int? seed = null)
    {
        if (seed.HasValue)
        {
            _seededRandom = new Random(seed.Value);
        }

        foreach (var def in cardDefinitions)
        {
            for (int i = 0; i < def.Quantity; i++)
            {
                _drawPile.Add(new CardInstance(Guid.NewGuid(), def));
            }
        }

        Shuffle();
    }

    public void Shuffle()
    {
        // Fisher-Yates shuffle
        for (int i = _drawPile.Count - 1; i > 0; i--)
        {
            int j = _seededRandom != null
                ? _seededRandom.Next(i + 1)
                : RandomNumberGenerator.GetInt32(i + 1);

            (_drawPile[i], _drawPile[j]) = (_drawPile[j], _drawPile[i]);
        }
    }

    public CardInstance Draw()
    {
        if (_drawPile.Count == 0)
        {
            if (_discardPile.Count == 0)
            {
                throw new InvalidOperationException("Cannot draw card: Both draw deck and discard pile are empty.");
            }

            // Recycle discard pile into draw deck
            _drawPile.AddRange(_discardPile);
            _discardPile.Clear();
            Shuffle();
        }

        var top = _drawPile[0];
        _drawPile.RemoveAt(0);
        return top;
    }

    public void Discard(CardInstance card)
    {
        if (card == null) throw new ArgumentNullException(nameof(card));
        _discardPile.Add(card);
    }

    public IReadOnlyList<CardInstance> PeekAll() => _drawPile.AsReadOnly();
}

