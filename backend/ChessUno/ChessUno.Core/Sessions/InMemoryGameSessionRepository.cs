using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Decks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Effects;
using ChessUno.Core.GameEngine;
using ChessUno.Core.Turn;
using ChessUno.Core.Validation;

namespace ChessUno.Core.Sessions;

public interface IGameSessionRepository
{
    Task<GameSession> CreateSessionAsync(string creatorName, int? seed = null);
    Task<GameSession?> GetByIdAsync(Guid gameId);
    Task<GameSession?> GetByInvitationTokenAsync(string token);
    Task<(GameSession Session, PlayerSession Player)?> JoinSessionAsync(string invitationToken, string playerName);
    Task<bool> UpdateSessionAsync(GameSession session);
    Task<bool> CancelSessionAsync(Guid gameId, string playerToken);
    Task<int> CleanupExpiredSessionsAsync();
    Task<string> ExportSessionSnapshotJsonAsync(Guid gameId);
    Task<GameSession?> RestoreSessionSnapshotJsonAsync(string snapshotJson);
    Task<bool> TryRecordActionAsync(Guid gameId, string actionId, string actionType, string playerToken, int expectedRevision, string payloadJson, string resultJson);
    Task<string?> GetActionResultAsync(Guid gameId, string actionId);
    Task<bool> UpdatePlayerConnectionStatusAsync(Guid gameId, PlayerColor color, bool isConnected);
}

public class InMemoryGameSessionRepository : IGameSessionRepository
{
    private readonly ConcurrentDictionary<Guid, GameSession> _sessionsById = new();
    private readonly ConcurrentDictionary<string, Guid> _sessionIdsByToken = new();
    private readonly ConcurrentDictionary<string, string> _actionResultsById = new();
    private readonly GameConfig _config;
    private readonly ICardRepository _cardRepository;
    private readonly IChessEngine _chessEngine;

    public InMemoryGameSessionRepository(string? configPath = null)
    {
        var resolvedPath = configPath ?? FindDefaultConfigPath();
        var json = File.ReadAllText(resolvedPath);
        _config = JsonSerializer.Deserialize<GameConfig>(json)!;

        var repo = new JsonCardRepository();
        repo.LoadFromJson(json);
        _cardRepository = repo;

        _chessEngine = new ChessEngine();
    }

    private static string FindDefaultConfigPath()
    {
        var current = AppContext.BaseDirectory;
        while (!string.IsNullOrEmpty(current))
        {
            var testPath = Path.Combine(current, "configs", "chess-uno.json");
            if (File.Exists(testPath)) return testPath;
            var parent = Directory.GetParent(current);
            if (parent == null) break;
            current = parent.FullName;
        }
        throw new FileNotFoundException("Cannot locate configs/chess-uno.json.");
    }

    public Task<GameSession> CreateSessionAsync(string creatorName, int? seed = null)
    {
        var gameId = Guid.NewGuid();
        var invitationToken = GameSession.GenerateSecureToken(16);
        var creatorToken = GameSession.GenerateSecureToken(24);

        var creator = new PlayerSession(
            PlayerId: Guid.NewGuid(),
            PlayerName: string.IsNullOrWhiteSpace(creatorName) ? "Player 1" : creatorName,
            Color: PlayerColor.White,
            SecretToken: creatorToken
        );

        var cardDefs = _cardRepository.LoadFromPath(FindDefaultConfigPath());
        var deckManager = new DeckManager(cardDefs, seed);
        var effectRegistry = new CardEffectRegistry();
        var effectExecutor = new CardEffectExecutor(_config, effectRegistry, _chessEngine);
        var validator = new CardValidator();
        var initialGame = _chessEngine.CreateInitialGame(_config.SchemaVersion);

        var engineController = new TurnController(_config, _chessEngine, deckManager, effectExecutor, validator, initialGame);

        var session = new GameSession(gameId, invitationToken, creator, engineController);

        _sessionsById[gameId] = session;
        _sessionIdsByToken[invitationToken] = gameId;

        return Task.FromResult(session);
    }

