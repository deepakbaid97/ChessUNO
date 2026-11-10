using System;
using System.IO;
using ChessUno.Core.Cards;
using ChessUno.Core.Config;
using ChessUno.Core.Decks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Turn;
using ChessUno.Core.Effects;
using ChessUno.Core.GameEngine;
using ChessUno.Core.Turn;
using ChessUno.Core.Validation;
using Xunit;

namespace CardEngine.Tests.Turn;

public class TurnControllerTests
{
    private readonly GameConfig _config;
    private readonly JsonCardRepository _repository;
    private readonly ChessEngine _chessEngine = new();

    public TurnControllerTests()
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
    public void TurnController_StartsGameInDrawPhaseForWhite()
    {
        var controller = CreateController();
        controller.StartGame();

        Assert.Equal(PlayerColor.White, controller.ActivePlayer);
        Assert.Equal(TurnPhase.DrawPhase, controller.CurrentTurn.Phase);
        Assert.Equal(108, controller.DeckManager.RemainingCount);
    }

    [Fact]
    public void TurnController_DrawCard_TransitionsToActionPhase()
    {
        var controller = CreateController();
        controller.StartGame();

        var card = controller.DrawCard(PlayerColor.White);

        Assert.NotNull(card);
        Assert.Equal(107, controller.DeckManager.RemainingCount);
        Assert.Equal(1, controller.DeckManager.DiscardCount);
        Assert.Contains(controller.EventLog, e => e.EventType == "CardDrawnEvent");
    }

    [Fact]
    public void TurnController_SubmitMove_DecrementsMovesAndEndsTurnWhenComplete()
    {
        var controller = CreateController();
        controller.StartGame();

        // Inject Card-2 (MOVE_2)
        var card2 = new CardInstance(Guid.NewGuid(), new CardDefinition("card-2", "2 Card", "NUMBER", 8, "MOVE_2", "", Value: 2));
        controller.InjectNextCard(card2);

        controller.DrawCard(PlayerColor.White);
        Assert.Equal(2, controller.CurrentTurn.RemainingMoves);

        // Move 1
        var result1 = controller.SubmitChessMove(PlayerColor.White, new ChessMove(Square.Parse("e2"), Square.Parse("e4")));
        Assert.True(result1.IsSuccess);
        Assert.Equal(1, controller.CurrentTurn.RemainingMoves);
        Assert.Equal(PlayerColor.White, controller.ActivePlayer);

        // Move 2
        var result2 = controller.SubmitChessMove(PlayerColor.White, new ChessMove(Square.Parse("e4"), Square.Parse("e5")));
        Assert.True(result2.IsSuccess);

        // Turn ends after consuming all moves, passing to Black
        Assert.Equal(PlayerColor.Black, controller.ActivePlayer);
        Assert.Equal(TurnPhase.DrawPhase, controller.CurrentTurn.Phase);
        Assert.Contains(controller.EventLog, e => e.EventType == "TurnChangedEvent");
    }

    [Fact]
    public void TurnController_SkipCard_GrantsSamePlayerSubsequentTurn()
    {
        var controller = CreateController();
        controller.StartGame();

        // White draws Skip
        var skipCard = new CardInstance(Guid.NewGuid(), new CardDefinition("card-skip", "Skip", "ACTION", 8, "SKIP_OPPONENT", ""));
        controller.InjectNextCard(skipCard);

        controller.DrawCard(PlayerColor.White);

        // Initiative stays with White for a new turn!
        Assert.Equal(PlayerColor.White, controller.ActivePlayer);
        Assert.Equal(TurnPhase.DrawPhase, controller.CurrentTurn.Phase);
    }

    [Fact]
    public void TurnController_InCheck_DrawingCard0_TriggersImmediateDefeat()
    {
        // White King on e1 attacked by Black Rook on e8
        var checkFen = "4r3/8/8/8/8/8/8/4K3 w - - 0 1";
        var controller = CreateController(initialFen: checkFen);
        controller.StartGame();

        // Draw Card 0
        var card0 = new CardInstance(Guid.NewGuid(), new CardDefinition("card-0", "0 Card", "NUMBER", 4, "PASS_TURN_EFFECT", "", Value: 0));
        controller.InjectNextCard(card0);

        controller.DrawCard(PlayerColor.White);

        Assert.Equal(GameStatus.Checkmate, controller.ChessState.Status);
        Assert.Equal(PlayerColor.Black, controller.ChessState.Winner);
    }

