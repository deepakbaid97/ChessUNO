using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChessUno.Web.Migrations
{
    /// <inheritdoc />
    public partial class SecureTokenStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_game_sessions_invitation_token",
                table: "game_sessions");

            migrationBuilder.DropIndex(
                name: "IX_game_sessions_invitation_token_hash",
                table: "game_sessions");

            migrationBuilder.DropColumn(
                name: "invitation_token",
                table: "game_sessions");

            migrationBuilder.CreateIndex(
                name: "IX_game_sessions_invitation_token_hash",
                table: "game_sessions",
                column: "invitation_token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_game_sessions_invitation_token_hash",
                table: "game_sessions");

            migrationBuilder.AddColumn<string>(
                name: "invitation_token",
                table: "game_sessions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_game_sessions_invitation_token",
                table: "game_sessions",
                column: "invitation_token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_game_sessions_invitation_token_hash",
                table: "game_sessions",
                column: "invitation_token_hash");
        }
    }
}
