using System;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.Serialization;

public class BoardFoundationTests
{
    [Theory]
    [InlineData("a1", 'a', 1)]
    [InlineData("e4", 'e', 4)]
    [InlineData("h8", 'h', 8)]
    public void Square_ParsesAlgebraicNotationCorrectly(string notation, char expectedFile, int expectedRank)
    {
        var square = Square.Parse(notation);
        Assert.Equal(expectedFile, square.File);
        Assert.Equal(expectedRank, square.Rank);
        Assert.Equal(notation, square.ToString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("i1")]
    [InlineData("a0")]
    [InlineData("a9")]
    [InlineData("e44")]
    public void Square_InvalidNotation_ThrowsArgumentException(string invalid)
    {
        Assert.Throws<ArgumentException>(() => Square.Parse(invalid));
    }

    [Fact]
    public void InitialPosition_ContainsStandardPieces()
    {
        var engine = new ChessEngine();
        var initial = engine.CreateInitialGame();

        Assert.Equal("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", initial.Fen);
        Assert.Equal(PlayerColor.White, initial.ActivePlayer);
        Assert.Equal(GameStatus.Active, initial.Status);
        Assert.Equal(0, initial.HalfMoveClock);
        Assert.Equal(1, initial.FullMoveNumber);

        // Check pieces on board
        var whiteKing = initial.GetPieceAt(Square.Parse("e1"));
        Assert.NotNull(whiteKing);
        Assert.Equal(PieceType.King, whiteKing.Type);
        Assert.Equal(PlayerColor.White, whiteKing.Color);

        var blackQueen = initial.GetPieceAt(Square.Parse("d8"));
        Assert.NotNull(blackQueen);
        Assert.Equal(PieceType.Queen, blackQueen.Type);
        Assert.Equal(PlayerColor.Black, blackQueen.Color);

        var emptySquare = initial.GetPieceAt(Square.Parse("e4"));
        Assert.Null(emptySquare);
    }

    [Fact]
    public void GameState_SerializesAndDeserializes_Losslessly()
    {
        var engine = new ChessEngine();
        var initial = engine.CreateInitialGame("1.0.0");

        var json = engine.Serialize(initial);
        var restored = engine.Deserialize(json);

        Assert.Equal(initial.Fen, restored.Fen);
        Assert.Equal(initial.ActivePlayer, restored.ActivePlayer);
        Assert.Equal(initial.Status, restored.Status);
        Assert.Equal(initial.ConfigVersion, restored.ConfigVersion);
        Assert.Equal(initial.FullMoveNumber, restored.FullMoveNumber);
        Assert.Equal(initial.HalfMoveClock, restored.HalfMoveClock);
    }
}