    [Fact]
    public void TurnController_WildChoice_AllowsSubmittingChoiceAndActivatesSelectedEffect()
    {
        var controller = CreateController();
        controller.StartGame();

        var wildCard = new CardInstance(Guid.NewGuid(), new CardDefinition("card-wild", "Wild", "WILD", 4, "WILD_CHOICE", ""));
        controller.InjectNextCard(wildCard);

        controller.DrawCard(PlayerColor.White);

        Assert.Equal(TurnPhase.AwaitingChoice, controller.CurrentTurn.Phase);
        Assert.NotNull(controller.CurrentTurn.AvailableChoices);
        Assert.Contains("MOVE_1", controller.CurrentTurn.AvailableChoices);

        // Submitting invalid choice fails
        var invalidResult = controller.SubmitChoice(PlayerColor.White, "INVALID_CHOICE");
        Assert.False(invalidResult.IsSuccess);
        Assert.Equal(TurnPhase.AwaitingChoice, controller.CurrentTurn.Phase);

        // Submitting valid choice succeeds and transitions to ActionPhase
        var validResult = controller.SubmitChoice(PlayerColor.White, "MOVE_1");
        Assert.True(validResult.IsSuccess);
        Assert.Equal(TurnPhase.ActionPhase, controller.CurrentTurn.Phase);
        Assert.Equal(1, controller.CurrentTurn.RemainingMoves);
    }

    [Fact]
    public void TurnController_CompositeSequence_ExecutesRevivalThenMoves()
    {
        // Setup game where White has captured pieces in reserve
        var controller = CreateController();
        controller.StartGame();

        var seqCard = new CardInstance(Guid.NewGuid(), new CardDefinition("card-seq", "Sequence Card", "WILD", 4, "REVIVE_TWO_AND_MOVE_TWO", ""));
        controller.InjectNextCard(seqCard);

        controller.DrawCard(PlayerColor.White);

        // First step in sequence is REVIVE_UP_TO_TWO
        Assert.Equal(TurnPhase.ActionPhase, controller.CurrentTurn.Phase);
        Assert.Equal(2, controller.CurrentTurn.RemainingRevivals);

        // Ending revival phase / advance sequence step activates MOVE_2
        var advanceResult = controller.EndTurn(PlayerColor.White);
        Assert.True(advanceResult.IsSuccess);

        // Should advance to second step (MOVE_2) with 2 moves and keep turn!
        Assert.Equal(PlayerColor.White, controller.ActivePlayer);
        Assert.Equal(TurnPhase.ActionPhase, controller.CurrentTurn.Phase);
        Assert.Equal(2, controller.CurrentTurn.RemainingMoves);
    }

    [Fact]
    public void TurnController_SubmitSwap_ValidatesKingSafetyAndPerformsSwap()
    {
        var controller = CreateController();
        controller.StartGame();

        var reverseCard = new CardInstance(Guid.NewGuid(), new CardDefinition("card-reverse", "Reverse", "ACTION", 8, "SWAP_OWN_PIECES", ""));
        controller.InjectNextCard(reverseCard);

        controller.DrawCard(PlayerColor.White);
        Assert.True(controller.CurrentTurn.CanSwap);

        // Swap White Knight b1 and Bishop c1
        var result = controller.SubmitSwap(PlayerColor.White, Square.Parse("b1"), Square.Parse("c1"));
        Assert.True(result.IsSuccess);

        Assert.Equal(PieceType.Bishop, controller.ChessState.GetPieceAt(Square.Parse("b1"))!.Type);
        Assert.Equal(PieceType.Knight, controller.ChessState.GetPieceAt(Square.Parse("c1"))!.Type);
        // After swap, turn ends and passes to Black
        Assert.Equal(PlayerColor.Black, controller.ActivePlayer);
    }

    [Fact]
    public void TurnController_EndTurnInCheck_TriggersDefeat()
    {
        // White King on e1 attacked by Black Rook on e8. White draws MOVE_1.
        var checkFen = "4r3/8/8/8/8/8/8/4K3 w - - 0 1";
        var controller = CreateController(initialFen: checkFen);
        controller.StartGame();

        var card1 = new CardInstance(Guid.NewGuid(), new CardDefinition("card-1", "1 Card", "NUMBER", 8, "MOVE_1", "", Value: 1));
        controller.InjectNextCard(card1);
        controller.DrawCard(PlayerColor.White);

        // White tries to end turn without escaping check
        var endResult = controller.EndTurn(PlayerColor.White);
        Assert.True(endResult.IsSuccess);

        Assert.Equal(GameStatus.Checkmate, controller.ChessState.Status);
        Assert.Equal(PlayerColor.Black, controller.ChessState.Winner);
    }

    [Fact]
    public void TurnController_ActionsInTerminalState_AreRejected()
    {
        var controller = CreateController();
        controller.StartGame();
        controller.Resign(PlayerColor.White);

        Assert.Throws<InvalidOperationException>(() => controller.DrawCard(PlayerColor.Black));
        var moveResult = controller.SubmitChessMove(PlayerColor.Black, new ChessMove(Square.Parse("e7"), Square.Parse("e5")));
        Assert.False(moveResult.IsSuccess);
    }
}

