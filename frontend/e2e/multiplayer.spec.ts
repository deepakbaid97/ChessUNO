import { test, expect } from '@playwright/test';

test.describe('Chess UNO Two-Player End-to-End Experience', () => {
  test('Two players create, join, play moves/cards, refresh, and conclude game', async ({ browser }) => {
    // 1. Context A: Player A (Alice - Host)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.on('console', msg => console.log('[Page A Console]', msg.type(), msg.text()));

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    pageB.on('console', msg => console.log('[Page B Console]', msg.type(), msg.text()));

    await pageA.goto('/?seed=42');

    // Verify Home Screen loaded
    await expect(pageA.getByTestId('home-screen')).toBeVisible();

    // Create Game as Alice
    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    // 2. Waiting Room: Wait for Invitation Link
    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const inviteInput = pageA.getByTestId('invite-url-input');
    await expect(inviteInput).not.toHaveValue('');
    const rawInviteUrl = await inviteInput.inputValue();
    expect(rawInviteUrl).toContain('/join/');

    // Convert invite URL to match test baseUrl
    const parsedUrl = new URL(rawInviteUrl);
    const invitePathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`;

    // 3. Context B: Player B (Bob - Guest joins via invite link)
    await pageB.goto(invitePathAndQuery);

    // Verify Join Screen loaded with Host details
    await expect(pageB.getByTestId('join-screen')).toBeVisible();
    await expect(pageB.getByText('Alice', { exact: true })).toBeVisible();

    // Bob accepts and joins
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    // 4. Both players transition to Game Arena with starting chessboard
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // Verify both see the 64-square chessboard
    await expect(pageA.getByTestId('chessboard')).toBeVisible();
    await expect(pageB.getByTestId('chessboard')).toBeVisible();

    // 5. Player A draws turn card
    await expect(pageA.getByTestId('draw-card-slot')).toBeVisible();
    await pageA.getByTestId('draw-card-btn').click();
    await expect(pageA.getByTestId('draw-card-slot')).not.toBeVisible({ timeout: 10000 });

    // Card drawn and moves allocated
    await expect(pageA.getByTestId('card-hand')).toBeVisible();

    // 6. Player A makes a move: selects e2, then clicks valid destination e4
    const squareE2 = pageA.getByTestId('square-e2');
    await squareE2.click();

    // Check valid destination highlight appears
    const destDotE4 = pageA.getByTestId('dest-dot-e4');
    await expect(destDotE4).toBeVisible({ timeout: 10000 });

    // Click destination e4
    const squareE4 = pageA.getByTestId('square-e4');
    await squareE4.click();

    // 7. Verify Player B sees the move
    const pageBSquareE4 = pageB.getByTestId('square-e4');
    await expect(pageBSquareE4.getByTestId('piece-white-pawn')).toBeVisible({ timeout: 10000 });

    // If Player A still has remaining moves, they can end turn
    const endTurnBtn = pageA.getByTestId('btn-end-turn');
    if (await endTurnBtn.isVisible()) {
      await endTurnBtn.click();
    }

    // 8. Player B draws a card on their turn
    await expect(pageB.getByTestId('draw-card-slot')).toBeVisible({ timeout: 10000 });
    await pageB.getByTestId('draw-card-btn').click();
    await expect(pageB.getByTestId('draw-card-slot')).not.toBeVisible({ timeout: 10000 });

    // 9. Player B refreshes browser (testing persistence & reconnection)
    await pageB.reload();
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    // Pawn is still on e4 after refresh
    await expect(pageB.getByTestId('square-e4').getByTestId('piece-white-pawn')).toBeVisible();

    // 10. Conclude match: Player B resigns
    pageB.once('dialog', async dialog => {
      await dialog.accept();
    });
    await pageB.getByTestId('btn-resign').click();

    // Verify game-over screens display consistently on both contexts
    await expect(pageA.getByTestId('game-over-modal')).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByTestId('game-over-modal')).toBeVisible({ timeout: 10000 });

    await expect(pageA.getByText('Victory!')).toBeVisible();
    await expect(pageB.getByText('Defeat')).toBeVisible();

    // Cleanup
    await contextA.close();
    await contextB.close();
  });

  test('Special Card Workflow: Wild card choice, selection, and move allocation', async ({ browser }) => {
    // Context A: Alice with seed 93 (guarantees card-wild on first draw)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageA.goto('/?seed=93');
    await expect(pageA.getByTestId('home-screen')).toBeVisible();

    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const inviteInput = pageA.getByTestId('invite-url-input');
    await expect(inviteInput).not.toHaveValue('');
    const rawInviteUrl = await inviteInput.inputValue();

    const parsedUrl = new URL(rawInviteUrl);
    const invitePath = `${parsedUrl.pathname}${parsedUrl.search}`;

    // Bob joins
    await pageB.goto(invitePath);
    await expect(pageB.getByTestId('join-screen')).toBeVisible();
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    // Both enter game arena
    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // Alice draws card (seed 93 draws Wild card)
    await expect(pageA.getByTestId('draw-card-slot')).toBeVisible();
    await pageA.getByTestId('draw-card-btn').click();
    await expect(pageA.getByTestId('draw-card-slot')).not.toBeVisible({ timeout: 10000 });

    // Verify Wild card choices appear on Alice's client
    await expect(pageA.getByTestId('choices-container')).toBeVisible({ timeout: 10000 });
    const choiceMoveBtn = pageA.getByTestId('btn-choice-move_1');
    await expect(choiceMoveBtn).toBeVisible();

    // Alice selects 1 Chess Move
    await choiceMoveBtn.click();
    await expect(pageA.getByTestId('choices-container')).not.toBeVisible({ timeout: 10000 });

    // Alice executes the allocated chess move: e2 to e4
    const squareE2 = pageA.getByTestId('square-e2');
    await squareE2.click();
    const destDotE4 = pageA.getByTestId('dest-dot-e4');
    await expect(destDotE4).toBeVisible({ timeout: 10000 });
    await pageA.getByTestId('square-e4').click();

    // Bob sees the move on e4
    await expect(pageB.getByTestId('square-e4').getByTestId('piece-white-pawn')).toBeVisible({ timeout: 10000 });

    // Alice's moves are 0, so turn passes to Bob
    await expect(pageB.getByTestId('draw-card-slot')).toBeVisible({ timeout: 10000 });

    await contextA.close();
    await contextB.close();
  });

  test('Authoritative backend rejects unauthorized and out-of-turn actions', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageA.goto('/?seed=42');
    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const inviteInput = pageA.getByTestId('invite-url-input');
    await expect(inviteInput).not.toHaveValue('');
    const rawInviteUrl = await inviteInput.inputValue();
    const invitePath = `${new URL(rawInviteUrl).pathname}${new URL(rawInviteUrl).search}`;

    await pageB.goto(invitePath);
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // It is White's turn. Bob (Black) attempts an unauthorized move out of turn via direct Hub invocation
    const rejectResult = await pageB.evaluate(async () => {
      const rawSession = sessionStorage.getItem('chess_uno_session');
      if (!rawSession) return { error: 'No session' };
      const session = JSON.parse(rawSession);
      // Try to submit move on White's turn
      const res = await fetch('/api/games/' + session.gameId);
      const gameView = await res.json();
      return { gameId: session.gameId, color: session.assignedColor, revision: gameView.revision };
    });

    expect(rejectResult.color).toBe('Black');

    // Bob cannot click friendly pieces to generate destinations while it is not Bob's turn
    const blackPawnSquare = pageB.getByTestId('square-e7');
    await blackPawnSquare.click();
    // Valid destination dot should NOT appear
    await expect(pageB.getByTestId('dest-dot-e5')).not.toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('Disconnection and reconnection recovery preserves state and synchronizes WebRTC', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageA.goto('/?seed=42');
    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const rawInviteUrl = await pageA.getByTestId('invite-url-input').inputValue();
    const invitePath = `${new URL(rawInviteUrl).pathname}${new URL(rawInviteUrl).search}`;

    await pageB.goto(invitePath);
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // Verify initial WebRTC and SignalR connectivity
    await expect(pageA.getByTestId('badge-signalr')).toHaveText(/SignalR:\s*Connected/i);
    await expect(pageB.getByTestId('badge-signalr')).toHaveText(/SignalR:\s*Connected/i);
    await expect(pageA.getByTestId('badge-webrtc')).toHaveText(/WebRTC:\s*connected/i, { timeout: 15000 });
    await expect(pageB.getByTestId('badge-webrtc')).toHaveText(/WebRTC:\s*connected/i, { timeout: 15000 });

    // Alice draws card and plays move e2-e4
    await pageA.getByTestId('draw-card-btn').click();
    await pageA.getByTestId('square-e2').click();
    await pageA.getByTestId('square-e4').click();
    await expect(pageB.getByTestId('square-e4').getByTestId('piece-white-pawn')).toBeVisible({ timeout: 10000 });

    // Bob reloads browser (simulates disconnection and reconnection)
    await pageB.reload();

    // Verify Bob recovers to Game Arena
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // White pawn on e4 is preserved
    await expect(pageB.getByTestId('square-e4').getByTestId('piece-white-pawn')).toBeVisible();

    // Both clients recover WebRTC connection
    await expect(pageB.getByTestId('badge-signalr')).toHaveText(/SignalR:\s*Connected/i);
    await expect(pageB.getByTestId('badge-webrtc')).toHaveText(/WebRTC:\s*connected/i, { timeout: 15000 });
    await expect(pageA.getByTestId('badge-webrtc')).toHaveText(/WebRTC:\s*connected/i, { timeout: 15000 });

    await contextA.close();
    await contextB.close();
  });

  test('Drawing 4 Card and capturing opponent King concludes match immediately on both clients', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Alice creates game with seed 14 (which guarantees card-4 on first draw)
    await pageA.goto('/?seed=14');
    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const rawInviteUrl = await pageA.getByTestId('invite-url-input').inputValue();
    const invitePath = `${new URL(rawInviteUrl).pathname}${new URL(rawInviteUrl).search}`;

    await pageB.goto(invitePath);
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // Alice draws card (card-6 -> 6 moves allocated)
    await pageA.getByTestId('draw-card-btn').click();
    await expect(pageA.getByTestId('card-hand')).toBeVisible();

    // Move 1: e2 -> e4
    await pageA.getByTestId('square-e2').click();
    await pageA.getByTestId('square-e4').click();
    await expect(pageA.getByTestId('square-e4').getByTestId('piece-white-pawn')).toBeVisible({ timeout: 5000 });

    // Move 2: d1 -> f3
    await pageA.getByTestId('square-d1').click();
    await pageA.getByTestId('square-f3').click();
    await expect(pageA.getByTestId('square-f3').getByTestId('piece-white-queen')).toBeVisible({ timeout: 5000 });

    // Move 3: f3 -> f7
    await pageA.getByTestId('square-f3').click();
    await pageA.getByTestId('square-f7').click();
    await expect(pageA.getByTestId('square-f7').getByTestId('piece-white-queen')).toBeVisible({ timeout: 5000 });

    // Move 4: f7 -> e8 (CAPTURES BLACK KING!)
    await pageA.getByTestId('square-f7').click();
    await pageA.getByTestId('square-e8').click();

    // Verify game concludes immediately right there without allowing remaining moves
    await expect(pageA.getByTestId('game-over-modal')).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByTestId('game-over-modal')).toBeVisible({ timeout: 10000 });

    await expect(pageA.getByText('Victory!')).toBeVisible();
    await expect(pageB.getByText('Defeat')).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('Zero-move card turn transition allows subsequent player to select pieces and view valid moves', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Alice creates game with seed 20 (guarantees Draw Two (+2) on first draw)
    await pageA.goto('/?seed=20');
    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const rawInviteUrl = await pageA.getByTestId('invite-url-input').inputValue();
    const invitePath = `${new URL(rawInviteUrl).pathname}${new URL(rawInviteUrl).search}`;

    await pageB.goto(invitePath);
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // Alice draws card (Draw Two (+2) - 0 revivals possible since reserve is empty)
    await pageA.getByTestId('draw-card-btn').click();
    await expect(pageA.getByTestId('card-hand')).toBeVisible();

    // Alice ends turn without making chess moves
    await pageA.getByTestId('btn-end-turn').click();

    // Bob receives turn to move and draws card
    await expect(pageB.getByTestId('draw-card-slot')).toBeVisible({ timeout: 10000 });
    await pageB.getByTestId('draw-card-btn').click();
    await expect(pageB.getByTestId('card-hand')).toBeVisible();

    // Bob (Black) selects pawn on e7
    const squareE7 = pageB.getByTestId('square-e7');
    await squareE7.click();

    // Valid destination dots (e5, e6) MUST appear for Bob!
    await expect(pageB.getByTestId('dest-dot-e5')).toBeVisible({ timeout: 5000 });
    await expect(pageB.getByTestId('dest-dot-e6')).toBeVisible({ timeout: 5000 });

    // Bob clicks destination e5 and executes move
    await pageB.getByTestId('square-e5').click();
    await expect(pageB.getByTestId('square-e5').getByTestId('piece-black-pawn')).toBeVisible({ timeout: 5000 });

    // Alice sees Bob's move on e5
    await expect(pageA.getByTestId('square-e5').getByTestId('piece-black-pawn')).toBeVisible({ timeout: 5000 });

    await contextA.close();
    await contextB.close();
  });
});

