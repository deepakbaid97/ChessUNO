using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.Integration;

public class SequentialMoveTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void SequentialMoves_SamePieceCanMoveTwiceInSingleTurn()
    {
        // White plays 1. e2 to e4, and then continues same turn to play e4 to e5
        var game = _engine.CreateInitialGame();

        // Move 1 of 2 (toggleTurn: false)
        var move1 = new ChessMove(Square.Parse("e2"), Square.Parse("e4"));
        var stateAfterMove1 = _engine.ApplyMove(game, move1, toggleTurn: false);

        Assert.Equal(PlayerColor.White, stateAfterMove1.ActivePlayer);
        Assert.NotNull(stateAfterMove1.GetPieceAt(Square.Parse("e4")));

        // Move 2 of 2 (toggleTurn: true - completing the turn)
        var move2 = new ChessMove(Square.Parse("e4"), Square.Parse("e5"));
        var stateAfterMove2 = _engine.ApplyMove(stateAfterMove1, move2, toggleTurn: true);

        Assert.Equal(PlayerColor.Black, stateAfterMove2.ActivePlayer);
        Assert.Null(stateAfterMove2.GetPieceAt(Square.Parse("e4")));
        var pawn = stateAfterMove2.GetPieceAt(Square.Parse("e5"));
        Assert.NotNull(pawn);
        Assert.Equal(PieceType.Pawn, pawn.Type);
        Assert.Equal(PlayerColor.White, pawn.Color);
        Assert.Equal(2, stateAfterMove2.MoveHistory.Count);
    }

    [Fact]
    public void SequentialMoves_DifferentFriendlyPiecesCanMoveInSingleTurn()
    {
        // White plays e2-e4, then g1-f3 in the same turn
        var game = _engine.CreateInitialGame();

        // Move 1 (White Pawn)
        var move1 = new ChessMove(Square.Parse("e2"), Square.Parse("e4"));
        var state1 = _engine.ApplyMove(game, move1, toggleTurn: false);
        Assert.Equal(PlayerColor.White, state1.ActivePlayer);

        // Move 2 (White Knight)
        var move2 = new ChessMove(Square.Parse("g1"), Square.Parse("f3"));
        var state2 = _engine.ApplyMove(state1, move2, toggleTurn: true);

        Assert.Equal(PlayerColor.Black, state2.ActivePlayer);
        Assert.NotNull(state2.GetPieceAt(Square.Parse("e4")));
        Assert.NotNull(state2.GetPieceAt(Square.Parse("f3")));
    }
}

