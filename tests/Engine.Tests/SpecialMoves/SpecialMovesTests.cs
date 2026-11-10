using System;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.SpecialMoves;

public class SpecialMovesTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void Castling_Kingside_ExecutesSuccessfully()
    {
        // Board with cleared path for White kingside castling: King on e1, Rook on h1
        var fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
        var game = _engine.CreateFromFen(fen);

        var castleMove = new ChessMove(Square.Parse("e1"), Square.Parse("g1"));
        Assert.True(_engine.IsLegalMove(game, PlayerColor.White, castleMove));

        var afterCastle = _engine.ApplyMove(game, castleMove);

        // King is on g1, Rook is on f1
        var king = afterCastle.GetPieceAt(Square.Parse("g1"));
        var rook = afterCastle.GetPieceAt(Square.Parse("f1"));

        Assert.NotNull(king);
        Assert.Equal(PieceType.King, king.Type);
        Assert.NotNull(rook);
        Assert.Equal(PieceType.Rook, rook.Type);
    }

    [Fact]
    public void Castling_ThroughCheck_IsIllegal()
    {
        // White King on e1, Rook on h1. Black Rook on f8 attacking f1 (the transit square).
        var fen = "5r2/8/8/8/8/8/8/R3K2R w KQ - 0 1";
        var game = _engine.CreateFromFen(fen);

        var castleMove = new ChessMove(Square.Parse("e1"), Square.Parse("g1"));
        Assert.False(_engine.IsLegalMove(game, PlayerColor.White, castleMove));
        Assert.Throws<InvalidOperationException>(() => _engine.ApplyMove(game, castleMove));
    }

    [Fact]
    public void EnPassant_CapturesPawnCorrectly()
    {
        // White pawn on e5, Black pawn on d7. Black plays d7 to d5, setting en passant square d6.
        var fen = "rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        var game = _engine.CreateFromFen(fen);

        var blackDoubleStep = new ChessMove(Square.Parse("d7"), Square.Parse("d5"));
        var afterBlack = _engine.ApplyMove(game, blackDoubleStep);

        // White captures en passant: e5 to d6
        var enPassantMove = new ChessMove(Square.Parse("e5"), Square.Parse("d6"));
        Assert.True(_engine.IsLegalMove(afterBlack, PlayerColor.White, enPassantMove));

        var afterCapture = _engine.ApplyMove(afterBlack, enPassantMove);

        // White pawn is on d6, black pawn on d5 is captured
        Assert.NotNull(afterCapture.GetPieceAt(Square.Parse("d6")));
        Assert.Null(afterCapture.GetPieceAt(Square.Parse("d5")));

        // Black casualty reserve has the captured pawn
        Assert.Contains(afterCapture.Reserves[PlayerColor.Black], r => r.PieceType == PieceType.Pawn);
    }

    [Fact]
    public void PawnPromotion_PromotesToChosenPiece()
    {
        // White pawn on e7 ready to promote to e8. King on a8 (e8 is empty).
        var fen = "k7/4P3/8/8/8/8/8/4K3 w - - 0 1";
        var game = _engine.CreateFromFen(fen);

        var promoMove = new ChessMove(Square.Parse("e7"), Square.Parse("e8"), PromotionPiece: PieceType.Queen);
        Assert.True(_engine.IsLegalMove(game, PlayerColor.White, promoMove));

        var afterPromo = _engine.ApplyMove(game, promoMove);

        var queen = afterPromo.GetPieceAt(Square.Parse("e8"));
        Assert.NotNull(queen);
        Assert.Equal(PieceType.Queen, queen.Type);
        Assert.Equal(PlayerColor.White, queen.Color);
    }
}
