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
        if (session.AuthenticatePlayer(playerToken, PlayerColor.White))
        {
            authenticatedPlayer = session.PlayerWhite;
        }
        else if (session.AuthenticatePlayer(playerToken, PlayerColor.Black))
        {
            authenticatedPlayer = session.PlayerBlack;
        }

        if (authenticatedPlayer == null)
        {
            return false;
        }

        var groupName = GetGroupName(gameId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        bool wasConnected = authenticatedPlayer.IsConnected;
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

        // Notify opponent when player connects or reconnects for the first time
        if (!wasConnected)
        {
            await Clients.OthersInGroup(groupName).SendAsync("PlayerConnected", new
            {
                PlayerName = authenticatedPlayer.PlayerName,
                Color = authenticatedPlayer.Color.ToString(),
                IsReconnected = false,
                Revision = session.GameRevision
            });
        }

        return true;
    }

    public async Task<bool> SendSignal(Guid gameId, string playerToken, string signalType, string payload)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        bool isAuthorized = session.AuthenticatePlayer(playerToken, PlayerColor.White) ||
                            session.AuthenticatePlayer(playerToken, PlayerColor.Black);

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

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        string cardName = "";
        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            actionId,
            "DrawCard",
            player.Color,
            expectedRevision,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                if (player.Color != s.EngineController.ActivePlayer) return (false, "NOT_YOUR_TURN");

                try
                {
                    var drawn = s.EngineController.DrawCard(player.Color);
                    cardName = drawn.Name;
                    s.Status = SessionStatus.InProgress;
                    if (_chessEngine.IsTerminalState(s.EngineController.ChessState.Status))
                    {
                        s.Status = SessionStatus.Completed;
                    }
                    return (true, null);
                }
                catch
                {
                    return (false, "INVALID_ACTION");
                }
            },
            payloadJson: System.Text.Json.JsonSerializer.Serialize(new { action = "DrawCard" })
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision, expectedRevision);
            return false;
        }

        if (!result.IsIdempotentReplay)
        {
            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("CardDrawn", new
            {
                Player = player.Color.ToString(),
                CardName = cardName,
                RemainingDeckCount = session.EngineController.DeckManager.RemainingCount
            });

            await BroadcastCommittedStateUpdate(session);
        }

        return true;
    }

    public Task<bool> SubmitChoice(Guid gameId, string playerToken, string choiceEffectKey) =>
        SubmitChoiceInternal(gameId, playerToken, choiceEffectKey, null, null);

    public Task<bool> SubmitChoiceWithIdempotency(Guid gameId, string playerToken, string choiceEffectKey, string actionId, int? expectedRevision) =>
        SubmitChoiceInternal(gameId, playerToken, choiceEffectKey, actionId, expectedRevision);

    private async Task<bool> SubmitChoiceInternal(Guid gameId, string playerToken, string choiceEffectKey, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            actionId,
            "SubmitChoice",
            player.Color,
            expectedRevision,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                if (player.Color != s.EngineController.ActivePlayer) return (false, "NOT_YOUR_TURN");

                var choiceRes = s.EngineController.SubmitChoice(player.Color, choiceEffectKey);
                if (!choiceRes.IsSuccess) return (false, "INVALID_CHOICE");

                s.Status = SessionStatus.InProgress;
                if (_chessEngine.IsTerminalState(s.EngineController.ChessState.Status))
                {
                    s.Status = SessionStatus.Completed;
                }
                return (true, null);
            },
            payloadJson: System.Text.Json.JsonSerializer.Serialize(new { choiceEffectKey })
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision, expectedRevision);
            return false;
        }

        if (!result.IsIdempotentReplay)
        {
            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("EffectChosen", new
            {
                Player = player.Color.ToString(),
                Choice = choiceEffectKey
            });

            await BroadcastCommittedStateUpdate(session);
        }

        return true;
    }

    public Task<bool> SubmitMove(Guid gameId, string playerToken, string from, string to, string? promotion) =>
        SubmitMoveInternal(gameId, playerToken, from, to, promotion, null, null);

    public Task<bool> SubmitMoveWithIdempotency(Guid gameId, string playerToken, string from, string to, string? promotion, string actionId, int? expectedRevision) =>
        SubmitMoveInternal(gameId, playerToken, from, to, promotion, actionId, expectedRevision);

    private async Task<bool> SubmitMoveInternal(Guid gameId, string playerToken, string from, string to, string? promotion, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        var promoPiece = !string.IsNullOrEmpty(promotion) && Enum.TryParse<PieceType>(promotion, true, out var p) ? p : (PieceType?)null;
        var move = new ChessMove(Square.Parse(from), Square.Parse(to), promoPiece);

        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            actionId,
            "SubmitMove",
            player.Color,
            expectedRevision,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                if (player.Color != s.EngineController.ActivePlayer) return (false, "NOT_YOUR_TURN");

                var moveResult = s.EngineController.SubmitChessMove(player.Color, move);
                if (!moveResult.IsSuccess) return (false, "ILLEGAL_MOVE");

                s.Status = SessionStatus.InProgress;
                if (_chessEngine.IsTerminalState(s.EngineController.ChessState.Status))
                {
                    s.Status = SessionStatus.Completed;
                }
                return (true, null);
            },
            payloadJson: System.Text.Json.JsonSerializer.Serialize(new { from, to, promotion })
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision, expectedRevision);
            return false;
        }

        if (!result.IsIdempotentReplay)
        {
            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("MoveAccepted", new
            {
                Player = player.Color.ToString(),
                From = from,
                To = to,
                BoardFen = session.EngineController.ChessState.Fen
            });

            await BroadcastCommittedStateUpdate(session);
        }

        return true;
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
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            null,
            "Resign",
            player.Color,
            null,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                var resignRes = s.EngineController.Resign(player.Color);
                if (!resignRes.IsSuccess) return (false, "INVALID_ACTION");
                s.Status = SessionStatus.Completed;
                return (true, null);
            }
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision);
            return false;
        }

        await BroadcastCommittedStateUpdate(session);
        return true;
    }

    public Task<bool> EndTurn(Guid gameId, string playerToken) =>
        EndTurnInternal(gameId, playerToken, null, null);

    public Task<bool> EndTurnWithIdempotency(Guid gameId, string playerToken, string actionId, int? expectedRevision) =>
        EndTurnInternal(gameId, playerToken, actionId, expectedRevision);

    private async Task<bool> EndTurnInternal(Guid gameId, string playerToken, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            actionId,
            "EndTurn",
            player.Color,
            expectedRevision,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                if (player.Color != s.EngineController.ActivePlayer) return (false, "NOT_YOUR_TURN");

                var turnRes = s.EngineController.EndTurn(player.Color);
                if (!turnRes.IsSuccess) return (false, "INVALID_ACTION");

                if (_chessEngine.IsTerminalState(s.EngineController.ChessState.Status))
                {
                    s.Status = SessionStatus.Completed;
                }
                return (true, null);
            },
            payloadJson: System.Text.Json.JsonSerializer.Serialize(new { action = "EndTurn" })
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision, expectedRevision);
            return false;
        }

        if (!result.IsIdempotentReplay)
        {
            await BroadcastCommittedStateUpdate(session);
        }

        return true;
    }

    public Task<bool> SubmitRevival(Guid gameId, string playerToken, string pieceType, string targetSquare) =>
        SubmitRevivalInternal(gameId, playerToken, pieceType, targetSquare, null, null);

    public Task<bool> SubmitRevivalWithIdempotency(Guid gameId, string playerToken, string pieceType, string targetSquare, string actionId, int? expectedRevision) =>
        SubmitRevivalInternal(gameId, playerToken, pieceType, targetSquare, actionId, expectedRevision);

    private async Task<bool> SubmitRevivalInternal(Guid gameId, string playerToken, string pieceType, string targetSquare, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        if (!Enum.TryParse<PieceType>(pieceType, true, out var piece))
        {
            await RejectActionAsync("INVALID_PIECE", session.GameRevision);
            return false;
        }

        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            actionId,
            "SubmitRevival",
            player.Color,
            expectedRevision,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                if (player.Color != s.EngineController.ActivePlayer) return (false, "NOT_YOUR_TURN");

                var revivalRes = s.EngineController.SubmitRevival(player.Color, piece, Square.Parse(targetSquare));
                if (!revivalRes.IsSuccess) return (false, "INVALID_REVIVAL");

                s.Status = SessionStatus.InProgress;
                if (_chessEngine.IsTerminalState(s.EngineController.ChessState.Status))
                {
                    s.Status = SessionStatus.Completed;
                }
                return (true, null);
            },
            payloadJson: System.Text.Json.JsonSerializer.Serialize(new { pieceType, targetSquare })
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision, expectedRevision);
            return false;
        }

        if (!result.IsIdempotentReplay)
        {
            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("PieceRevived", new
            {
                Player = player.Color.ToString(),
                Piece = pieceType,
                TargetSquare = targetSquare,
                BoardFen = session.EngineController.ChessState.Fen
            });

            await BroadcastCommittedStateUpdate(session);
        }

        return true;
    }

    public Task<bool> SubmitSwap(Guid gameId, string playerToken, string sq1, string sq2) =>
        SubmitSwapInternal(gameId, playerToken, sq1, sq2, null, null);

    public Task<bool> SubmitSwapWithIdempotency(Guid gameId, string playerToken, string sq1, string sq2, string actionId, int? expectedRevision) =>
        SubmitSwapInternal(gameId, playerToken, sq1, sq2, actionId, expectedRevision);

    private async Task<bool> SubmitSwapInternal(Guid gameId, string playerToken, string sq1, string sq2, string? actionId, int? expectedRevision)
    {
        var session = await _sessionRepository.GetByIdAsync(gameId);
        if (session == null) return false;

        var player = GetAuthenticatedPlayer(session, playerToken);
        if (player == null)
        {
            await RejectActionAsync("UNAUTHORIZED", session.GameRevision);
            return false;
        }

        var result = await _sessionRepository.ExecuteActionAtomicallyAsync(
            gameId,
            actionId,
            "SubmitSwap",
            player.Color,
            expectedRevision,
            s =>
            {
                if (IsSessionTerminal(s)) return (false, "SESSION_TERMINAL");
                if (player.Color != s.EngineController.ActivePlayer) return (false, "NOT_YOUR_TURN");

                var swapRes = s.EngineController.SubmitSwap(player.Color, Square.Parse(sq1), Square.Parse(sq2));
                if (!swapRes.IsSuccess) return (false, "INVALID_SWAP");

                s.Status = SessionStatus.InProgress;
                if (_chessEngine.IsTerminalState(s.EngineController.ChessState.Status))
                {
                    s.Status = SessionStatus.Completed;
                }
                return (true, null);
            },
            payloadJson: System.Text.Json.JsonSerializer.Serialize(new { sq1, sq2 })
        );

        if (!result.Success)
        {
            await RejectActionAsync(result.ErrorCode ?? "INVALID_ACTION", session.GameRevision, expectedRevision);
            return false;
        }

        if (!result.IsIdempotentReplay)
        {
            var groupName = GetGroupName(gameId);
            await Clients.Group(groupName).SendAsync("PiecesSwapped", new
            {
                Player = player.Color.ToString(),
                Square1 = sq1,
                Square2 = sq2,
                BoardFen = session.EngineController.ChessState.Fen
            });

            await BroadcastCommittedStateUpdate(session);
        }

        return true;
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

    private async Task BroadcastCommittedStateUpdate(GameSession session)
    {
        var groupName = GetGroupName(session.GameId);
        var engine = session.EngineController;

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

    private Task BroadcastStateUpdate(GameSession session) => BroadcastCommittedStateUpdate(session);

    private static bool IsSessionTerminal(GameSession session) =>
        session.Status == SessionStatus.Completed ||
        session.Status == SessionStatus.Expired ||
        session.Status == SessionStatus.Cancelled;

    private static PlayerSession? GetAuthenticatedPlayer(GameSession session, string token)
    {
        if (session.AuthenticatePlayer(token, PlayerColor.White)) return session.PlayerWhite;
        if (session.AuthenticatePlayer(token, PlayerColor.Black)) return session.PlayerBlack;
        return null;
    }

    private static string GetGroupName(Guid gameId) => $"game-{gameId}";
}
