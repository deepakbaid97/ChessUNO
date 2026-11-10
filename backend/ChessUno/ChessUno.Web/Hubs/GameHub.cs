using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.GameEngine;
using ChessUno.Core.Sessions;

namespace ChessUno.Web.Hubs;

public class GameHub : Hub
{
    private readonly IGameSessionRepository _sessionRepository;
    private readonly IChessEngine _chessEngine = new ChessEngine();
    private static readonly ConcurrentDictionary<string, (Guid GameId, PlayerColor Color, string PlayerName)> _connections = new();

    public GameHub(IGameSessionRepository sessionRepository)
    {
        _sessionRepository = sessionRepository;
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connections.TryRemove(Context.ConnectionId, out var info))
        {
            await _sessionRepository.UpdatePlayerConnectionStatusAsync(info.GameId, info.Color, false);
            var groupName = GetGroupName(info.GameId);
            await Clients.OthersInGroup(groupName).SendAsync("PlayerDisconnected", new
            {
                PlayerName = info.PlayerName,
                Color = info.Color.ToString()
            });
        }

        await base.OnDisconnectedAsync(exception);
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

        _connections[Context.ConnectionId] = (gameId, authenticatedPlayer.Color, authenticatedPlayer.PlayerName);
        await _sessionRepository.UpdatePlayerConnectionStatusAsync(gameId, authenticatedPlayer.Color, true);

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
            AvailableChoices = engine.CurrentTurn.AvailableChoices,
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

        // Notify opponent that player connected or reconnected
        await Clients.OthersInGroup(groupName).SendAsync("PlayerConnected", new
        {
            PlayerName = authenticatedPlayer.PlayerName,
            Color = authenticatedPlayer.Color.ToString(),
            IsReconnected = authenticatedPlayer.IsConnected
        });

