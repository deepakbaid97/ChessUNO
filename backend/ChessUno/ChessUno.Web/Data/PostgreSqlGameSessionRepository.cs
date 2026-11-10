using System;
using System.Collections.Concurrent;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Decks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Effects;
using ChessUno.Core.GameEngine;
using ChessUno.Core.Sessions;
using ChessUno.Core.Turn;
using ChessUno.Core.Validation;
using Microsoft.EntityFrameworkCore;

namespace ChessUno.Web.Data;

public class PostgreSqlGameSessionRepository : IGameSessionRepository
{
    private readonly IDbContextFactory<ChessUnoDbContext> _dbContextFactory;
    private readonly ConcurrentDictionary<Guid, GameSession> _sessionsById = new();
    private readonly ConcurrentDictionary<string, Guid> _sessionIdsByTokenHash = new();
    private readonly GameConfig _config;
    private readonly ICardRepository _cardRepository;
    private readonly IChessEngine _chessEngine;

    public PostgreSqlGameSessionRepository(IDbContextFactory<ChessUnoDbContext> dbContextFactory, string? configPath = null)
    {
        _dbContextFactory = dbContextFactory;

        var resolvedPath = configPath ?? FindDefaultConfigPath();
        var json = File.ReadAllText(resolvedPath);
        _config = JsonSerializer.Deserialize<GameConfig>(json)!;

        var repo = new JsonCardRepository();
        repo.LoadFromJson(json);
        _cardRepository = repo;

        _chessEngine = new ChessEngine();
    }

    public PostgreSqlGameSessionRepository(DbContextOptions<ChessUnoDbContext> options, string? configPath = null)
        : this(new OptionsDbContextFactory(options), configPath)
    {
    }

    public PostgreSqlGameSessionRepository(ChessUnoDbContext dbContext, string? configPath = null)
        : this(new NonDisposingDbContextFactory(dbContext), configPath)
    {
    }

    private class OptionsDbContextFactory : IDbContextFactory<ChessUnoDbContext>
    {
        private readonly DbContextOptions<ChessUnoDbContext> _options;
        public OptionsDbContextFactory(DbContextOptions<ChessUnoDbContext> options) => _options = options;
        public ChessUnoDbContext CreateDbContext() => new ChessUnoDbContext(_options);
    }

    private class NonDisposingDbContextFactory : IDbContextFactory<ChessUnoDbContext>
    {
        private readonly ChessUnoDbContext _dbContext;
        public NonDisposingDbContextFactory(ChessUnoDbContext dbContext) => _dbContext = dbContext;
        public ChessUnoDbContext CreateDbContext() => _dbContext;
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

    public static async Task<int> SanitizeAllExistingSnapshotsAsync(ChessUnoDbContext db)
    {
        var legacySessions = await db.Sessions
            .Where(s => s.SnapshotJson.Contains("SecretToken") || s.SnapshotJson.Contains("\"InvitationToken\""))
            .ToListAsync();

        int sanitizedCount = 0;
        foreach (var entity in legacySessions)
        {
            var clean = LegacySnapshotSanitizer.Sanitize(entity.SnapshotJson);
            if (clean != entity.SnapshotJson)
            {
                entity.SnapshotJson = clean;
                sanitizedCount++;
            }
        }

        if (sanitizedCount > 0)
        {
            await db.SaveChangesAsync();
        }

        return sanitizedCount;
    }

    private ChessUnoDbContext CreateContext() => _dbContextFactory.CreateDbContext();

    public async Task<GameSession> CreateSessionAsync(string creatorName, int? seed = null)
    {
        var gameId = Guid.NewGuid();
        var invitationToken = GameSession.GenerateSecureToken(16);
        var creatorToken = GameSession.GenerateSecureToken(24);

        var creator = PlayerSession.Create(
            playerId: Guid.NewGuid(),
            playerName: string.IsNullOrWhiteSpace(creatorName) ? "Player 1" : creatorName,
            color: PlayerColor.White,
            secretToken: creatorToken,
            isConnected: false
        );

        var cardDefs = _cardRepository.LoadFromPath(FindDefaultConfigPath());
        var deckManager = new DeckManager(cardDefs, seed);
        var effectRegistry = new CardEffectRegistry();
        var effectExecutor = new CardEffectExecutor(_config, effectRegistry, _chessEngine);
        var validator = new CardValidator();
        var initialGame = _chessEngine.CreateInitialGame(_config.SchemaVersion);

        var engineController = new TurnController(_config, _chessEngine, deckManager, effectExecutor, validator, initialGame);
        var session = new GameSession(gameId, TokenHasher.HashToken(invitationToken), creator, engineController, rawInvitationToken: invitationToken);

        var snapshotJson = CreateSnapshotJson(session);

        var entity = new GameSessionEntity
        {
            GameId = session.GameId,
            InvitationTokenHash = session.InvitationTokenHash,
            Status = session.Status,
            PlayerWhiteId = creator.PlayerId,
            PlayerWhiteName = creator.PlayerName,
            PlayerWhiteTokenHash = creator.TokenHash,
            PlayerWhiteConnected = false,
            BoardFen = session.EngineController.ChessState.Fen,
            GameRevision = session.GameRevision,
            CreatedAt = session.CreatedAt,
            UpdatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = session.ExpiresAt,
            SnapshotJson = snapshotJson
        };

        var db = CreateContext();
        try
        {
            db.Sessions.Add(entity);
            await db.SaveChangesAsync();
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }

        _sessionsById[gameId] = session;
        _sessionIdsByTokenHash[session.InvitationTokenHash] = gameId;

        return session;
    }

