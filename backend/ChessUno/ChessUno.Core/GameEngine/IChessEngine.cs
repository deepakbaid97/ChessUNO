using System.Collections.Generic;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;

namespace ChessUno.Core.GameEngine;

public interface IChessEngine
{
    GameState CreateInitialGame(string configVersion = "1.0.0");
    GameState CreateFromFen(string fen, string configVersion = "1.0.0");
    IReadOnlyList<ChessMove> GetLegalMoves(GameState state, PlayerColor player);
    bool IsLegalMove(GameState state, PlayerColor player, ChessMove move);
    GameState ApplyMove(GameState state, ChessMove move);
    GameState ApplyMove(GameState state, ChessMove move, bool toggleTurn);
    GameState ApplyRevival(GameState state, PlayerColor player, PieceType pieceType, Square targetSquare);
    GameState ApplySwap(GameState state, PlayerColor player, Square sq1, Square sq2);
    bool IsTerminalState(GameStatus status);
    string Serialize(GameState state);
    GameState Deserialize(string json);
}
