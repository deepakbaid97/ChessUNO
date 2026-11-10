using System;
using System.Linq;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.Movement;

public class MovementTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void InitialPosition_WhiteHas20LegalMoves()
    {
        var game = _engine.CreateInitialGame();
        var moves = _engine.GetLegalMoves(game, PlayerColor.White);

        // 16 pawn moves (8 single + 8 double) + 4 knight moves = 20
        Assert.Equal(20, moves.Count);
    }

    [Fact]
    public void Pawn_DoubleStep_MovesSuccessfully()
    {
        var game = _engine.CreateInitialGame();
        var move = new ChessMove(Square.Parse("e2"), Square.Parse("e4"));

        Assert.True(_engine.IsLegalMove(game, PlayerColor.White, move));

        var nextState = _engine.ApplyMove(game, move);

        Assert.Null(nextState.GetPieceAt(Square.Parse("e2")));
        var pawn = nextState.GetPieceAt(Square.Parse("e4"));
        Assert.NotNull(pawn);
        Assert.Equal(PieceType.Pawn, pawn.Type);
        Assert.Equal(PlayerColor.White, pawn.Color);
        Assert.Equal(PlayerColor.Black, nextState.ActivePlayer);
    }

    [Fact]
    public void MovingPieceThroughObstacles_IsIllegal()
    {
        var game = _engine.CreateInitialGame();
        // Rook attempting to jump over pawn: a1 to a3
        var illegalMove = new ChessMove(Square.Parse("a1"), Square.Parse("a3"));

        Assert.False(_engine.IsLegalMove(game, PlayerColor.White, illegalMove));
        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, illegalMove));
    }

    [Fact]
    public void MovingOpponentPiece_IsIllegal()
    {
        var game = _engine.CreateInitialGame(); // White to move
        // Attempting to move Black pawn e7 to e5 on White's turn
        var illegalMove = new ChessMove(Square.Parse("e7"), Square.Parse("e5"));

        Assert.False(_engine.IsLegalMove(game, PlayerColor.White, illegalMove));
        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, illegalMove));
    }

    [Fact]
    public void KingSafety_CannotMoveKingIntoCheck()
    {
        // Position where moving king to e2 would place it into check from black queen on e8
        // 4k3/8/8/8/8/8/4P3/4K3 w - - 0 1
        var game = _engine.CreateFromFen("4k3/4q3/8/8/8/8/8/4K3 w - - 0 1");
        
        // e1 to e2 is attacked by Black Queen on e7
        var illegalMove = new ChessMove(Square.Parse("e1"), Square.Parse("e2"));

        Assert.False(_engine.IsLegalMove(game, PlayerColor.White, illegalMove));
        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, illegalMove));
    }

    [Fact]
    public void PinnedPiece_CannotMoveToExposeKing()
    {
        // White King on e1, White Bishop on e2, Black Queen on e8 pinning the Bishop
        var game = _engine.CreateFromFen("4k3/4q3/8/8/8/8/4B3/4K3 w - - 0 1");
        
        // Moving Bishop off the e-file exposes White King to Black Queen
        var illegalMove = new ChessMove(Square.Parse("e2"), Square.Parse("b5"));

        Assert.False(_engine.IsLegalMove(game, PlayerColor.White, illegalMove));
        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, illegalMove));
    }
}

