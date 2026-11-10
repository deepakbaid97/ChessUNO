using System;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.Reserves;

public class ReserveSystemTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void Capture_AddsPieceToFallenPlayerCasualtyPool()
    {
        // White Pawn on e4 captures Black Pawn on d5
        var fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        var game = _engine.CreateFromFen(fen);

        var captureMove = new ChessMove(Square.Parse("e4"), Square.Parse("d5"));
        var afterCapture = _engine.ApplyMove(game, captureMove);

        // Black was captured, so Black's casualty pool gets the Pawn
        Assert.Single(afterCapture.Reserves[PlayerColor.Black]);
        var captured = afterCapture.Reserves[PlayerColor.Black][0];
        Assert.Equal(PieceType.Pawn, captured.PieceType);
        Assert.Equal(PlayerColor.Black, captured.OriginalOwner);

        // White has 0 casualties
        Assert.Empty(afterCapture.Reserves[PlayerColor.White]);
    }

    [Fact]
    public void MultipleCaptures_AccumulateInReserve()
    {
        // Sequence of captures
        var fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        var game = _engine.CreateFromFen(fen);

        // 1. White captures d5 (Black pawn captured)
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e4"), Square.Parse("d5")));
        // 2. Black Queen captures d5 (White pawn captured)
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("d8"), Square.Parse("d5")));

        // Black lost 1 pawn, White lost 1 pawn
        Assert.Single(game.Reserves[PlayerColor.Black]);
        Assert.Equal(PieceType.Pawn, game.Reserves[PlayerColor.Black][0].PieceType);

        Assert.Single(game.Reserves[PlayerColor.White]);
        Assert.Equal(PieceType.Pawn, game.Reserves[PlayerColor.White][0].PieceType);
    }

    [Fact]
    public void CapturingPromotedPiece_EntersReserveAsPromotedType()
    {
        // Black has a promoted Queen on a1. White King on b1 captures the Queen on a1.
        var fen = "4k3/8/8/8/8/8/8/qK6 w - - 0 1";
        var game = _engine.CreateFromFen(fen);

        var captureMove = new ChessMove(Square.Parse("b1"), Square.Parse("a1"));
        var afterCapture = _engine.ApplyMove(game, captureMove);

        Assert.Single(afterCapture.Reserves[PlayerColor.Black]);
        Assert.Equal(PieceType.Queen, afterCapture.Reserves[PlayerColor.Black][0].PieceType);
    }
}

