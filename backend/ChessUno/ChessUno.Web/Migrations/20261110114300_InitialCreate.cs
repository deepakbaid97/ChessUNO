using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChessUno.Web.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "game_actions",
                columns: table => new
                {
                    game_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    player_color = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    action_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    revision = table.Column<int>(type: "integer", nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: false),
                    result_json = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_game_actions", x => new { x.game_id, x.action_id });
                });

            migrationBuilder.CreateTable(
                name: "game_sessions",
                columns: table => new
                {
                    game_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invitation_token = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    invitation_token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    player_white_id = table.Column<Guid>(type: "uuid", nullable: true),
                    player_white_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    player_white_token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    player_white_connected = table.Column<bool>(type: "boolean", nullable: false),
                    player_black_id = table.Column<Guid>(type: "uuid", nullable: true),
                    player_black_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    player_black_token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    player_black_connected = table.Column<bool>(type: "boolean", nullable: false),
                    board_fen = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    game_revision = table.Column<int>(type: "integer", nullable: false),
                    winner = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    snapshot_json = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_game_sessions", x => x.game_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_game_actions_game_id",
                table: "game_actions",
                column: "game_id");

            migrationBuilder.CreateIndex(
                name: "IX_game_sessions_invitation_token",
                table: "game_sessions",
                column: "invitation_token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_game_sessions_invitation_token_hash",
                table: "game_sessions",
                column: "invitation_token_hash");

            migrationBuilder.CreateIndex(
                name: "IX_game_sessions_status",
                table: "game_sessions",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "game_actions");

            migrationBuilder.DropTable(
                name: "game_sessions");
        }
    }
}