    public async Task<GameSession?> GetByIdAsync(Guid gameId)
    {
        if (_sessionsById.TryGetValue(gameId, out var cached))
        {
            return cached;
        }

        var db = CreateContext();
        try
        {
            var entity = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.GameId == gameId);
            if (entity == null)
            {
                return null;
            }

            var session = RestoreFromSnapshotJson(entity.SnapshotJson);
            if (session != null)
            {
                _sessionsById[session.GameId] = session;
                _sessionIdsByTokenHash[session.InvitationTokenHash] = session.GameId;
            }

            return session;
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }
    }

    public async Task<GameSession?> GetByInvitationTokenAsync(string token)
    {
        var tokenHash = TokenHasher.HashToken(token);
        if (_sessionIdsByTokenHash.TryGetValue(tokenHash, out var gameId) && _sessionsById.TryGetValue(gameId, out var cached))
        {
            return cached;
        }

        var db = CreateContext();
        try
        {
            var entity = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.InvitationTokenHash == tokenHash);
            if (entity == null)
            {
                return null;
            }

            var session = RestoreFromSnapshotJson(entity.SnapshotJson);
            if (session != null)
            {
                _sessionsById[session.GameId] = session;
                _sessionIdsByTokenHash[session.InvitationTokenHash] = session.GameId;
            }

            return session;
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }
    }

    public async Task<(GameSession Session, PlayerSession Player)?> JoinSessionAsync(string invitationToken, string playerName)
    {
        var session = await GetByInvitationTokenAsync(invitationToken);
        if (session == null)
        {
            return null;
        }

        await session.SessionLock.WaitAsync();
        try
        {
            if (session.Status != SessionStatus.WaitingForPlayer || session.PlayerBlack != null)
            {
                return null;
            }

            var previousSnapshotJson = CreateSnapshotJson(session);

            var blackToken = GameSession.GenerateSecureToken(24);
            var opponent = PlayerSession.Create(
                playerId: Guid.NewGuid(),
                playerName: string.IsNullOrWhiteSpace(playerName) ? "Player 2" : playerName,
                color: PlayerColor.Black,
                secretToken: blackToken,
                isConnected: false
            );

            var db = CreateContext();
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync();
                var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == session.GameId);
                if (entity == null || entity.Status != SessionStatus.WaitingForPlayer || entity.PlayerBlackId != null)
                {
                    await tx.RollbackAsync();
                    return null;
                }

                if (entity.GameRevision != session.GameRevision)
                {
                    await tx.RollbackAsync();
                    RestoreSessionInPlace(session, entity.SnapshotJson);
                    return null;
                }

                var newRevision = session.GameRevision + 1;
                session.PlayerBlack = opponent;
                session.Status = SessionStatus.Ready;
                session.GameRevision = newRevision;

                var snapshotJson = CreateSnapshotJson(session);

                entity.PlayerBlackId = opponent.PlayerId;
                entity.PlayerBlackName = opponent.PlayerName;
                entity.PlayerBlackTokenHash = opponent.TokenHash;
                entity.Status = session.Status;
                entity.GameRevision = newRevision;
                entity.UpdatedAt = DateTimeOffset.UtcNow;
                entity.SnapshotJson = snapshotJson;

                await db.SaveChangesAsync();
                await tx.CommitAsync();

                return (session, opponent);
            }
            catch
            {
                RestoreSessionInPlace(session, previousSnapshotJson);
                throw;
            }
            finally
            {
                if (_dbContextFactory is not NonDisposingDbContextFactory)
                {
                    await db.DisposeAsync();
                }
            }
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public async Task<bool> UpdateSessionAsync(GameSession session)
    {
        await session.SessionLock.WaitAsync();
        try
        {
            _sessionsById[session.GameId] = session;
            var previousSnapshotJson = CreateSnapshotJson(session);

            var db = CreateContext();
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync();
                var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == session.GameId);
                if (entity != null)
                {
                    if (entity.GameRevision != session.GameRevision)
                    {
                        await tx.RollbackAsync();
                        RestoreSessionInPlace(session, entity.SnapshotJson);
                        return false;
                    }

                    var snapshotJson = CreateSnapshotJson(session);
                    entity.BoardFen = session.EngineController.ChessState.Fen;
                    entity.Status = session.Status;
                    entity.GameRevision = session.GameRevision;
                    entity.Winner = session.EngineController.ChessState.Winner?.ToString();
                    entity.UpdatedAt = DateTimeOffset.UtcNow;
                    entity.SnapshotJson = snapshotJson;

                    await db.SaveChangesAsync();
                    await tx.CommitAsync();
                }
                else
                {
                    await tx.RollbackAsync();
                    return false;
                }
            }
            catch
            {
                RestoreSessionInPlace(session, previousSnapshotJson);
                throw;
            }
            finally
            {
                if (_dbContextFactory is not NonDisposingDbContextFactory)
                {
                    await db.DisposeAsync();
                }
            }

            return true;
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public async Task<bool> CancelSessionAsync(Guid gameId, string playerToken)
    {
        var session = await GetByIdAsync(gameId);
        if (session == null) return false;

        await session.SessionLock.WaitAsync();
        try
        {
            bool isAuthorized = session.AuthenticatePlayer(playerToken, PlayerColor.White) ||
                                session.AuthenticatePlayer(playerToken, PlayerColor.Black);

            if (!isAuthorized) return false;

            if (session.Status == SessionStatus.Completed || session.Status == SessionStatus.Expired || session.Status == SessionStatus.Cancelled)
            {
                return false;
            }

            var previousSnapshotJson = CreateSnapshotJson(session);

            var db = CreateContext();
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync();
                var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == session.GameId);
                if (entity == null || entity.Status == SessionStatus.Completed || entity.Status == SessionStatus.Expired || entity.Status == SessionStatus.Cancelled)
                {
                    await tx.RollbackAsync();
                    return false;
                }

                if (entity.GameRevision != session.GameRevision)
                {
                    await tx.RollbackAsync();
                    RestoreSessionInPlace(session, entity.SnapshotJson);
                    return false;
                }

                var newRevision = session.GameRevision + 1;
                session.Status = SessionStatus.Cancelled;
                session.GameRevision = newRevision;

                var snapshotJson = CreateSnapshotJson(session);

                entity.Status = SessionStatus.Cancelled;
                entity.GameRevision = newRevision;
                entity.UpdatedAt = DateTimeOffset.UtcNow;
                entity.SnapshotJson = snapshotJson;

                await db.SaveChangesAsync();
                await tx.CommitAsync();

                return true;
            }
            catch
            {
                RestoreSessionInPlace(session, previousSnapshotJson);
                throw;
            }
            finally
            {
                if (_dbContextFactory is not NonDisposingDbContextFactory)
                {
                    await db.DisposeAsync();
                }
            }
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    public async Task<int> CleanupExpiredSessionsAsync()
    {
        var now = DateTimeOffset.UtcNow;
        var db = CreateContext();
        try
        {
            var expiredEntities = await db.Sessions
                .Where(s => s.ExpiresAt.HasValue && s.ExpiresAt.Value <= now &&
                            s.Status != SessionStatus.Completed &&
                            s.Status != SessionStatus.Cancelled &&
                            s.Status != SessionStatus.Expired)
                .ToListAsync();

            foreach (var entity in expiredEntities)
            {
                entity.Status = SessionStatus.Expired;
                entity.UpdatedAt = now;
                if (_sessionsById.TryGetValue(entity.GameId, out var session))
                {
                    session.Status = SessionStatus.Expired;
                }
            }

            if (expiredEntities.Count > 0)
            {
                await db.SaveChangesAsync();
            }

            return expiredEntities.Count;
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }
    }

    public Task<string> ExportSessionSnapshotJsonAsync(Guid gameId)
    {
        if (!_sessionsById.TryGetValue(gameId, out var session))
        {
            throw new InvalidOperationException($"Game session '{gameId}' not found.");
        }

        return Task.FromResult(CreateSnapshotJson(session));
    }

    public Task<GameSession?> RestoreSessionSnapshotJsonAsync(string snapshotJson)
    {
        var session = RestoreFromSnapshotJson(snapshotJson);
        if (session != null)
        {
            _sessionsById[session.GameId] = session;
            _sessionIdsByTokenHash[session.InvitationTokenHash] = session.GameId;
        }
        return Task.FromResult(session);
    }

    public static string NormalizeJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return "{}";
        try
        {
            using var doc = JsonDocument.Parse(json);
            return JsonSerializer.Serialize(doc.RootElement);
        }
        catch
        {
            return json.Trim();
        }
    }

    public async Task<(bool Success, string? ErrorCode, int NewRevision, bool IsIdempotentReplay)> ExecuteActionAtomicallyAsync(
        Guid gameId,
        string? actionId,
        string actionType,
        PlayerColor playerColor,
        int? expectedRevision,
        Func<GameSession, (bool Success, string? ErrorCode)> mutateState,
        string? payloadJson = null)
    {
        var session = await GetByIdAsync(gameId);
        if (session == null)
        {
            return (false, "NOT_FOUND", 0, false);
        }

        await session.SessionLock.WaitAsync();
        try
        {
            var normalizedPayload = NormalizeJson(payloadJson);

            // Step 1: Idempotency check BEFORE checking stale expectedRevision
            if (!string.IsNullOrEmpty(actionId))
            {
                var dbCheck = CreateContext();
                try
                {
                    var existingAction = await dbCheck.Actions.AsNoTracking()
                        .FirstOrDefaultAsync(a => a.GameId == gameId && a.ActionId == actionId);
                    if (existingAction != null)
                    {
                        var normalizedStored = NormalizeJson(existingAction.PayloadJson);

                        if (existingAction.ActionType != actionType ||
                            existingAction.PlayerColor != playerColor.ToString() ||
                            normalizedStored != normalizedPayload)
                        {
                            return (false, "IDEMPOTENCY_CONFLICT", session.GameRevision, false);
                        }
                        return (true, null, existingAction.Revision + 1, true);
                    }
                }
                finally
                {
                    if (_dbContextFactory is not NonDisposingDbContextFactory)
                    {
                        await dbCheck.DisposeAsync();
                    }
                }
            }

            // Step 2: Revision check
            if (expectedRevision.HasValue && expectedRevision.Value != session.GameRevision)
            {
                return (false, "REVISION_MISMATCH", session.GameRevision, false);
            }

            var previousSnapshotJson = CreateSnapshotJson(session);

            var result = mutateState(session);
            if (!result.Success)
            {
                return (false, result.ErrorCode, session.GameRevision, false);
            }

            var newRevision = session.GameRevision + 1;

            var db = CreateContext();
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync();
                try
                {
                    var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == gameId);
                    if (entity == null)
                    {
                        await tx.RollbackAsync();
                        RestoreSessionInPlace(session, previousSnapshotJson);
                        return (false, "NOT_FOUND", session.GameRevision, false);
                    }

                    // Database-backed revision check for cross-instance concurrency protection
                    if (entity.GameRevision != session.GameRevision)
                    {
                        await tx.RollbackAsync();
                        RestoreSessionInPlace(session, entity.SnapshotJson);
                        return (false, "CONCURRENCY_CONFLICT", entity.GameRevision, false);
                    }

                    entity.GameRevision = newRevision;
                    entity.BoardFen = session.EngineController.ChessState.Fen;
                    entity.Status = session.Status;
                    entity.Winner = session.EngineController.ChessState.Winner?.ToString();
                    entity.UpdatedAt = DateTimeOffset.UtcNow;
                    session.GameRevision = newRevision;
                    entity.SnapshotJson = CreateSnapshotJson(session);

                    if (!string.IsNullOrEmpty(actionId))
                    {
                        var actionEntity = new GameActionEntity
                        {
                            GameId = gameId,
                            ActionId = actionId,
                            ActionType = actionType,
                            PlayerColor = playerColor.ToString(),
                            Revision = newRevision - 1,
                            PayloadJson = normalizedPayload,
                            ResultJson = "{\"success\":true}",
                            CreatedAt = DateTimeOffset.UtcNow
                        };
                        db.Actions.Add(actionEntity);
                    }

                    await db.SaveChangesAsync();
                    await tx.CommitAsync();

                    return (true, null, newRevision, false);
                }
                catch (DbUpdateConcurrencyException)
                {
                    await tx.RollbackAsync();
                    RestoreSessionInPlace(session, previousSnapshotJson);
                    return (false, "CONCURRENCY_CONFLICT", session.GameRevision, false);
                }
                catch (DbUpdateException)
                {
                    await tx.RollbackAsync();
                    RestoreSessionInPlace(session, previousSnapshotJson);

                    if (!string.IsNullOrEmpty(actionId))
                    {
                        var dbVerify = CreateContext();
                        try
                        {
                            var racedAction = await dbVerify.Actions.AsNoTracking()
                                .FirstOrDefaultAsync(a => a.GameId == gameId && a.ActionId == actionId);
                            if (racedAction != null)
                            {
                                var normalizedStored = NormalizeJson(racedAction.PayloadJson);
                                if (racedAction.ActionType == actionType &&
                                    racedAction.PlayerColor == playerColor.ToString() &&
                                    normalizedStored == normalizedPayload)
                                {
                                    return (true, null, racedAction.Revision + 1, true);
                                }
                                return (false, "IDEMPOTENCY_CONFLICT", session.GameRevision, false);
                            }
                        }
                        finally
                        {
                            if (_dbContextFactory is not NonDisposingDbContextFactory)
                            {
                                await dbVerify.DisposeAsync();
                            }
                        }
                    }
                    return (false, "CONCURRENCY_CONFLICT", session.GameRevision, false);
                }
                catch (Exception)
                {
                    await tx.RollbackAsync();
                    RestoreSessionInPlace(session, previousSnapshotJson);
                    throw;
                }
            }
            finally
            {
                if (_dbContextFactory is not NonDisposingDbContextFactory)
                {
                    await db.DisposeAsync();
                }
            }
        }
        finally
        {
            session.SessionLock.Release();
        }
    }

    private void RestoreSessionInPlace(GameSession target, string snapshotJson)
    {
        var restored = RestoreFromSnapshotJson(snapshotJson);
        if (restored == null) return;
        target.EngineController = restored.EngineController;
        target.Status = restored.Status;
        target.GameRevision = restored.GameRevision;
        target.PlayerBlack = restored.PlayerBlack;
    }

    public async Task<bool> TryRecordActionAsync(Guid gameId, string actionId, string actionType, string playerColor, int expectedRevision, string payloadJson, string resultJson)
    {
        var db = CreateContext();
        try
        {
            var exists = await db.Actions.AnyAsync(a => a.GameId == gameId && a.ActionId == actionId);
            if (exists)
            {
                return false;
            }

            var action = new GameActionEntity
            {
                ActionId = actionId,
                GameId = gameId,
                ActionType = actionType,
                PlayerColor = playerColor,
                Revision = expectedRevision,
                PayloadJson = payloadJson,
                ResultJson = resultJson,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Actions.Add(action);
            await db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException)
        {
            return false;
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }
    }

    public async Task<string?> GetActionResultAsync(Guid gameId, string actionId)
    {
        var db = CreateContext();
        try
        {
            var action = await db.Actions.AsNoTracking().FirstOrDefaultAsync(a => a.GameId == gameId && a.ActionId == actionId);
            return action?.ResultJson;
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }
    }

    public async Task<bool> UpdatePlayerConnectionStatusAsync(Guid gameId, PlayerColor color, bool isConnected)
    {
        var db = CreateContext();
        try
        {
            var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == gameId);
            if (entity != null)
            {
                if (color == PlayerColor.White)
                {
                    entity.PlayerWhiteConnected = isConnected;
                }
                else
                {
                    entity.PlayerBlackConnected = isConnected;
                }
                entity.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
            }
        }
        finally
        {
            if (_dbContextFactory is not NonDisposingDbContextFactory)
            {
                await db.DisposeAsync();
            }
        }

        if (_sessionsById.TryGetValue(gameId, out var session))
        {
            if (color == PlayerColor.White && session.PlayerWhite != null)
            {
                session.PlayerWhite = session.PlayerWhite with { IsConnected = isConnected };
            }
            else if (color == PlayerColor.Black && session.PlayerBlack != null)
            {
                session.PlayerBlack = session.PlayerBlack with { IsConnected = isConnected };
            }
        }

        return true;
    }

    private string CreateSnapshotJson(GameSession session)
    {
        lock (session)
        {
            var controller = session.EngineController;
            var chess = controller.ChessState;

            var snapshot = new GameSessionSnapshot(
                GameId: session.GameId,
                InvitationTokenHash: session.InvitationTokenHash,
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

            return JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
        }
    }

    public GameSession? RestoreFromSnapshotJson(string snapshotJson)
    {
        var cleanJson = LegacySnapshotSanitizer.Sanitize(snapshotJson);
        var snapshot = JsonSerializer.Deserialize<GameSessionSnapshot>(cleanJson);
        if (snapshot == null) return null;

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
            snapshot.InvitationTokenHash,
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

        return session;
    }
}
