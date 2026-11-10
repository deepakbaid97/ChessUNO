using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ChessUno.Core.Cards;

public record CardDefinition(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("quantity")] int Quantity,
    [property: JsonPropertyName("effectKey")] string EffectKey,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("value")] int? Value = null
);

public record CardInstance(
    Guid InstanceId,
    CardDefinition Definition
)
{
    public string Id => Definition.Id;
    public string Name => Definition.Name;
    public string Category => Definition.Category;
    public string EffectKey => Definition.EffectKey;
    public int? Value => Definition.Value;
    public string Description => Definition.Description;
}

public interface ICardRepository
{
    IReadOnlyList<CardDefinition> LoadFromPath(string path);
    IReadOnlyList<CardDefinition> LoadFromJson(string json);
    CardDefinition GetById(string id);
    bool TryGetById(string id, out CardDefinition? card);
    int GetTotalDeckCardCount();
}