    public Task<GameSession?> GetByIdAsync(Guid gameId)
    {
        _sessionsById.TryGetValue(gameId, out var session);
        return Task.FromResult(session);
    }

    public Task<GameSession?> GetByInvitationTokenAsync(string token)
    {
        if (_sessionIdsByToken.TryGetValue(token, out var gameId) && _sessionsById.TryGetValue(gameId, out var session))
        {
            return Task.FromResult<GameSession?>(session);
        }
        return Task.FromResult<GameSession?>(null);
    }

    public Task<(GameSession Session, PlayerSession Player)?> JoinSessionAsync(string invitationToken, string playerName)
    {
        if (!_sessionIdsByToken.TryGetValue(invitationToken, out var gameId) || !_sessionsById.TryGetValue(gameId, out var session))
        {
            return Task.FromResult<(GameSession, PlayerSession)?>(null);
        }

        lock (session)
        {
            if (session.Status != SessionStatus.WaitingForPlayer || session.PlayerBlack != null)
            {
                return Task.FromResult<(GameSession, PlayerSession)?>(null);
            }

            var blackToken = GameSession.GenerateSecureToken(24);
            var opponent = new PlayerSession(
                PlayerId: Guid.NewGuid(),
                PlayerName: string.IsNullOrWhiteSpace(playerName) ? "Player 2" : playerName,
                Color: PlayerColor.Black,
                SecretToken: blackToken
            );

            session.PlayerBlack = opponent;
            session.Status = SessionStatus.Ready;
            session.GameRevision++;

            return Task.FromResult<(GameSession, PlayerSession)?>((session, opponent));
        }
    }

    public Task<bool> UpdateSessionAsync(GameSession session)
    {
        _sessionsById[session.GameId] = session;
        return Task.FromResult(true);
    }

    public Task<bool> CancelSessionAsync(Guid gameId, string playerToken)
    {
        if (!_sessionsById.TryGetValue(gameId, out var session)) return Task.FromResult(false);

        lock (session)
        {
            bool isAuthorized = (session.PlayerWhite?.SecretToken == playerToken) ||
                                (session.PlayerBlack?.SecretToken == playerToken);

            if (!isAuthorized) return Task.FromResult(false);

            if (session.Status == SessionStatus.Completed || session.Status == SessionStatus.Expired)
            {
                return Task.FromResult(false);
            }

            session.Status = SessionStatus.Cancelled;
            session.GameRevision++;
            return Task.FromResult(true);
        }
    }

    public Task<int> CleanupExpiredSessionsAsync()
    {
        int count = 0;
        var now = DateTimeOffset.UtcNow;
        foreach (var session in _sessionsById.Values)
        {
            if (session.ExpiresAt.HasValue && session.ExpiresAt.Value <= now)
            {
                if (session.Status != SessionStatus.Completed && session.Status != SessionStatus.Cancelled)
                {
                    session.Status = SessionStatus.Expired;
                    count++;
                }
            }
        }
        return Task.FromResult(count);
    }

    public Task<string> ExportSessionSnapshotJsonAsync(Guid gameId)
    {
        if (!_sessionsById.TryGetValue(gameId, out var session))
        {
            throw new InvalidOperationException($"Game session '{gameId}' not found.");
        }

        lock (session)
        {
            var controller = session.EngineController;
            var chess = controller.ChessState;

            var snapshot = new GameSessionSnapshot(
                GameId: session.GameId,
                InvitationToken: session.InvitationToken,
                Status: session.Status,
                PlayerWhite: session.PlayerWhite,
                PlayerBlack: session.PlayerBlack,
                CreatedAt: session.CreatedAt,
                ExpiresAt: session.ExpiresAt,
                GameRevision: session.GameRevision,
                BoardFen: chess.Fen,
                ConfigVersion: chess.ConfigVersion,
                EventSequenceNumber: chess.EventSequenceNumber,
                GameStatus: chess.Status,
                Winner: chess.Winner,
                InCheck: chess.InCheck,
                HalfMoveClock: chess.HalfMoveClock,
                FullMoveNumber: chess.FullMoveNumber,
                Reserves: chess.Reserves,
                MoveHistory: chess.MoveHistory,
                TurnState: controller.CurrentTurn,
                DrawDeck: controller.DeckManager.PeekAll(),
                DiscardPile: controller.DeckManager.PeekDiscard()
            );

            var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
            return Task.FromResult(json);
        }
    }

