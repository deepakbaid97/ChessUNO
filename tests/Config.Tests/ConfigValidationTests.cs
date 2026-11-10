using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using Json.Schema;
using ChessUno.Core.Config;
using Xunit;

namespace Config.Tests;

public class ConfigValidationTests
{
    private static readonly string SchemaPath;
    private static readonly string ConfigPath;
    private static readonly JsonSchema Schema;

    static ConfigValidationTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));
        SchemaPath = Path.Combine(projectRoot, "configs", "chess-uno.schema.json");
        ConfigPath = Path.Combine(projectRoot, "configs", "chess-uno.json");
        Schema = JsonSchema.FromText(File.ReadAllText(SchemaPath));
    }

    [Fact]
    public void SchemaFile_And_ConfigFile_MustExist()
    {
        Assert.True(File.Exists(SchemaPath), $"Schema file not found at: {SchemaPath}");
        Assert.True(File.Exists(ConfigPath), $"Config file not found at: {ConfigPath}");
    }

    [Fact]
    public void StandardConfig_MustConformTo_JsonSchema()
    {
        var configJson = File.ReadAllText(ConfigPath);
        using var jsonDoc = JsonDocument.Parse(configJson);

        var result = Schema.Evaluate(jsonDoc.RootElement, new EvaluationOptions
        {
            OutputFormat = OutputFormat.List
        });

        Assert.True(result.IsValid, $"Config failed schema validation: {result.Errors}");
    }

    [Fact]
    public void Schema_MustReject_NegativeCardQuantity()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Mutate first card quantity to -5
        jsonNode["cards"]![0]!["quantity"] = -5;

        using var jsonDoc = JsonDocument.Parse(jsonNode.ToJsonString());
        var result = Schema.Evaluate(jsonDoc.RootElement);
        Assert.False(result.IsValid, "Schema should reject negative card quantity.");
    }

    [Fact]
    public void Schema_MustReject_UnknownEffectType()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Inject unknown effect type
        jsonNode["effects"]!["MOVE_1"]!["type"] = "BLAST_LASER_BEAM";

        using var jsonDoc = JsonDocument.Parse(jsonNode.ToJsonString());
        var result = Schema.Evaluate(jsonDoc.RootElement);
        Assert.False(result.IsValid, "Schema should reject unknown effect type.");
    }

    [Fact]
    public void SemanticValidator_StandardConfig_MustPassAllRules()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var validator = new GameConfigValidator();
        var validationResult = validator.Validate(configJson);

        Assert.True(validationResult.IsValid, $"Semantic validation errors: {string.Join(", ", validationResult.Errors)}");
    }

    [Fact]
    public void SemanticValidator_MustEnforce_TotalDeckCountOf108()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Change card quantity so total != 108
        jsonNode["cards"]![0]!["quantity"] = 999;

        var validator = new GameConfigValidator();
        var validationResult = validator.Validate(jsonNode.ToJsonString());

        Assert.False(validationResult.IsValid);
        Assert.Contains(validationResult.Errors, e => e.Contains("108"));
    }

    [Fact]
    public void SemanticValidator_MustReject_MissingEffectKeyReference()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Point card to non-existent effect
        jsonNode["cards"]![0]!["effectKey"] = "NON_EXISTENT_EFFECT";

        var validator = new GameConfigValidator();
        var validationResult = validator.Validate(jsonNode.ToJsonString());

        Assert.False(validationResult.IsValid);
        Assert.Contains(validationResult.Errors, e => e.Contains("NON_EXISTENT_EFFECT"));
    }

    [Fact]
    public void SemanticValidator_MustReject_CyclicSequenceOrChoice()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Introduce a cycle: EFFECT_A points to EFFECT_B, EFFECT_B points to EFFECT_A
        var effects = jsonNode["effects"]!.AsObject();
        effects.Add("EFFECT_A", JsonNode.Parse(@"{ ""type"": ""SEQUENCE"", ""description"": ""Cycle test"", ""sequence"": [""EFFECT_B""] }"));
        effects.Add("EFFECT_B", JsonNode.Parse(@"{ ""type"": ""SEQUENCE"", ""description"": ""Cycle test"", ""sequence"": [""EFFECT_A""] }"));

        var validator = new GameConfigValidator();
        var validationResult = validator.Validate(jsonNode.ToJsonString());

        Assert.False(validationResult.IsValid);
        Assert.Contains(validationResult.Errors, e => e.Contains("Cyclic") || e.Contains("cyclic"));
    }

    [Fact]
    public void SemanticValidator_MustReject_InvalidBoardDimensions()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Set invalid rows
        jsonNode["boardSettings"]!["rows"] = 2;

        var validator = new GameConfigValidator();
        var validationResult = validator.Validate(jsonNode.ToJsonString());

        Assert.False(validationResult.IsValid);
        Assert.Contains(validationResult.Errors, e => e.Contains("rows"));
    }

    [Fact]
    public void SemanticValidator_MustReject_PromotionRankOutOfBounds()
    {
        var configJson = File.ReadAllText(ConfigPath);
        var jsonNode = JsonNode.Parse(configJson)!;

        // Set promotion rank out of bounds
        jsonNode["boardSettings"]!["promotionRankWhite"] = 15;

        var validator = new GameConfigValidator();
        var validationResult = validator.Validate(jsonNode.ToJsonString());

        Assert.False(validationResult.IsValid);
        Assert.Contains(validationResult.Errors, e => e.Contains("promotion rank"));
    }
}
