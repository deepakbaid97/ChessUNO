using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ChessUno.Core.Cards;

public class JsonCardRepository : ICardRepository
{
    private readonly Dictionary<string, CardDefinition> _cardDefinitions = new();

    public IReadOnlyList<CardDefinition> LoadFromPath(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Configuration file not found at path '{path}'.");
        }

        var json = File.ReadAllText(path);
        return LoadFromJson(json);
    }

    public IReadOnlyList<CardDefinition> LoadFromJson(string json)
    {
        _cardDefinitions.Clear();

        JsonNode root;
        try
        {
            root = JsonNode.Parse(json) ?? throw new InvalidOperationException("Parsed JSON root was null.");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Malformed JSON: {ex.Message}", ex);
        }

        var effectsNode = root["effects"]?.AsObject();
        var effects = new HashSet<string>();
        if (effectsNode != null)
        {
            foreach (var kvp in effectsNode)
            {
                effects.Add(kvp.Key);
            }
        }

        var cardsArray = root["cards"]?.AsArray();
        if (cardsArray == null)
        {
            throw new InvalidOperationException("Configuration must contain a 'cards' array.");
        }

        foreach (var cardNode in cardsArray)
        {
            if (cardNode == null) continue;

            var card = JsonSerializer.Deserialize<CardDefinition>(cardNode.ToJsonString())
                ?? throw new InvalidOperationException("Failed to deserialize card definition.");

            if (string.IsNullOrWhiteSpace(card.Id))
            {
                throw new InvalidOperationException("Card definition must contain a non-empty 'id'.");
            }

            if (_cardDefinitions.ContainsKey(card.Id))
            {
                throw new InvalidOperationException($"Duplicate card identifier detected: '{card.Id}'.");
            }

            if (!effects.Contains(card.EffectKey))
            {
                throw new InvalidOperationException($"Card '{card.Id}' references undefined effectKey '{card.EffectKey}'.");
            }

            _cardDefinitions[card.Id] = card;
        }

        return _cardDefinitions.Values.ToList();
    }

    public CardDefinition GetById(string id)
    {
        if (!_cardDefinitions.TryGetValue(id, out var card))
        {
            throw new KeyNotFoundException($"No card definition found with id '{id}'.");
        }
        return card;
    }

    public bool TryGetById(string id, out CardDefinition? card) =>
        _cardDefinitions.TryGetValue(id, out card);

    public int GetTotalDeckCardCount() =>
        _cardDefinitions.Values.Sum(c => c.Quantity);
}

