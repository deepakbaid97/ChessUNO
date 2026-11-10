using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.GameStatusTests;

public class GameStatusEvaluationTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void CheckStatus_IdentifiedAccurately()
    {
        // White King on e1 attacked by Black Rook on e8
        var fen = "4r3/8/8/8/8/8/8/4K3 w - - 0 1";
        var game = _engine.CreateFromFen(fen);

        Assert.Equal(GameStatus.Check, game.Status);
        Assert.True(game.InCheck);
    }

    [Fact]
    public void ScholarsMate_ResultsInCheckmate()
    {
        // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
        var game = _engine.CreateInitialGame();

        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e2"), Square.Parse("e4")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e7"), Square.Parse("e5")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("d1"), Square.Parse("h5")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("b8"), Square.Parse("c6")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("f1"), Square.Parse("c4")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("g8"), Square.Parse("f6")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("h5"), Square.Parse("f7")));

        Assert.Equal(GameStatus.Checkmate, game.Status);
        Assert.Equal(PlayerColor.White, game.Winner);
        Assert.True(game.InCheck);
    }

    [Fact]
    public void Stalemate_IdentifiedAccurately()
    {
        // Black King on a8, White King on c7, White Queen on b6. Black to move has no legal moves and is not in check.
        // 7k/8/1Q6/2K5/8/8/8/8 b - - 0 1
        var fen = "k7/2K5/1Q6/8/8/8/8/8 b - - 0 1";
        var game = _engine.CreateFromFen(fen);

        Assert.Equal(GameStatus.Stalemate, game.Status);
        Assert.False(game.InCheck);
        Assert.Null(game.Winner);
    }

    [Fact]
    public void FiftyMoveRule_TriggersDrawWhenHalfMoveClockReaches100()
    {
        // 99 half moves already made without pawn moves or captures (both sides have rooks, not bare kings)
        var fen = "r3k3/8/8/8/8/8/8/R3K3 w - - 99 50";
        var game = _engine.CreateFromFen(fen);

        var move = new ChessMove(Square.Parse("e1"), Square.Parse("d1"));
        var nextState = _engine.ApplyMove(game, move);

        Assert.Equal(GameStatus.DrawByFiftyMoveRule, nextState.Status);
        Assert.Null(nextState.Winner);
    }

    [Fact]
    public void ThreefoldRepetition_TriggersDrawWhenPositionRepeatsThreeTimes()
    {
        var game = _engine.CreateInitialGame();

        // 1. Nf3 Nf6 2. Ng1 Ng8 (position repeated 2nd time) 3. Nf3 Nf6 4. Ng1 Ng8 (position repeated 3rd time)
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("g1"), Square.Parse("f3")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("g8"), Square.Parse("f6")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("f3"), Square.Parse("g1")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("f6"), Square.Parse("g8")));

        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("g1"), Square.Parse("f3")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("g8"), Square.Parse("f6")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("f3"), Square.Parse("g1")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("f6"), Square.Parse("g8")));

        Assert.Equal(GameStatus.DrawByThreefoldRepetition, game.Status);
        Assert.Null(game.Winner);
    }

    [Fact]
    public void InsufficientMaterial_BareKings_TriggersDraw()
    {
        var fen = "8/8/8/8/8/4k3/8/4K3 w - - 0 1";
        var game = _engine.CreateFromFen(fen);

        Assert.Equal(GameStatus.DrawByInsufficientMaterial, game.Status);
        Assert.Null(game.Winner);
    }

    [Fact]
    public void KingCapture_ImmediatelyEndsGameWithVictory()
    {
        // White Queen on e1, Black King on e8. White captures Black King on e8 during multi-move card.
        var fen = "4k3/8/8/8/8/8/8/4Q2K w - - 0 1";
        var game = _engine.CreateFromFen(fen);

        var move = new ChessMove(Square.Parse("e1"), Square.Parse("e8"));
        var nextState = _engine.ApplyMove(game, move, toggleTurn: false);

        Assert.Equal(GameStatus.Checkmate, nextState.Status);
        Assert.Equal(PlayerColor.White, nextState.Winner);
        Assert.True(_engine.IsTerminalState(nextState.Status));
    }
}

