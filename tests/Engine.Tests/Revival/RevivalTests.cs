using System;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Domain.Reserves;
using ChessUno.Core.GameEngine;
using Xunit;

namespace Engine.Tests.Revival;

public class RevivalTests
{
    private readonly ChessEngine _engine = new();

    [Fact]
    public void ValidRevival_PlacesPieceOnBoardAndRemovesFromReserve()
    {
        // 1. Setup a position where White captures Black Pawn
        var fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        var game = _engine.CreateFromFen(fen);
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e4"), Square.Parse("d5")));

        // Black is now active and has a Pawn in reserves
        Assert.Equal(PlayerColor.Black, game.ActivePlayer);
        Assert.Single(game.Reserves[PlayerColor.Black]);

        // Black revives Pawn on empty square in Black's half (e.g., e6)
        var targetSquare = Square.Parse("e6");
        var afterRevival = _engine.ApplyRevival(game, PlayerColor.Black, PieceType.Pawn, targetSquare);

        // Piece should be on e6
        var placedPiece = afterRevival.GetPieceAt(targetSquare);
        Assert.NotNull(placedPiece);
        Assert.Equal(PieceType.Pawn, placedPiece.Type);
        Assert.Equal(PlayerColor.Black, placedPiece.Color);

        // Reserve should now be empty
        Assert.Empty(afterRevival.Reserves[PlayerColor.Black]);

        // History record should exist
        var lastRecord = afterRevival.MoveHistory[^1];
        Assert.Equal(ChessActionType.Revival, lastRecord.ActionType);
        Assert.Equal(targetSquare, lastRecord.ToSquare);
    }

    [Fact]
    public void Revival_OnOccupiedSquare_IsRejectedAndStatePreserved()
    {
        var fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        var game = _engine.CreateFromFen(fen);
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e4"), Square.Parse("d5")));

        // e7 is occupied by Black's own pawn
        var occupiedSquare = Square.Parse("e7");
        var fenBefore = game.Fen;

        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyRevival(game, PlayerColor.Black, PieceType.Pawn, occupiedSquare));

        Assert.Equal(fenBefore, game.Fen);
        Assert.Single(game.Reserves[PlayerColor.Black]);
    }

    [Fact]
    public void Revival_OutsidePlayerHalf_IsRejected()
    {
        var fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        var game = _engine.CreateFromFen(fen);
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e4"), Square.Parse("d5")));

        // Black attempting to revive on e4 (White's half: ranks 1-4)
        var invalidSquare = Square.Parse("e4");

        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyRevival(game, PlayerColor.Black, PieceType.Pawn, invalidSquare));
    }

    [Fact]
    public void PawnRevival_OnRank8_IsRejected()
    {
        var fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        var game = _engine.CreateFromFen(fen);
        game = _engine.ApplyMove(game, new ChessMove(Square.Parse("e4"), Square.Parse("d5")));

        // Black attempting to revive Pawn on a8 (rank 8 is back rank / promotion rank)
        // Clear a8 first for the test scenario
        var emptyBackRankFen = "1nbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
        var customGame = _engine.CreateFromFen(emptyBackRankFen);
        // Inject a captured pawn into Black's reserve
        var customState = customGame with
        {
            Reserves = new System.Collections.Generic.Dictionary<PlayerColor, System.Collections.Generic.IReadOnlyList<ReservePiece>>
            {
                [PlayerColor.White] = new System.Collections.Generic.List<ReservePiece>(),
                [PlayerColor.Black] = new System.Collections.Generic.List<ReservePiece>
                {
                    new(Guid.NewGuid(), PieceType.Pawn, PlayerColor.Black, 1)
                }
            }
        };

        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyRevival(customState, PlayerColor.Black, PieceType.Pawn, Square.Parse("a8")));
    }

    [Fact]
    public void KingRevival_IsAlwaysForbidden()
    {
        var game = _engine.CreateInitialGame();

        Assert.Throws<InvalidOperationException>(() =>
            _engine.ApplyRevival(game, PlayerColor.White, PieceType.King, Square.Parse("e3")));
    }
}
