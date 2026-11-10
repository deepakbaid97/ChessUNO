using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace ChessUno.Core.Config;

public record ValidationResult(bool IsValid, IReadOnlyList<string> Errors)
{
    public static ValidationResult Success() => new(true, Array.Empty<string>());
    public static ValidationResult Failure(params string[] errors) => new(false, errors);
    public static ValidationResult Failure(IEnumerable<string> errors) => new(false, errors.ToList());
}

public class GameConfigValidator
{
    private const int ExpectedStandardDeckSize = 108;

    public ValidationResult Validate(string json)
    {
        GameConfig? config;
        try
        {
            config = JsonSerializer.Deserialize<GameConfig>(json);
        }
        catch (Exception ex)
        {
            return ValidationResult.Failure($"JSON deserialization error: {ex.Message}");
        }

        if (config == null)
        {
            return ValidationResult.Failure("Configuration root cannot be null.");
        }

        return Validate(config);
    }

    public ValidationResult Validate(GameConfig config)
    {
        var errors = new List<string>();

        // 1. Deck count check
        var totalCards = config.Cards?.Sum(c => c.Quantity) ?? 0;
        if (totalCards != ExpectedStandardDeckSize)
        {
            errors.Add($"Total deck card count must be {ExpectedStandardDeckSize}, but was {totalCards}.");
        }

        // 2. Card effect references
        if (config.Cards != null && config.Effects != null)
        {
            foreach (var card in config.Cards)
            {
                if (!config.Effects.ContainsKey(card.EffectKey))
                {
                    errors.Add($"Card '{card.Id}' references undefined effectKey '{card.EffectKey}'.");
                }
            }
        }

        // 3. Effect recursion & cycle checks (SEQUENCE & CHOOSE_EFFECT)
        if (config.Effects != null)
        {
            foreach (var (effectKey, effect) in config.Effects)
            {
                // Check missing referenced children
                if (effect.Choices != null)
                {
                    foreach (var choiceKey in effect.Choices)
                    {
                        if (!config.Effects.ContainsKey(choiceKey))
                        {
                            errors.Add($"CHOOSE_EFFECT '{effectKey}' references missing choice '{choiceKey}'.");
                        }
                    }
                }

                if (effect.Sequence != null)
                {
                    foreach (var seqKey in effect.Sequence)
                    {
                        if (!config.Effects.ContainsKey(seqKey))
                        {
                            errors.Add($"SEQUENCE effect '{effectKey}' references missing step '{seqKey}'.");
                        }
                    }
                }

                // Check for cyclic effect references
                var visited = new HashSet<string>();
                var stack = new HashSet<string>();
                if (HasCycle(effectKey, config.Effects, visited, stack))
                {
                    errors.Add($"Cyclic dependency detected in effect '{effectKey}'.");
                }
            }
        }

        // 4. Board dimension validation
        if (config.BoardSettings != null)
        {
            if (config.BoardSettings.Rows < 4 || config.BoardSettings.Rows > 16)
            {
                errors.Add($"Board rows must be between 4 and 16. Was {config.BoardSettings.Rows}.");
            }
            if (config.BoardSettings.Columns < 4 || config.BoardSettings.Columns > 16)
            {
                errors.Add($"Board columns must be between 4 and 16. Was {config.BoardSettings.Columns}.");
            }

            if (config.BoardSettings.PromotionRankWhite < 1 || config.BoardSettings.PromotionRankWhite > config.BoardSettings.Rows)
            {
                errors.Add($"White promotion rank {config.BoardSettings.PromotionRankWhite} outside board limits (1..{config.BoardSettings.Rows}).");
            }

            if (config.BoardSettings.PromotionRankBlack < 1 || config.BoardSettings.PromotionRankBlack > config.BoardSettings.Rows)
            {
                errors.Add($"Black promotion rank {config.BoardSettings.PromotionRankBlack} outside board limits (1..{config.BoardSettings.Rows}).");
            }
        }

        return errors.Count == 0 ? ValidationResult.Success() : ValidationResult.Failure(errors);
    }

    private static bool HasCycle(string currentKey, Dictionary<string, EffectDefinitionConfig> effects, HashSet<string> visited, HashSet<string> recursionStack)
    {
        if (recursionStack.Contains(currentKey))
        {
            return true;
        }

        if (visited.Contains(currentKey) || !effects.TryGetValue(currentKey, out var effect))
        {
            return false;
        }

        visited.Add(currentKey);
        recursionStack.Add(currentKey);

        var childKeys = new List<string>();
        if (effect.Choices != null) childKeys.AddRange(effect.Choices);
        if (effect.Sequence != null) childKeys.AddRange(effect.Sequence);

        foreach (var childKey in childKeys)
        {
            if (HasCycle(childKey, effects, visited, recursionStack))
            {
                return true;
            }
        }

        recursionStack.Remove(currentKey);
        return false;
    }
}

