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

