using System;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.Security;

public class RobustnessTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void TerminalState_MoveAfterCheckmate_IsRejected()
    {
        // 4. Qxf7# position
        var game = _engine.CreateInitialGame();
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e2"), Square.Parse("e4")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e7"), Square.Parse("e5")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("d1"), Square.Parse("h5")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("b8"), Square.Parse("c6")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("f1"), Square.Parse("c4")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("g8"), Square.Parse("f6")));
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("h5"), Square.Parse("f7")));

        Assert.Equal(GameStatus.Checkmate, game.Status);

        // Attempting to move any piece after checkmate throws InvalidOperationException
        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyMove(game, new ChessMove(Square.Parse("e8"), Square.Parse("f7"))));
    }

    [Fact]
    public void TerminalState_MoveAfterResignationOrDraw_IsRejected()
    {
        var game = _engine.CreateInitialGame();
        var resignedGame = game with { Status = GameStatus.Resigned, Winner = PlayerColor.Black };

        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyMove(resignedGame, new ChessMove(Square.Parse("e2"), Square.Parse("e4"))));

        var drawGame = game with { Status = GameStatus.DrawByFiftyMoveRule };
        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyMove(drawGame, new ChessMove(Square.Parse("e2"), Square.Parse("e4"))));
    }

    [Fact]
    public void TerminalState_RevivalAfterTerminalState_IsRejected()
    {
        var game = _engine.CreateInitialGame();
        var resignedGame = game with { Status = GameStatus.Resigned, Winner = PlayerColor.Black };

        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyRevival(resignedGame, PlayerColor.White, PieceType.Pawn, Square.Parse("e3")));
    }

    [Fact]
    public void WrongPlayer_SubmittingMove_IsRejected()
    {
        var game = _engine.CreateInitialGame(); // White to move

        // Black player tries to submit a move
        var move = new ChessMove(Square.Parse("e7"), Square.Parse("e5"));

        Assert.False(_engine.IsLegalMove(game, PlayerColor.Black, move));
        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, move));
    }

    [Fact]
    public void StateImmutability_FailedMoveDoesNotMutateState()
    {
        var game = _engine.CreateInitialGame();
        var originalFen = game.Fen;
        var originalSeq = game.EventSequenceNumber;

        var illegalMove = new ChessMove(Square.Parse("a1"), Square.Parse("a8"));

        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, illegalMove));

        Assert.Equal(originalFen, game.Fen);
        Assert.Equal(originalSeq, game.EventSequenceNumber);
        Assert.Empty(game.MoveHistory);
    }
}

