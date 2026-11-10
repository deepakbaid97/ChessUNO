using System;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ChessUno.Core.Sessions;

public static class LegacySnapshotSanitizer
{
    public static string Sanitize(string snapshotJson)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson)) return snapshotJson;

        try
        {
            var node = JsonNode.Parse(snapshotJson);
            if (node is not JsonObject root)
            {
                return snapshotJson;
            }

            bool modified = false;

            // 1. Sanitize PlayerWhite
            if (root["PlayerWhite"] is JsonObject playerWhite)
            {
                if (playerWhite.ContainsKey("SecretToken"))
                {
                    var secret = playerWhite["SecretToken"]?.ToString();
                    var existingHash = playerWhite["TokenHash"]?.ToString();

                    if (string.IsNullOrEmpty(existingHash) && !string.IsNullOrEmpty(secret))
                    {
                        playerWhite["TokenHash"] = TokenHasher.HashToken(secret);
                    }

                    playerWhite.Remove("SecretToken");
                    modified = true;
                }
            }

            // 2. Sanitize PlayerBlack
            if (root["PlayerBlack"] is JsonObject playerBlack)
            {
                if (playerBlack.ContainsKey("SecretToken"))
                {
                    var secret = playerBlack["SecretToken"]?.ToString();
                    var existingHash = playerBlack["TokenHash"]?.ToString();

                    if (string.IsNullOrEmpty(existingHash) && !string.IsNullOrEmpty(secret))
                    {
                        playerBlack["TokenHash"] = TokenHasher.HashToken(secret);
                    }

                    playerBlack.Remove("SecretToken");
                    modified = true;
                }
            }

            // 3. Sanitize Root InvitationToken
            if (root.ContainsKey("InvitationToken"))
            {
                var invite = root["InvitationToken"]?.ToString();
                var existingInviteHash = root["InvitationTokenHash"]?.ToString();

                if (string.IsNullOrEmpty(existingInviteHash) && !string.IsNullOrEmpty(invite))
                {
                    root["InvitationTokenHash"] = TokenHasher.HashToken(invite);
                }

                root.Remove("InvitationToken");
                modified = true;
            }

            return modified ? root.ToJsonString() : snapshotJson;
        }
        catch
        {
            // If json is malformed, return as-is
            return snapshotJson;
        }
    }
}
