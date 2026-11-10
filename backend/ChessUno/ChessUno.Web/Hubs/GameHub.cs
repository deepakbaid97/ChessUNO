using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Sessions;

namespace ChessUno.Web.Hubs;

public class GameHub : Hub
{
    private readonly IGameSessionRepository _sessionRepository;

    public GameHub(IGameSessionRepository sessionRepository)
    {
        _sessionRepository = sessionRepository;
    }

    public async Task<bool> JoinGameRoom(Guid gameId, string playerToken)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null)
        {
            return false;
        }

        PlayerSession? authenticatedPlayer = null;
        if (session.PlayerWhite?.SecretToken == playerToken)
        {
            authenticatedPlayer = session.PlayerWhite;
        }
        else if (session.PlayerBlack?.SecretToken == playerToken)
        {
            authenticatedPlayer = session.PlayerBlack;
        }

        if (authenticatedPlayer == null)
        {
            return false;
        }

        var groupName = GetGroupName(gameId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        // Send private game state snapshot to caller
        var engine = session.EngineController;
        var legalMoves = engine.GetLegalMoves().Select(m => m.ToString()).ToList();
        var snapshot = new
        {
            GameId = session.GameId,
            Status = session.Status.ToString(),
            AssignedColor = authenticatedPlayer.Color.ToString(),
            BoardFen = engine.ChessState.Fen,
            ActivePlayer = engine.ActivePlayer.ToString(),
            TurnPhase = engine.CurrentTurn.Phase.ToString(),
            RemainingMoves = engine.CurrentTurn.RemainingMoves,
            RemainingRevivals = engine.CurrentTurn.RemainingRevivals,
            CanSwap = engine.CurrentTurn.CanSwap,
            InCheck = engine.ChessState.InCheck,
            GameStatus = engine.ChessState.Status.ToString(),
            Winner = engine.ChessState.Winner?.ToString(),
            RemainingDeckCount = engine.DeckManager.RemainingCount,
            PlayerWhiteName = session.PlayerWhite?.PlayerName,
            PlayerBlackName = session.PlayerBlack?.PlayerName,
            ActiveCard = engine.CurrentTurn.ActiveCard != null ? new
            {
                id = engine.CurrentTurn.ActiveCard.Id,
                name = engine.CurrentTurn.ActiveCard.Name,
                category = engine.CurrentTurn.ActiveCard.Category,
                description = engine.CurrentTurn.ActiveCard.Description,
                effectKey = engine.CurrentTurn.ActiveCard.EffectKey,
                value = engine.CurrentTurn.ActiveCard.Value
            } : null,
            WhiteReserves = engine.ChessState.Reserves.TryGetValue(PlayerColor.White, out var wr) ? wr.Select(r => r.PieceType.ToString()).ToList() : new List<string>(),
            BlackReserves = engine.ChessState.Reserves.TryGetValue(PlayerColor.Black, out var br) ? br.Select(r => r.PieceType.ToString()).ToList() : new List<string>(),
            LegalMoves = legalMoves,
            Revision = session.GameRevision
        };

        await Clients.Caller.SendAsync("GameStateSnapshot", snapshot);

        // Notify opponent that player connected
        await Clients.OthersInGroup(groupName).SendAsync("PlayerConnected", new
        {
            PlayerName = authenticatedPlayer.PlayerName,
            Color = authenticatedPlayer.Color.ToString()
        });

        return true;
    }

    public async Task<bool> SendSignal(Guid gameId, string playerToken, string signalType, string payload)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        // Verify player belongs to game
        bool isAuthorized = (session.PlayerWhite?.SecretToken == playerToken) ||
                            (session.PlayerBlack?.SecretToken == playerToken);

        if (!isAuthorized) return false;

        var groupName = GetGroupName(gameId);
        // Relay signal to peer in the same room
        await Clients.OthersInGroup(groupName).SendAsync("ReceiveSignal", signalType, payload);
        return true;
    }

    public async Task<bool> DrawCard(Guid gameId, string playerToken)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null || player.Color != session.EngineController.ActivePlayer)
        {
            return false;
        }

        try
        {
            var drawnCard = session.EngineController.DrawCard(player.Color);
            var groupName = GetGroupName(gameId);

            await Clients.Group(groupName).SendAsync("CardDrawn", new
            {
                Player = player.Color.ToString(),
                CardName = drawnCard.Name,
                RemainingDeckCount = session.EngineController.DeckManager.RemainingCount
            });

            await BroadcastStateUpdate(session);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public async Task<bool> SubmitMove(Guid gameId, string playerToken, string from, string to, string? promotion)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null || player.Color != session.EngineController.ActivePlayer)
        {
            return false;
        }

        try
        {
            var promoPiece = !string.IsNullOrEmpty(promotion) && Enum.TryParse<PieceType>(promotion, true, out var p) ? p : (PieceType?)null;
            var move = new ChessMove(Square.Parse(from), Square.Parse(to), promoPiece);

            var result = session.EngineController.SubmitChessMove(player.Color, move);
            if (!result.IsSuccess) return false;

            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("MoveAccepted", new
            {
                Player = player.Color.ToString(),
                From = from,
                To = to,
                BoardFen = session.EngineController.ChessState.Fen
            });

            await BroadcastStateUpdate(session);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public async Task<List<string>> GetLegalMoves(Guid gameId, string playerToken)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return new List<string>();

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null) return new List<string>();

        return session.EngineController.GetLegalMoves().Select(m => m.ToString()).ToList();
    }

    public async Task<bool> Resign(Guid gameId, string playerToken)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null) return false;

        var result = session.EngineController.Resign(player.Color);
        if (!result.IsSuccess) return false;

        await BroadcastStateUpdate(session);
        return true;
    }

    public async Task<bool> SubmitRevival(Guid gameId, string playerToken, string pieceType, string targetSquare)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null || player.Color != session.EngineController.ActivePlayer) return false;

        if (!Enum.TryParse<PieceType>(pieceType, true, out var piece)) return false;

        var result = session.EngineController.SubmitRevival(player.Color, piece, Square.Parse(targetSquare));
        if (!result.IsSuccess) return false;

        var groupName = GetGroupName(gameId);
        await Clients.Group(groupName).SendAsync("PieceRevived", new
        {
            Player = player.Color.ToString(),
            Piece = pieceType,
            TargetSquare = targetSquare,
            BoardFen = session.EngineController.ChessState.Fen
        });

        await BroadcastStateUpdate(session);
        return true;
    }

    public async Task<bool> SubmitSwap(Guid gameId, string playerToken, string sq1, string sq2)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null || player.Color != session.EngineController.ActivePlayer) return false;

        var result = session.EngineController.SubmitSwap(player.Color, Square.Parse(sq1), Square.Parse(sq2));
        if (!result.IsSuccess) return false;

        var groupName = GetGroupName(gameId);
        await Clients.Group(groupName).SendAsync("PiecesSwapped", new
        {
            Player = player.Color.ToString(),
            Square1 = sq1,
            Square2 = sq2,
            BoardFen = session.EngineController.ChessState.Fen
        });

        await BroadcastStateUpdate(session);
        return true;
    }

    private async Task BroadcastStateUpdate(GameSession session)
    {
        var groupName = GetGroupName(session.GameId);
        var engine = session.EngineController;
        session.GameRevision++;
        var legalMoves = engine.GetLegalMoves().Select(m => m.ToString()).ToList();

        await Clients.Group(groupName).SendAsync("GameStateUpdated", new
        {
            BoardFen = engine.ChessState.Fen,
            ActivePlayer = engine.ActivePlayer.ToString(),
            TurnPhase = engine.CurrentTurn.Phase.ToString(),
            RemainingMoves = engine.CurrentTurn.RemainingMoves,
            RemainingRevivals = engine.CurrentTurn.RemainingRevivals,
            CanSwap = engine.CurrentTurn.CanSwap,
            InCheck = engine.ChessState.InCheck,
            GameStatus = engine.ChessState.Status.ToString(),
            Winner = engine.ChessState.Winner?.ToString(),
            Revision = session.GameRevision,
            RemainingDeckCount = engine.DeckManager.RemainingCount,
            ActiveCard = engine.CurrentTurn.ActiveCard != null ? new
            {
                id = engine.CurrentTurn.ActiveCard.Id,
                name = engine.CurrentTurn.ActiveCard.Name,
                category = engine.CurrentTurn.ActiveCard.Category,
                description = engine.CurrentTurn.ActiveCard.Description,
                effectKey = engine.CurrentTurn.ActiveCard.EffectKey,
                value = engine.CurrentTurn.ActiveCard.Value
            } : null,
            WhiteReserves = engine.ChessState.Reserves.TryGetValue(PlayerColor.White, out var wr) ? wr.Select(r => r.PieceType.ToString()).ToList() : new List<string>(),
            BlackReserves = engine.ChessState.Reserves.TryGetValue(PlayerColor.Black, out var br) ? br.Select(r => r.PieceType.ToString()).ToList() : new List<string>(),
            LegalMoves = legalMoves
        });
    }

    private static PlayerSession? GetAuthenticatedPlayer(GameSession session, string token)
    {
        if (session.PlayerWhite?.SecretToken == token) return session.PlayerWhite;
        if (session.PlayerBlack?.SecretToken == token) return session.PlayerBlack;
        return null;
    }

    private static string GetGroupName(Guid gameId) => $"game-{gameId}";
}