    public Task<GameSession?> RestoreSessionSnapshotJsonAsync(string snapshotJson)
    {
        var snapshot = JsonSerializer.Deserialize<GameSessionSnapshot>(snapshotJson);
        if (snapshot == null) return Task.FromResult<GameSession?>(null);

        var gameState = new GameState(
            GameId: snapshot.GameId,
            ConfigVersion: snapshot.ConfigVersion,
            EventSequenceNumber: snapshot.EventSequenceNumber,
            Fen: snapshot.BoardFen,
            ActivePlayer: snapshot.TurnState.ActivePlayer,
            Status: snapshot.GameStatus,
            Winner: snapshot.Winner,
            InCheck: snapshot.InCheck,
            HalfMoveClock: snapshot.HalfMoveClock,
            FullMoveNumber: snapshot.FullMoveNumber,
            Reserves: snapshot.Reserves,
            MoveHistory: snapshot.MoveHistory
        );

        var deckManager = new DeckManager(snapshot.DrawDeck, snapshot.DiscardPile);
        var effectRegistry = new CardEffectRegistry();
        var effectExecutor = new CardEffectExecutor(_config, effectRegistry, _chessEngine);
        var validator = new CardValidator();

        var controller = new TurnController(
            _config,
            _chessEngine,
            deckManager,
            effectExecutor,
            validator,
            gameState,
            snapshot.TurnState,
            snapshot.EventSequenceNumber + 1
        );

        var session = new GameSession(
            snapshot.GameId,
            snapshot.InvitationToken,
            snapshot.PlayerWhite!,
            controller
        )
        {
            PlayerBlack = snapshot.PlayerBlack,
            Status = snapshot.Status,
            CreatedAt = snapshot.CreatedAt,
            ExpiresAt = snapshot.ExpiresAt,
            GameRevision = snapshot.GameRevision
        };

        _sessionsById[session.GameId] = session;
        _sessionIdsByToken[session.InvitationToken] = session.GameId;

        return Task.FromResult<GameSession?>(session);
    }

    public Task<bool> TryRecordActionAsync(Guid gameId, string actionId, string actionType, string playerToken, int expectedRevision, string payloadJson, string resultJson)
    {
        var key = $"{gameId}_{actionId}";
        var added = _actionResultsById.TryAdd(key, resultJson);
        return Task.FromResult(added);
    }

    public Task<string?> GetActionResultAsync(Guid gameId, string actionId)
    {
        var key = $"{gameId}_{actionId}";
        _actionResultsById.TryGetValue(key, out var res);
        return Task.FromResult(res);
    }

    public Task<bool> UpdatePlayerConnectionStatusAsync(Guid gameId, PlayerColor color, bool isConnected)
    {
        if (_sessionsById.TryGetValue(gameId, out var session))
        {
            if (color == PlayerColor.White && session.PlayerWhite != null)
            {
                session.PlayerWhite = session.PlayerWhite with { IsConnected = isConnected };
                return Task.FromResult(true);
            }
            if (color == PlayerColor.Black && session.PlayerBlack != null)
            {
                session.PlayerBlack = session.PlayerBlack with { IsConnected = isConnected };
                return Task.FromResult(true);
            }
        }
        return Task.FromResult(false);
    }
}
