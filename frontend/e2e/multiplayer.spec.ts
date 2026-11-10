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
});

