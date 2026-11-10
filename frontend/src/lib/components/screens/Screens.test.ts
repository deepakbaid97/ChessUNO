import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import HomeScreen from './HomeScreen.svelte';
import WaitingRoom from './WaitingRoom.svelte';
import JoinGameScreen from './JoinGameScreen.svelte';
import GameOverModal from '../game/GameOverModal.svelte';

describe('Screen Components', () => {
  it('HomeScreen creates a match with player name', async () => {
    const { component, getByTestId } = render(HomeScreen);

    let createEvent: any = null;
    component.$on('createGame', (e) => {
      createEvent = e.detail;
    });

    const input = getByTestId('input-create-name');
    await fireEvent.input(input, { target: { value: 'Magnus' } });

    const btn = getByTestId('btn-create-game');
    await fireEvent.click(btn);

    expect(createEvent).toEqual({ playerName: 'Magnus' });
  });

  it('WaitingRoom displays link and copies to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const { getByTestId } = render(WaitingRoom, {
      props: {
        invitationUrl: 'http://localhost:5173/join/token123',
        invitationToken: 'token123',
        playerName: 'Alice',
        assignedColor: 'White'
      }
    });

    const input = getByTestId('invite-url-input') as HTMLInputElement;
    expect(input.value).toBe('http://localhost:5173/join/token123');

    const copyBtn = getByTestId('btn-copy-invite');
    await fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('http://localhost:5173/join/token123');
  });

  it('JoinGameScreen validates token and displays challenger info', async () => {
    const mockApiService: any = {
      getInvitationInfo: vi.fn().mockResolvedValue({
        gameId: 'game-123',
        status: 'WaitingForPlayer',
        creatorName: 'Alice',
        assignedColor: 'Black'
      })
    };

    const { getAllByText, getByTestId, component } = render(JoinGameScreen, {
      props: {
        invitationToken: 'valid-token',
        apiService: mockApiService
      }
    });

    await waitFor(() => {
      expect(mockApiService.getInvitationInfo).toHaveBeenCalledWith('valid-token');
      expect(getAllByText(/Alice/).length).toBeGreaterThan(0);
      expect(getByTestId('btn-confirm-join')).toBeTruthy();
    });

    let joinEvent: any = null;
    component.$on('join', (e) => {
      joinEvent = e.detail;
    });

    await fireEvent.click(getByTestId('btn-confirm-join'));
    expect(joinEvent).toEqual({
      invitationToken: 'valid-token',
      playerName: 'Challenger'
    });
    component.$on('join', (e) => {
      joinEvent = e.detail;
    });

    await fireEvent.click(getByTestId('btn-confirm-join'));
    expect(joinEvent).toEqual({
      invitationToken: 'valid-token',
      playerName: 'Challenger'
    });
  });

  it('GameOverModal displays victory and defeat correctly', () => {
    const { getByText, getByTestId } = render(GameOverModal, {
      props: {
        isOpen: true,
        winner: 'White',
        playerColor: 'White',
        gameStatus: 'Checkmate',
        totalMoves: 12
      }
    });

    expect(getByTestId('game-over-modal')).toBeTruthy();
    expect(getByText('Victory!')).toBeTruthy();
    expect(getByText(/delivered checkmate/)).toBeTruthy();
  });
});
