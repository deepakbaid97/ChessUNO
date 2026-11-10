using System;
using System.IO;
using System.Threading.Tasks;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Decks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Domain.Turn;
using ChessUno.Core.Effects;
using ChessUno.Core.GameEngine;
using ChessUno.Core.Sessions;
using ChessUno.Core.Turn;
using ChessUno.Core.Validation;
using Xunit;

namespace CardEngine.Tests.Session;

public class GameSessionTests
{
    private readonly GameConfig _config;
    private readonly JsonCardRepository _repository;
    private readonly ChessEngine _chessEngine = new();

    public GameSessionTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));
        var configPath = Path.Combine(projectRoot, "configs", "chess-uno.json");
        _config = System.Text.Json.JsonSerializer.Deserialize<GameConfig>(File.ReadAllText(configPath))!;
        _repository = new JsonCardRepository();
        _repository.LoadFromPath(configPath);
    }

    private TurnController CreateController(int? seed = null, string? initialFen = null)
    {
        var deckManager = new DeckManager(_repository.LoadFromPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "configs", "chess-uno.json")), seed);
        var registry = new CardEffectRegistry();
        var executor = new CardEffectExecutor(_config, registry, _chessEngine);
        var validator = new CardValidator();
        var initialGame = initialFen != null ? _chessEngine.CreateFromFen(initialFen) : _chessEngine.CreateInitialGame();
        return new TurnController(_config, _chessEngine, deckManager, executor, validator, initialGame);
    }

    [Fact]
    public void GameSession_StartsInDrawPhaseForWhite()
    {
        var controller = CreateController();
        controller.StartGame();

        Assert.Equal(PlayerColor.White, controller.ActivePlayer);
        Assert.Equal(TurnPhase.DrawPhase, controller.CurrentTurn.Phase);
        Assert.Equal(108, controller.DeckManager.RemainingCount);
        Assert.Equal(0, controller.DeckManager.DiscardCount);
    }

    [Fact]
    public void DrawingCard_MovesDeckToDiscardAndActivatesActionPhase()
    {
        var controller = CreateController();
        controller.StartGame();

        var card2 = new CardInstance(Guid.NewGuid(), new CardDefinition("card-2", "2 Card", "NUMBER", 8, "MOVE_2", "", Value: 2));
        controller.InjectNextCard(card2);

        var drawnCard = controller.DrawCard(PlayerColor.White);

        Assert.NotNull(drawnCard);
        Assert.Equal(107, controller.DeckManager.RemainingCount);
        Assert.Equal(1, controller.DeckManager.DiscardCount);
        Assert.NotNull(controller.CurrentTurn.ActiveCard);
        Assert.Equal(TurnPhase.ActionPhase, controller.CurrentTurn.Phase);
    }

    [Fact]
    public void NumberCard_EnforcesMoveQuotaAndEndsTurnWhenDepleted()
    {
        var controller = CreateController();
        controller.StartGame();

        // Inject Card-2 (MOVE_2) for deterministic testing
        var card2 = new CardInstance(Guid.NewGuid(), new CardDefinition("card-2", "2 Card", "NUMBER", 8, "MOVE_2", "", Value: 2));
        controller.InjectNextCard(card2);

        controller.DrawCard(PlayerColor.White);
        Assert.Equal(2, controller.CurrentTurn.RemainingMoves);

        // Move 1: e2 to e4
        controller.SubmitChessMove(PlayerColor.White, new ChessMove(Square.Parse("e2"), Square.Parse("e4")));
        Assert.Equal(1, controller.CurrentTurn.RemainingMoves);
        Assert.Equal(PlayerColor.White, controller.ActivePlayer);

        // Move 2: e4 to e5 (turn should now end and toggle to Black)
        controller.SubmitChessMove(PlayerColor.White, new ChessMove(Square.Parse("e4"), Square.Parse("e5")));

        // After completing moves, turn passes to Black in DrawPhase
        Assert.Equal(PlayerColor.Black, controller.ActivePlayer);
        Assert.Equal(TurnPhase.DrawPhase, controller.CurrentTurn.Phase);
    }

    [Fact]
    public void SkipCard_GrantsCurrentPlayerAnotherTurn()
    {
        var controller = CreateController();
        controller.StartGame();

        // White draws Skip card
        var skipCard = new CardInstance(Guid.NewGuid(), new CardDefinition("card-skip", "Skip", "ACTION", 8, "SKIP_OPPONENT", ""));
        controller.InjectNextCard(skipCard);

        controller.DrawCard(PlayerColor.White);

        // Skip immediately resolves and passes initiative back to White
        Assert.Equal(PlayerColor.White, controller.ActivePlayer);
        Assert.Equal(TurnPhase.DrawPhase, controller.CurrentTurn.Phase);
    }

    [Fact]
    public void SwapCard_SwapsPositionsOfTwoFriendlyNonKingPieces()
    {
        var controller = CreateController();
        controller.StartGame();

        // White draws Reverse (SWAP_OWN_PIECES)
        var swapCard = new CardInstance(Guid.NewGuid(), new CardDefinition("card-reverse", "Reverse", "ACTION", 8, "SWAP_OWN_PIECES", ""));
        controller.InjectNextCard(swapCard);

        controller.DrawCard(PlayerColor.White);
        Assert.True(controller.CurrentTurn.CanSwap);

        // Swap Knight on b1 with Rook on a1
        var sq1 = Square.Parse("b1");
        var sq2 = Square.Parse("a1");

        controller.SubmitSwap(PlayerColor.White, sq1, sq2);

        var pieceAtB1 = controller.ChessState.GetPieceAt(sq1);
        var pieceAtA1 = controller.ChessState.GetPieceAt(sq2);

        Assert.Equal(PieceType.Rook, pieceAtB1!.Type);
        Assert.Equal(PieceType.Knight, pieceAtA1!.Type);

        // Turn ends after swap
        Assert.Equal(PlayerColor.Black, controller.ActivePlayer);
    }

    [Fact]
    public void ImmediateDefeat_WhenInCheckAndDrawsCardZero()
    {
        // Position where White is in check
        var checkFen = "4r3/8/8/8/8/8/8/4K3 w - - 0 1";
        var controller = CreateController(initialFen: checkFen);
        controller.StartGame();

        // White draws 0 Card (0 moves permitted)
        var card0 = new CardInstance(Guid.NewGuid(), new CardDefinition("card-0", "0 Card", "NUMBER", 4, "PASS_TURN_EFFECT", "", Value: 0));
        controller.InjectNextCard(card0);

        controller.DrawCard(PlayerColor.White);

        // Since White is in check and has 0 moves to escape, checkmate defeat is triggered immediately
        Assert.Equal(GameStatus.Checkmate, controller.ChessState.Status);
        Assert.Equal(PlayerColor.Black, controller.ChessState.Winner);
    }

    [Fact]
    public async Task SessionRepository_ExportAndRestore_PreservesFullSessionState()
    {
        var repo = new InMemoryGameSessionRepository();
        var session = await repo.CreateSessionAsync("Alice", seed: 42);

        // White draws card and makes move
        session.EngineController.StartGame();
        var drawn = session.EngineController.DrawCard(PlayerColor.White);
        var moveResult = session.EngineController.SubmitChessMove(PlayerColor.White, new ChessMove(Square.Parse("e2"), Square.Parse("e4")));

        // Export snapshot
        var snapshotJson = await repo.ExportSessionSnapshotJsonAsync(session.GameId);
        Assert.NotNull(snapshotJson);
        Assert.Contains(session.GameId.ToString(), snapshotJson);

        // Restore in a fresh repository instance
        var newRepo = new InMemoryGameSessionRepository();
        var restored = await newRepo.RestoreSessionSnapshotJsonAsync(snapshotJson);

        Assert.NotNull(restored);
        Assert.Equal(session.GameId, restored.GameId);
        Assert.Equal(session.InvitationToken, restored.InvitationToken);
        Assert.Equal(session.PlayerWhite!.SecretToken, restored.PlayerWhite!.SecretToken);
        Assert.Equal(session.EngineController.ChessState.Fen, restored.EngineController.ChessState.Fen);
        Assert.Equal(session.EngineController.DeckManager.RemainingCount, restored.EngineController.DeckManager.RemainingCount);
        Assert.Equal(session.EngineController.DeckManager.DiscardCount, restored.EngineController.DeckManager.DiscardCount);
    }

    [Fact]
    public async Task SessionRepository_Lifecycle_HandlesCancellationAndExpiration()
    {
        var repo = new InMemoryGameSessionRepository();
        var session = await repo.CreateSessionAsync("Alice");

        // Cancel session
        var cancelSuccess = await repo.CancelSessionAsync(session.GameId, session.PlayerWhite!.SecretToken);
        Assert.True(cancelSuccess);
        Assert.Equal(SessionStatus.Cancelled, session.Status);

        // Create expired session
        var expiredSession = await repo.CreateSessionAsync("Bob");
        expiredSession.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-5);

        var cleanedCount = await repo.CleanupExpiredSessionsAsync();
        Assert.True(cleanedCount >= 1);
        Assert.Equal(SessionStatus.Expired, expiredSession.Status);
    }
}
