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

  it('emits squareSelected instead of moveProposed when mode is swap', async () => {
    const { component, getByTestId } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true,
        mode: 'swap',
        selectedSquare: 'e2',
        validDestinations: ['d2']
      }
    });

    let proposedMove: any = null;
    let selectedSquare: any = null;
    component.$on('moveProposed', (e) => {
      proposedMove = e.detail;
    });
    component.$on('squareSelected', (e) => {
      selectedSquare = e.detail;
    });

    const destSquare = getByTestId('square-d2');
    await fireEvent.click(destSquare);

    expect(proposedMove).toBeNull();
    expect(selectedSquare).toEqual({ square: 'd2' });
  });

  it('highlights eligible squares with revival-target class when in revival mode', () => {
    const { getByTestId } = render(Chessboard, {
      props: {
        fen: initialFen,
        perspective: 'White',
        activePlayer: 'White',
        isMyTurn: true,
        mode: 'revival',
        validDestinations: ['e3', 'e4']
      }
    });

    const squareE3 = getByTestId('square-e3');
    const squareE4 = getByTestId('square-e4');
    expect(squareE3.classList.contains('revival-target')).toBe(true);
    expect(squareE4.classList.contains('revival-target')).toBe(true);
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

  it('highlights the White King when Black gives check, even if activePlayer is Black', () => {
    // Black Queen at h4 attacks White King at e1
    const checkFen = 'rnb1kbnr/pppp1ppp/8/8/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3';
    const { getByTestId } = render(Chessboard, {
      props: {
        fen: checkFen,
        perspective: 'White',
        activePlayer: 'Black', // Black just made the move delivering check
        isMyTurn: false,
        inCheck: true
      }
    });

    const squareE1 = getByTestId('square-e1');
    const squareE8 = getByTestId('square-e8');

    // White King at e1 must have the in-check class
    expect(squareE1.classList.contains('in-check')).toBe(true);
    // Black King at e8 must NOT have the in-check class
    expect(squareE8.classList.contains('in-check')).toBe(false);
  });

  it('highlights the Black King when White gives check, even if activePlayer is White', () => {
    // White Queen at h5 attacks Black King at e8
    const checkFen = 'rnbqkbnr/ppppp2p/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3';
    const { getByTestId } = render(Chessboard, {
      props: {
        fen: checkFen,
        perspective: 'Black',
        activePlayer: 'White',
        isMyTurn: false,
        inCheck: true
      }
    });

    const squareE8 = getByTestId('square-e8');
    const squareE1 = getByTestId('square-e1');

    // Black King at e8 must have the in-check class
    expect(squareE8.classList.contains('in-check')).toBe(true);
    // White King at e1 must NOT have the in-check class
    expect(squareE1.classList.contains('in-check')).toBe(false);
  });
});
