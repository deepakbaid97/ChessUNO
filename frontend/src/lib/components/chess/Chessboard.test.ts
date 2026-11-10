import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Chessboard from './Chessboard.svelte';

describe('Chessboard Component', () => {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('renders 64 squares', () => {
    const { container } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true
      }
    });

    const squares = container.querySelectorAll('.square');
    expect(squares.length).toBe(64);
  });

  it('renders pieces according to initial FEN', () => {
    const { getByTestId, getAllByTestId } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true
      }
    });

    expect(getByTestId('piece-white-king')).toBeTruthy();
    expect(getByTestId('piece-black-king')).toBeTruthy();
    expect(getAllByTestId('piece-white-rook').length).toBe(2);
  });

  it('highlights legal destinations when piece is selected', () => {
    const { getByTestId, queryByTestId } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true,
        selectedSquare: 'e2',
        validDestinations: ['e3', 'e4']
      }
    });

    expect(getByTestId('dest-dot-e3')).toBeTruthy();
    expect(getByTestId('dest-dot-e4')).toBeTruthy();
    expect(queryByTestId('dest-dot-e5')).toBeNull();
  });

  it('orients board with rank 1 at bottom for White and rank 8 at bottom for Black', () => {
    const { container: whiteContainer } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true
      }
    });
    const whiteFirstSquare = whiteContainer.querySelector('.square');
    expect(whiteFirstSquare?.getAttribute('data-square')).toBe('a8');

    const { container: blackContainer } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'Black',
        activePlayer: 'Black',
        isMyTurn: true
      }
    });
    const blackFirstSquare = blackContainer.querySelector('.square');
    expect(blackFirstSquare?.getAttribute('data-square')).toBe('h1');
  });

  it('emits moveProposed when clicking a valid destination', async () => {
    const { component, getByTestId } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true,
        selectedSquare: 'e2',
        validDestinations: ['e4']
      }
    });

    let proposedMove: any = null;
    component.$on('moveProposed', (e) => {
      proposedMove = e.detail;
    });

    const destSquare = getByTestId('square-e4');
    await fireEvent.click(destSquare);

    expect(proposedMove).toEqual({ from: 'e2', to: 'e4' });
  });

  it('displays loading indicator when isSubmitting is true', () => {
    const { getByTestId } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true,
        isSubmitting: true
      }
    });

    expect(getByTestId('board-loading')).toBeTruthy();
  });
});
