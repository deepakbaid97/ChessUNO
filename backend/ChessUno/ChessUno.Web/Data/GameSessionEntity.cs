using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using ChessUno.Core.Sessions;

namespace ChessUno.Web.Data;

[Table("game_sessions")]
public class GameSessionEntity
{
    [Key]
    [Column("game_id")]
    public Guid GameId { get; set; }

    [Required]
    [MaxLength(64)]
    [Column("invitation_token_hash")]
    public string InvitationTokenHash { get; set; } = string.Empty;

    [Required]
    [Column("status")]
    public SessionStatus Status { get; set; }

    [Column("player_white_id")]
    public Guid? PlayerWhiteId { get; set; }

    [MaxLength(128)]
    [Column("player_white_name")]
    public string? PlayerWhiteName { get; set; }

    [MaxLength(64)]
    [Column("player_white_token_hash")]
    public string? PlayerWhiteTokenHash { get; set; }

    [Column("player_white_connected")]
    public bool PlayerWhiteConnected { get; set; }

    [Column("player_black_id")]
    public Guid? PlayerBlackId { get; set; }

    [MaxLength(128)]
    [Column("player_black_name")]
    public string? PlayerBlackName { get; set; }

    [MaxLength(64)]
    [Column("player_black_token_hash")]
    public string? PlayerBlackTokenHash { get; set; }

    [Column("player_black_connected")]
    public bool PlayerBlackConnected { get; set; }

    [Required]
    [MaxLength(128)]
    [Column("board_fen")]
    public string BoardFen { get; set; } = string.Empty;

    [Column("game_revision")]
    [ConcurrencyCheck]
    public int GameRevision { get; set; }

    [MaxLength(32)]
    [Column("winner")]
    public string? Winner { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }

    [Column("expires_at")]
    public DateTimeOffset? ExpiresAt { get; set; }

    [Required]
    [Column("snapshot_json", TypeName = "text")]
    public string SnapshotJson { get; set; } = string.Empty;
}

