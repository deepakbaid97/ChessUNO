using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ChessUno.Core.Sessions;

namespace ChessUno.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GamesController : ControllerBase
{
    private readonly IGameSessionRepository _sessionRepository;

    public GamesController(IGameSessionRepository sessionRepository)
    {
        _sessionRepository = sessionRepository;
    }

    [HttpPost]
    public async Task<IActionResult> CreateGame([FromBody] CreateGameRequest request)
    {
        var session = await _sessionRepository.CreateSessionAsync(request.PlayerName, request.Seed);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var invitationUrl = $"{baseUrl}/join/{session.InvitationToken}";

        var response = new CreateGameResponseDto(
            GameId: session.GameId,
            InvitationToken: session.InvitationToken,
            InvitationUrl: invitationUrl,
            PlayerId: session.PlayerWhite!.PlayerId.ToString(),
            PlayerToken: session.PlayerWhite.SecretToken,
            AssignedColor: session.PlayerWhite.Color.ToString(),
            Status: session.Status.ToString()
        );

        return Created($"/api/games/{session.GameId}", response);
    }

    [HttpPost("join")]
    public async Task<IActionResult> JoinGame([FromBody] JoinGameRequest request)
    {
        var existing = await _sessionRepository.GetByInvitationTokenAsync(request.InvitationToken);
        if (existing == null)
        {
            return NotFound(new { error = "Game session not found for the provided invitation token." });
        }

        if (existing.Status != SessionStatus.WaitingForPlayer || existing.PlayerBlack != null)
        {
            return Conflict(new { error = "Game session is already full or no longer accepting players." });
        }

        var result = await _sessionRepository.JoinSessionAsync(request.InvitationToken, request.PlayerName);
        if (result == null)
        {
            return Conflict(new { error = "Failed to join game session." });
        }

        var (session, player) = result.Value;

        var response = new JoinGameResponseDto(
            GameId: session.GameId,
            PlayerId: player.PlayerId.ToString(),
            PlayerToken: player.SecretToken,
            AssignedColor: player.Color.ToString(),
            Status: session.Status.ToString()
        );

        return Ok(response);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetGame(Guid id)
    {
        var session = await _sessionRepository.GetByIdAsync(id);
        if (session == null)
        {
            return NotFound(new { error = "Game not found." });
        }

        var response = new GameSessionViewDto(
            GameId: session.GameId,
            Status: session.Status.ToString(),
            PlayerWhiteName: session.PlayerWhite?.PlayerName,
            PlayerBlackName: session.PlayerBlack?.PlayerName,
            BoardFen: session.EngineController.ChessState.Fen,
            Revision: session.GameRevision
        );

        return Ok(response);
    }

    [HttpGet("invite/{token}")]
    public async Task<IActionResult> GetInvitationInfo(string token)
    {
        var session = await _sessionRepository.GetByInvitationTokenAsync(token);
        if (session == null)
        {
            return NotFound(new { error = "Game not found." });
        }

        return Ok(new InvitationInfoDto(
            GameId: session.GameId,
            Status: session.Status.ToString(),
            CreatorName: session.PlayerWhite?.PlayerName ?? "Host",
            AssignedColor: "Black"
        ));
    }
}

public record InvitationInfoDto(
    Guid GameId,
    string Status,
    string CreatorName,
    string AssignedColor
);

public record CreateGameRequest(string PlayerName, int? Seed = null);
public record JoinGameRequest(string InvitationToken, string PlayerName);

public record CreateGameResponseDto(
    Guid GameId,
    string InvitationToken,
    string InvitationUrl,
    string PlayerId,
    string PlayerToken,
    string AssignedColor,
    string Status
);

public record JoinGameResponseDto(
    Guid GameId,
    string PlayerId,
    string PlayerToken,
    string AssignedColor,
    string Status
);

public record GameSessionViewDto(
    Guid GameId,
    string Status,
    string? PlayerWhiteName,
    string? PlayerBlackName,
    string BoardFen,
    int Revision
);

