import { test, expect } from '@playwright/test';

test.describe('WebRTC Push-to-Talk Voice Two-Browser E2E Test', () => {
  test('Two players join match, activate voice, transmit audio via PTT repeatedly, leave and rejoin', async ({ browser }) => {
    // 1. Setup Context A (Host / Alice) and Context B (Guest / Bob) with microphone permissions
    const contextA = await browser.newContext({
      permissions: ['microphone']
    });
    const pageA = await contextA.newPage();
    pageA.on('console', msg => console.log('[Page A Console]', msg.type(), msg.text()));

    const contextB = await browser.newContext({
      permissions: ['microphone']
    });
    const pageB = await contextB.newPage();
    pageB.on('console', msg => console.log('[Page B Console]', msg.type(), msg.text()));

    // 2. Alice creates the game
    await pageA.goto('/?seed=77');
    await expect(pageA.getByTestId('home-screen')).toBeVisible();
    await pageA.getByTestId('input-create-name').fill('Alice');
    await pageA.getByTestId('btn-create-game').click();

    await expect(pageA.getByTestId('waiting-room')).toBeVisible();
    const inviteInput = pageA.getByTestId('invite-url-input');
    await expect(inviteInput).not.toHaveValue('');
    const rawInviteUrl = await inviteInput.inputValue();

    const parsedUrl = new URL(rawInviteUrl);
    const invitePath = `${parsedUrl.pathname}${parsedUrl.search}`;

    // 3. Bob joins the game
    await pageB.goto(invitePath);
    await expect(pageB.getByTestId('join-screen')).toBeVisible();
    await pageB.getByTestId('input-join-player-name').fill('Bob');
    await pageB.getByTestId('btn-confirm-join').click();

    // 4. Both arrive in GameArena
    await expect(pageA.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByTestId('game-arena')).toBeVisible({ timeout: 15000 });

    // Verify WebRTC status badge becomes connected
    await expect(pageA.getByTestId('badge-webrtc')).toHaveText(/connected/i, { timeout: 15000 });
    await expect(pageB.getByTestId('badge-webrtc')).toHaveText(/connected/i, { timeout: 15000 });

    // 5. Alice enables voice chat
    const btnEnableVoiceA = pageA.getByTestId('btn-enable-voice');
    await expect(btnEnableVoiceA).toBeVisible();
    await btnEnableVoiceA.click();

    // Alice should see the PTT button
    const pttBtnA = pageA.getByTestId('btn-push-to-talk');
    await expect(pttBtnA).toBeVisible({ timeout: 10000 });

    // 6. Bob enables voice chat
    const btnEnableVoiceB = pageB.getByTestId('btn-enable-voice');
    await expect(btnEnableVoiceB).toBeVisible();
    await btnEnableVoiceB.click();

    // Bob should see the PTT button
    const pttBtnB = pageB.getByTestId('btn-push-to-talk');
    await expect(pttBtnB).toBeVisible({ timeout: 10000 });

    // 7. Push-to-Talk Transmission cycles: Alice transmits, Bob observes speaking state
    for (let i = 1; i <= 3; i++) {
      // Alice presses and holds PTT via keyboard 'v'
      await pageA.keyboard.down('KeyV');
      await expect(pttBtnA).toHaveClass(/transmitting/, { timeout: 3000 });

      // Bob's UI should show Alice speaking
      await expect(pageB.locator('.opponent-voice-status')).toHaveClass(/speaking/, { timeout: 3000 });

      // Alice releases PTT
      await pageA.keyboard.up('KeyV');
      await expect(pttBtnA).not.toHaveClass(/transmitting/, { timeout: 3000 });
      await expect(pageB.locator('.opponent-voice-status')).not.toHaveClass(/speaking/, { timeout: 3000 });

      // Bob presses and holds PTT via Space key
      await pageB.keyboard.down('Space');
      await expect(pttBtnB).toHaveClass(/transmitting/, { timeout: 3000 });
      await expect(pageA.locator('.opponent-voice-status')).toHaveClass(/speaking/, { timeout: 3000 });

      await pageB.keyboard.up('Space');
      await expect(pttBtnB).not.toHaveClass(/transmitting/, { timeout: 3000 });
      await expect(pageA.locator('.opponent-voice-status')).not.toHaveClass(/speaking/, { timeout: 3000 });
    }

    // 8. Test Pointer Events: mouse/touch hold on PTT button
    const boxA = await pttBtnA.boundingBox();
    if (boxA) {
      await pageA.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
      await pageA.mouse.down();
      await expect(pttBtnA).toHaveClass(/transmitting/, { timeout: 3000 });
      await expect(pageB.locator('.opponent-voice-status')).toHaveClass(/speaking/, { timeout: 3000 });

      await pageA.mouse.up();
      await expect(pttBtnA).not.toHaveClass(/transmitting/, { timeout: 3000 });
      await expect(pageB.locator('.opponent-voice-status')).not.toHaveClass(/speaking/, { timeout: 3000 });
    }

    // 9. Alice leaves voice
    const leaveVoiceA = pageA.getByTestId('btn-leave-voice');
    await leaveVoiceA.click();
    await expect(pageA.getByTestId('btn-enable-voice')).toBeVisible({ timeout: 5000 });

    // 10. Alice rejoins voice without reloading
    await pageA.getByTestId('btn-enable-voice').click();
    await expect(pageA.getByTestId('btn-push-to-talk')).toBeVisible({ timeout: 5000 });

    // Verify PTT works again after rejoining
    await pageA.keyboard.down('KeyV');
    await expect(pageA.getByTestId('btn-push-to-talk')).toHaveClass(/transmitting/, { timeout: 3000 });
    await expect(pageB.locator('.opponent-voice-status')).toHaveClass(/speaking/, { timeout: 3000 });
    await pageA.keyboard.up('KeyV');
    await expect(pageA.getByTestId('btn-push-to-talk')).not.toHaveClass(/transmitting/, { timeout: 3000 });

    await contextA.close();
    await contextB.close();
  });
});

