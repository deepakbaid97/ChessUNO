using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ChessUno.Core.Config;

public record GameConfig(
    [property: JsonPropertyName("schemaVersion")] string SchemaVersion,
    [property: JsonPropertyName("metadata")] MetadataConfig Metadata,
    [property: JsonPropertyName("boardSettings")] BoardSettingsConfig BoardSettings,
    [property: JsonPropertyName("turnRules")] TurnRulesConfig TurnRules,
    [property: JsonPropertyName("pieceRules")] PieceRulesConfig PieceRules,
    [property: JsonPropertyName("effects")] Dictionary<string, EffectDefinitionConfig> Effects,
    [property: JsonPropertyName("cards")] List<CardDefinitionConfig> Cards,
    [property: JsonPropertyName("winConditions")] WinConditionsConfig WinConditions,
    [property: JsonPropertyName("drawConditions")] DrawConditionsConfig DrawConditions
);

public record MetadataConfig(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("version")] string Version,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("author")] string Author
);

public record BoardSettingsConfig(
    [property: JsonPropertyName("rows")] int Rows,
    [property: JsonPropertyName("columns")] int Columns,
    [property: JsonPropertyName("initialFen")] string InitialFen,
    [property: JsonPropertyName("allowCastling")] bool AllowCastling,
    [property: JsonPropertyName("allowEnPassant")] bool AllowEnPassant,
    [property: JsonPropertyName("promotionRankWhite")] int PromotionRankWhite,
    [property: JsonPropertyName("promotionRankBlack")] int PromotionRankBlack,
    [property: JsonPropertyName("eligiblePromotionPieces")] List<string> EligiblePromotionPieces
);

public record TurnRulesConfig(
    [property: JsonPropertyName("turnOrder")] string TurnOrder,
    [property: JsonPropertyName("turnTimerSeconds")] int TurnTimerSeconds,
    [property: JsonPropertyName("drawPhaseMandatory")] bool DrawPhaseMandatory,
    [property: JsonPropertyName("reshuffleDiscardWhenDeckEmpty")] bool ReshuffleDiscardWhenDeckEmpty,
    [property: JsonPropertyName("mustResolveCheckBeforeOtherActions")] bool MustResolveCheckBeforeOtherActions,
    [property: JsonPropertyName("allowConsecutiveMovesWithSamePiece")] bool AllowConsecutiveMovesWithSamePiece,
    [property: JsonPropertyName("mustMoveIfLegalMoveAvailable")] bool MustMoveIfLegalMoveAvailable
);

public record PieceRulesConfig(
    [property: JsonPropertyName("pawnDoubleStepAllowed")] bool PawnDoubleStepAllowed,
    [property: JsonPropertyName("kingCannotMoveIntoCheck")] bool KingCannotMoveIntoCheck,
    [property: JsonPropertyName("revivalAllowedPieces")] List<string> RevivalAllowedPieces,
    [property: JsonPropertyName("revivalPlacementSquares")] string RevivalPlacementSquares
);

public record EffectDefinitionConfig(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("moveCount")] int? MoveCount = null,
    [property: JsonPropertyName("maxRevivals")] int? MaxRevivals = null,
    [property: JsonPropertyName("eligiblePieces")] List<string>? EligiblePieces = null,
    [property: JsonPropertyName("swapScope")] string? SwapScope = null,
    [property: JsonPropertyName("skipTarget")] string? SkipTarget = null,
    [property: JsonPropertyName("choices")] List<string>? Choices = null,
    [property: JsonPropertyName("sequence")] List<string>? Sequence = null
);

public record CardDefinitionConfig(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("quantity")] int Quantity,
    [property: JsonPropertyName("effectKey")] string EffectKey,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("value")] int? Value = null
);

public record WinConditionsConfig(
    [property: JsonPropertyName("checkmateWins")] bool CheckmateWins,
    [property: JsonPropertyName("kingCaptureWins")] bool KingCaptureWins,
    [property: JsonPropertyName("opponentResignationWins")] bool OpponentResignationWins,
    [property: JsonPropertyName("opponentTimeoutWins")] bool OpponentTimeoutWins
);

public record DrawConditionsConfig(
    [property: JsonPropertyName("stalemateDraws")] bool StalemateDraws,
    [property: JsonPropertyName("threefoldRepetitionDraws")] bool ThreefoldRepetitionDraws,
    [property: JsonPropertyName("fiftyMoveRuleDraws")] bool FiftyMoveRuleDraws,
    [property: JsonPropertyName("insufficientMaterialDraws")] bool InsufficientMaterialDraws,
    [property: JsonPropertyName("mutualAgreementDraws")] bool MutualAgreementDraws
);

