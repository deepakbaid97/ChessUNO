using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChessUno.Web.Data;

[Table("game_actions")]
public class GameActionEntity
{
    [Required]
    [Column("game_id")]
    public Guid GameId { get; set; }

    [Required]
    [MaxLength(128)]
    [Column("action_id")]
    public string ActionId { get; set; } = string.Empty;

    [Required]
    [MaxLength(64)]
    [Column("player_color")]
    public string PlayerColor { get; set; } = string.Empty;

    [Required]
    [MaxLength(64)]
    [Column("action_type")]
    public string ActionType { get; set; } = string.Empty;

    [Column("revision")]
    public int Revision { get; set; }

    [Column("payload_json", TypeName = "text")]
    public string PayloadJson { get; set; } = string.Empty;

    [Column("result_json", TypeName = "text")]
    public string ResultJson { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
