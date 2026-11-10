using System;
using System.Collections.Concurrent;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Decks;
using ChessUno.Core.Domain.Common;
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
}

public class InMemoryGameSessionRepository : IGameSessionRepository
{
    private readonly ConcurrentDictionary<Guid, GameSession> _sessionsById = new();
    private readonly ConcurrentDictionary<string, Guid> _sessionIdsByToken = new();
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
}