        return true;
    }

    public async Task<bool> SendSignal(Guid gameId, string playerToken, string signalType, string payload)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        bool isAuthorized = (session.PlayerWhite?.SecretToken == playerToken) ||
                            (session.PlayerBlack?.SecretToken == playerToken);

        if (!isAuthorized) return false;

        var groupName = GetGroupName(gameId);
        await Clients.OthersInGroup(groupName).SendAsync("ReceiveSignal", signalType, payload);
        return true;
    }

    public Task<bool> DrawCard(Guid gameId, string playerToken) =>
        DrawCardInternal(gameId, playerToken, null, null);

    public Task<bool> DrawCardWithIdempotency(Guid gameId, string playerToken, string actionId, int? expectedRevision) =>
        DrawCardInternal(gameId, playerToken, actionId, expectedRevision);

    private async Task<bool> DrawCardInternal(Guid gameId, string playerToken, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        if (!string.IsNullOrEmpty(actionId))
        {
            var cached = await _sessionRepository.GetActionResultAsync(gameId, actionId);
            if (cached != null) return true;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                await RejectActionAsync("REVISION_MISMATCH", session.GameRevision, expectedRevision.Value);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null || player.Color != session.EngineController.ActivePlayer)
            {
                await RejectActionAsync("NOT_YOUR_TURN", session.GameRevision);
                return false;
            }

            var drawnCard = session.EngineController.DrawCard(player.Color);
            session.Status = SessionStatus.InProgress;

            if (_chessEngine.IsTerminalState(session.EngineController.ChessState.Status))
            {
                session.Status = SessionStatus.Completed;
            }

            if (!string.IsNullOrEmpty(actionId))
            {
                await _sessionRepository.TryRecordActionAsync(
                    gameId, actionId, "DrawCard", player.Color.ToString(), session.GameRevision + 1, "{}", "{\"success\":true}");
            }

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
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public Task<bool> SubmitChoice(Guid gameId, string playerToken, string choiceEffectKey) =>
        SubmitChoiceInternal(gameId, playerToken, choiceEffectKey, null, null);

    public Task<bool> SubmitChoiceWithIdempotency(Guid gameId, string playerToken, string choiceEffectKey, string actionId, int? expectedRevision) =>
        SubmitChoiceInternal(gameId, playerToken, choiceEffectKey, actionId, expectedRevision);

    private async Task<bool> SubmitChoiceInternal(Guid gameId, string playerToken, string choiceEffectKey, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        if (!string.IsNullOrEmpty(actionId))
        {
            var cached = await _sessionRepository.GetActionResultAsync(gameId, actionId);
            if (cached != null) return true;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                await RejectActionAsync("REVISION_MISMATCH", session.GameRevision, expectedRevision.Value);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null || player.Color != session.EngineController.ActivePlayer)
            {
                await RejectActionAsync("NOT_YOUR_TURN", session.GameRevision);
                return false;
            }

            var result = session.EngineController.SubmitChoice(player.Color, choiceEffectKey);
            if (!result.IsSuccess)
            {
                await RejectActionAsync("INVALID_CHOICE", session.GameRevision);
                return false;
            }

            session.Status = SessionStatus.InProgress;
            if (_chessEngine.IsTerminalState(session.EngineController.ChessState.Status))
            {
                session.Status = SessionStatus.Completed;
            }

            if (!string.IsNullOrEmpty(actionId))
            {
                await _sessionRepository.TryRecordActionAsync(
                    gameId, actionId, "SubmitChoice", player.Color.ToString(), session.GameRevision + 1, choiceEffectKey, "{\"success\":true}");
            }

            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("EffectChosen", new
            {
                Player = player.Color.ToString(),
                Choice = choiceEffectKey
            });

            await BroadcastStateUpdate(session);
            return true;
        }
        catch (Exception)
        {
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public Task<bool> SubmitMove(Guid gameId, string playerToken, string from, string to, string? promotion) =>
        SubmitMoveInternal(gameId, playerToken, from, to, promotion, null, null);

    public Task<bool> SubmitMoveWithIdempotency(Guid gameId, string playerToken, string from, string to, string? promotion, string actionId, int? expectedRevision) =>
        SubmitMoveInternal(gameId, playerToken, from, to, promotion, actionId, expectedRevision);

    private async Task<bool> SubmitMoveInternal(Guid gameId, string playerToken, string from, string to, string? promotion, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        if (!string.IsNullOrEmpty(actionId))
        {
            var cached = await _sessionRepository.GetActionResultAsync(gameId, actionId);
            if (cached != null) return true;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                await RejectActionAsync("REVISION_MISMATCH", session.GameRevision, expectedRevision.Value);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null || player.Color != session.EngineController.ActivePlayer)
            {
                await RejectActionAsync("NOT_YOUR_TURN", session.GameRevision);
                return false;
            }

            var promoPiece = !string.IsNullOrEmpty(promotion) && Enum.TryParse<PieceType>(promotion, true, out var p) ? p : (PieceType?)null;
            var move = new ChessMove(Square.Parse(from), Square.Parse(to), promoPiece);

            var result = session.EngineController.SubmitChessMove(player.Color, move);
            if (!result.IsSuccess)
            {
                await RejectActionAsync("ILLEGAL_MOVE", session.GameRevision);
                return false;
            }

            session.Status = SessionStatus.InProgress;
            if (_chessEngine.IsTerminalState(session.EngineController.ChessState.Status))
            {
                session.Status = SessionStatus.Completed;
            }

            if (!string.IsNullOrEmpty(actionId))
            {
                await _sessionRepository.TryRecordActionAsync(
                    gameId, actionId, "SubmitMove", player.Color.ToString(), session.GameRevision + 1, $"{from}-{to}", "{\"success\":true}");
            }

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
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
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

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null)
            {
                await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
                return false;
            }

            var result = session.EngineController.Resign(player.Color);
            if (!result.IsSuccess)
            {
                await RejectActionAsync("INVALID_ACTION", session.GameRevision);
                return false;
            }

            session.Status = SessionStatus.Completed;
            await BroadcastStateUpdate(session);
            return true;
        }
        catch (Exception)
        {
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public Task<bool> EndTurn(Guid gameId, string playerToken) =>
        EndTurnInternal(gameId, playerToken, null, null);

    public Task<bool> EndTurnWithIdempotency(Guid gameId, string playerToken, string actionId, int? expectedRevision) =>
        EndTurnInternal(gameId, playerToken, actionId, expectedRevision);

    private async Task<bool> EndTurnInternal(Guid gameId, string playerToken, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        if (!string.IsNullOrEmpty(actionId))
        {
            var cached = await _sessionRepository.GetActionResultAsync(gameId, actionId);
            if (cached != null) return true;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                await RejectActionAsync("REVISION_MISMATCH", session.GameRevision, expectedRevision.Value);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null || player.Color != session.EngineController.ActivePlayer)
            {
                await RejectActionAsync("NOT_YOUR_TURN", session.GameRevision);
                return false;
            }

            var result = session.EngineController.EndTurn(player.Color);
            if (!result.IsSuccess)
            {
                await RejectActionAsync("INVALID_ACTION", session.GameRevision);
                return false;
            }

            if (_chessEngine.IsTerminalState(session.EngineController.ChessState.Status))
            {
                session.Status = SessionStatus.Completed;
            }

            if (!string.IsNullOrEmpty(actionId))
            {
                await _sessionRepository.TryRecordActionAsync(
                    gameId, actionId, "EndTurn", player.Color.ToString(), session.GameRevision + 1, "{}", "{\"success\":true}");
            }

            await BroadcastStateUpdate(session);
            return true;
        }
        catch (Exception)
        {
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public Task<bool> SubmitRevival(Guid gameId, string playerToken, string pieceType, string targetSquare) =>
        SubmitRevivalInternal(gameId, playerToken, pieceType, targetSquare, null, null);

    public Task<bool> SubmitRevivalWithIdempotency(Guid gameId, string playerToken, string pieceType, string targetSquare, string actionId, int? expectedRevision) =>
        SubmitRevivalInternal(gameId, playerToken, pieceType, targetSquare, actionId, expectedRevision);

    private async Task<bool> SubmitRevivalInternal(Guid gameId, string playerToken, string pieceType, string targetSquare, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        if (!string.IsNullOrEmpty(actionId))
        {
            var cached = await _sessionRepository.GetActionResultAsync(gameId, actionId);
            if (cached != null) return true;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                await RejectActionAsync("REVISION_MISMATCH", session.GameRevision, expectedRevision.Value);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null || player.Color != session.EngineController.ActivePlayer)
            {
                await RejectActionAsync("NOT_YOUR_TURN", session.GameRevision);
                return false;
            }

            if (!Enum.TryParse<PieceType>(pieceType, true, out var piece))
            {
                await RejectActionAsync("INVALID_PIECE", session.GameRevision);
                return false;
            }

            var result = session.EngineController.SubmitRevival(player.Color, piece, Square.Parse(targetSquare));
            if (!result.IsSuccess)
            {
                await RejectActionAsync("INVALID_REVIVAL", session.GameRevision);
                return false;
            }

            session.Status = SessionStatus.InProgress;
            if (_chessEngine.IsTerminalState(session.EngineController.ChessState.Status))
            {
                session.Status = SessionStatus.Completed;
            }

            if (!string.IsNullOrEmpty(actionId))
            {
                await _sessionRepository.TryRecordActionAsync(
                    gameId, actionId, "SubmitRevival", player.Color.ToString(), session.GameRevision + 1, $"{pieceType}-{targetSquare}", "{\"success\":true}");
            }

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
        catch (Exception)
        {
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public Task<bool> SubmitSwap(Guid gameId, string playerToken, string sq1, string sq2) =>
        SubmitSwapInternal(gameId, playerToken, sq1, sq2, null, null);

    public Task<bool> SubmitSwapWithIdempotency(Guid gameId, string playerToken, string sq1, string sq2, string actionId, int? expectedRevision) =>
        SubmitSwapInternal(gameId, playerToken, sq1, sq2, actionId, expectedRevision);

    private async Task<bool> SubmitSwapInternal(Guid gameId, string playerToken, string sq1, string sq2, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        if (!string.IsNullOrEmpty(actionId))
        {
            var cached = await _sessionRepository.GetActionResultAsync(gameId, actionId);
            if (cached != null) return true;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (IsSessionTerminal(session))
            {
                await RejectActionAsync("SESSION_TERMINAL", session.GameRevision);
                return false;
            }

            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                await RejectActionAsync("REVISION_MISMATCH", session.GameRevision, expectedRevision.Value);
                return false;
            }

            var player = GetAuthenticatedPlayer(session, playerToken);
            if (player == null || player.Color != session.EngineController.ActivePlayer)
            {
                await RejectActionAsync("NOT_YOUR_TURN", session.GameRevision);
                return false;
            }

            var result = session.EngineController.SubmitSwap(player.Color, Square.Parse(sq1), Square.Parse(sq2));
            if (!result.IsSuccess)
            {
                await RejectActionAsync("INVALID_SWAP", session.GameRevision);
                return false;
            }

            session.Status = SessionStatus.InProgress;
            if (_chessEngine.IsTerminalState(session.EngineController.ChessState.Status))
            {
                session.Status = SessionStatus.Completed;
            }

            if (!string.IsNullOrEmpty(actionId))
            {
                await _sessionRepository.TryRecordActionAsync(
                    gameId, actionId, "SubmitSwap", player.Color.ToString(), session.GameRevision + 1, $"{sq1}-{sq2}", "{\"success\":true}");
            }

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
        catch (Exception)
        {
            await RejectActionAsync("INVALID_ACTION", session.GameRevision);
            return false;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    private async Task RejectActionAsync(string reason, int currentRevision, int? expectedRevision = null)
    {
        await Clients.Caller.SendAsync("ActionRejected", new
        {
            Reason = reason,
            CurrentRevision = currentRevision,
            ExpectedRevision = expectedRevision
        });
    }

    private async Task BroadcastStateUpdate(GameSession session)
    {
        var groupName = GetGroupName(session.GameId);
        var engine = session.EngineController;
        session.GameRevision++;
        await _sessionRepository.UpdateSessionAsync(session);

        var legalMoves = engine.GetLegalMoves().Select(m => m.ToString()).ToList();

        await Clients.Group(groupName).SendAsync("GameStateUpdated", new
        {
            BoardFen = engine.ChessState.Fen,
            ActivePlayer = engine.ActivePlayer.ToString(),
            TurnPhase = engine.CurrentTurn.Phase.ToString(),
            RemainingMoves = engine.CurrentTurn.RemainingMoves,
            RemainingRevivals = engine.CurrentTurn.RemainingRevivals,
            CanSwap = engine.CurrentTurn.CanSwap,
            AvailableChoices = engine.CurrentTurn.AvailableChoices,
            InCheck = engine.ChessState.InCheck,
            GameStatus = engine.ChessState.Status.ToString(),
            Winner = engine.ChessState.Winner?.ToString(),
            Revision = session.GameRevision,
            SessionStatus = session.Status.ToString(),
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

    private static bool IsSessionTerminal(GameSession session) =>
        session.Status == SessionStatus.Completed ||
        session.Status == SessionStatus.Expired ||
        session.Status == SessionStatus.Cancelled;

    private static PlayerSession? GetAuthenticatedPlayer(GameSession session, string token)
    {
        if (session.PlayerWhite?.SecretToken == token) return session.PlayerWhite;
        if (session.PlayerBlack?.SecretToken == token) return session.PlayerBlack;
        return null;
    }

    private static string GetGroupName(Guid gameId) => $"game-{gameId}";
}
