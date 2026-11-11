import { get } from 'svelte/store';
import { gameStore } from '../stores/gameStore';
import { showToast } from '../stores/toastStore';
import type { SignalRService } from './signalrService';
import type { PieceType } from '../types/game';

export function generateActionId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function proposeMove(
  signalR: SignalRService,
  from: string,
  to: string,
  promotion?: PieceType
): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  const actionId = generateActionId();
  console.log('[gameActions] Proposing move:', { from, to, promotion, actionId });

  try {
    const success = await signalR.submitMove(
      session.gameId,
      session.playerToken,
      from,
      to,
      promotion,
      actionId,
      session.revision
    );
    console.log('[gameActions] submitMove result:', success);

    if (!success) {
      gameStore.clearSelection();
      showToast('Move rejected by authoritative referee.', 'error');
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[gameActions] Error:', err);
    gameStore.clearSelection();
    showToast(`Move failed: ${err.message}`, 'error');
    return false;
  }
}

export async function drawCard(signalR: SignalRService): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  const actionId = generateActionId();
  console.log('[gameActions] Invoking DrawCard on hub with gameId:', session.gameId);

  try {
    const success = await signalR.drawCard(
      session.gameId,
      session.playerToken,
      actionId,
      session.revision
    );
    console.log('[gameActions] Draw result:', success);
    if (!success) {
      showToast('Unable to draw card on server.', 'error');
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[gameActions] Draw threw:', err);
    showToast(`Draw failed: ${err.message}`, 'error');
    return false;
  }
}

export async function submitChoice(signalR: SignalRService, choice: string): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  const actionId = generateActionId();
  try {
    const success = await signalR.submitChoice(
      session.gameId,
      session.playerToken,
      choice,
      actionId,
      session.revision
    );
    if (!success) {
      showToast('Choice rejected by server.', 'error');
      return false;
    }
    return true;
  } catch (err: any) {
    showToast(`Choice failed: ${err.message}`, 'error');
    return false;
  }
}

export async function endTurn(signalR: SignalRService): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  const actionId = generateActionId();
  try {
    const success = await signalR.endTurn(
      session.gameId,
      session.playerToken,
      actionId,
      session.revision
    );
    if (!success) {
      showToast('Cannot end turn at this time.', 'error');
      return false;
    }
    return true;
  } catch (err: any) {
    showToast(`End turn failed: ${err.message}`, 'error');
    return false;
  }
}

export async function submitSwap(signalR: SignalRService, sq1: string, sq2: string): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  const actionId = generateActionId();
  try {
    const success = await signalR.submitSwap(
      session.gameId,
      session.playerToken,
      sq1,
      sq2,
      actionId,
      session.revision
    );
    if (!success) {
      // Authoritative rejection reason is dispatched via ActionRejected event by sessionCoordinator
      return false;
    }
    return true;
  } catch (err: any) {
    showToast(`Swap failed: ${err.message}`, 'error');
    return false;
  }
}

export async function submitRevival(
  signalR: SignalRService,
  pieceType: string,
  targetSquare: string
): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  const actionId = generateActionId();
  try {
    const success = await signalR.submitRevival(
      session.gameId,
      session.playerToken,
      pieceType,
      targetSquare,
      actionId,
      session.revision
    );
    if (!success) {
      // Authoritative rejection reason is dispatched via ActionRejected event by sessionCoordinator
      return false;
    }
    return true;
  } catch (err: any) {
    showToast(`Revival failed: ${err.message}`, 'error');
    return false;
  }
}

export async function resignMatch(signalR: SignalRService): Promise<boolean> {
  const session = get(gameStore);
  if (!session.gameId || !session.playerToken) return false;

  try {
    await signalR.resign(session.gameId, session.playerToken);
    showToast('You resigned the match.', 'info');
    return true;
  } catch (err: any) {
    showToast(`Resign failed: ${err.message}`, 'error');
    return false;
  }
}

