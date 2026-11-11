# Chess UNO — WebRTC Push-to-Talk Voice Chat Architecture & Specification

## 1. Overview

Chess UNO features peer-to-peer real-time voice chat alongside authoritative multiplayer chess and Uno card mechanics. Voice communication is implemented using the WebRTC `sendrecv` audio transceiver architecture with a strict Push-to-Talk (PTT) paradigm.

---

## 2. Core Architecture

```
                  SignalR Hub (/hubs/game)
                 [Authoritative Game Signaling]
                  /                          \
         Offer / Answer / ICE       Offer / Answer / ICE
                /                              \
               v                                v
     [Player A: White (Initiator)] <==============> [Player B: Black (Responder)]
       RTCPeerConnection (Epoch N)    WebRTC P2P      RTCPeerConnection (Epoch M)
       - Audio Transceiver (sendrecv)                - Audio Transceiver (sendrecv)
       - Persistent Local Audio Track                - Persistent Local Audio Track
       - RTP Sender (replaceTrack)                   - RTP Sender (replaceTrack)
       - DataChannel ('chess-uno-p2p')               - DataChannel ('chess-uno-p2p')
```

### 2.1. Peer Connection Lifecycle & Idempotency
- **Centralized Orchestration:** WebRTC connection state is orchestrated via `syncWebRtcSession()` in `App.svelte`, replacing fragmented calls across individual callbacks.
- **Idempotency:** Calling `initializePeerConnection()` or `ensurePeerConnection()` reuses existing active or connecting connections without destroying them.
- **Role Assignment & Collision Handling:** White acts as the designated initiator; Black acts as the responder. Glare collisions are handled via the W3C polite peer rollback pattern.
- **Epoch Correlation:** Each connection generation increments a local `connectionEpoch`. Answers and ICE candidates include `inReplyToEpoch` so that stale signals from past connections or across reconnections are safely discarded without rejecting valid messages from the remote peer.
- **Candidate Queuing:** ICE candidates arriving before remote description installation are queued per epoch and drained in order after remote description is applied.
- **SignalR Reconnect Safety:** SignalR reconnections re-verify the active match room without tearing down or replacing healthy WebRTC sessions.

---

## 3. Microphone & Audio Stream Lifecycle

- **Stream Reuse:** `enableMicrophone()` checks if an existing local audio stream has a `live` track (`readyState === 'live'`). If so, it reuses the stream immediately without prompting the user or re-requesting devices via `navigator.mediaDevices.getUserMedia()`.
- **Sender Attachment via `replaceTrack()`:** Local audio tracks are attached directly to the existing audio sender/transceiver using `replaceTrack(track)`. This avoids triggering unnecessary SDP renegotiations.
- **Persistent Track Retention:** The microphone track remains live while voice chat is enabled. Releasing the PTT button only sets `track.enabled = false`; it does **not** stop the track.
- **Track Teardown:** Local tracks are stopped only when the user explicitly leaves voice chat (`closeAudio()`), disconnects, or the session concludes.
- **Track Event Handling:** Local audio tracks register listeners for `ended`, `mute`, and `unmute`. If a hardware disconnect occurs, `onLocalTrackEnded` updates `voiceStore` and alerts the user.
- **Permission Error Handling:** `getUserMedia` rejections distinguish between permission denials (`NotAllowedError`), missing devices (`NotFoundError`), and generic errors to surface user-friendly notifications.

---

## 4. Push-to-Talk Transmission

- **Track Gating:**
  - **Press / Hold:** Local audio track enabled (`track.enabled = true`).
  - **Release:** Local audio track disabled (`track.enabled = false`).
- **Pointer Events:** The PTT button in `PushToTalkControl.svelte` utilizes unified Pointer Events (`on:pointerdown`, `on:pointerup`, `on:pointercancel`, `on:lostpointercapture`) with `setPointerCapture`. This guarantees that moving the pointer outside the button boundary during speech does not cause stuck transmitting states.
- **Keyboard Shortcuts:**
  - `KeyV` and `Space` act as push-to-talk triggers.
  - `Space` calls `e.preventDefault()` to prevent page scrolling.
  - Shortcut handlers ignore events originating from `<input>`, `<textarea>`, `<select>`, `isContentEditable` nodes, or elements with `role="textbox"`.
- **Failsafe Releases:**
  - Duplicate pointer-down or key-down events while transmitting are ignored.
  - Window blur events (`window.onblur`) immediately release the microphone.
  - Component unmounting (`onDestroy`) immediately releases the microphone.
  - Disabled controls (`disabled={true}`) reject activation.

---

## 5. Voice Status Synchronization & Remote Playback

- **Transmission Independence:** Audio transmission over RTP is decoupled from DataChannel status. Voice continues to transmit even if the DataChannel is connecting, closed, or unavailable.
- **Signaling Fallback:** If the DataChannel is unavailable, voice status messages (`voice-status`) fall back to SignalR `SendSignal`.
- **Speaking Watchdog:** When `speaking: true` is received, a 15-second watchdog timer starts. If `speaking: false` is dropped due to packet loss or unexpected peer exit, the opponent speaking indicator resets automatically.
- **Disconnect Reset:** Opponent disconnect events immediately clear opponent speaking and voice-active indicators.
- **Stable Remote Audio Element:** The `<audio id="chessuno-remote-audio">` DOM element is maintained stably across voice activations rather than being repeatedly removed and recreated.
- **Autoplay Handling:** Browser autoplay rejections (`NotAllowedError`) mark `audioPlaybackPending = true`. Any user interaction (`click`, `keydown`, `pointerdown`) triggers `unlockAudio()` to resume playback.
- **Opponent Muting:** Muting the opponent sets `audioElement.muted = true`. WebRTC RTP tracks continue flowing undisturbed in the background.

---

## 6. Verification Matrix

### 6.1. Unit & Component Tests (Vitest)
Located in `frontend/src/lib/services/webrtcService.test.ts` and `frontend/src/lib/components/game/PushToTalkControl.test.ts`.

| ID | Description | Result |
|---|---|---|
| **A1** | Initial peer connection created successfully with epoch 1 | Pass |
| **A2** | Multiple `initializePeerConnection()` calls reuse existing connection without closing | Pass |
| **A3** | Duplicate offer creation prevented while offer is in progress | Pass |
| **A4** | Both players complete offer/answer negotiation cleanly | Pass |
| **A5** | Early ICE candidates arriving before remote description are queued | Pass |
| **A6** | Queued ICE candidates are drained and applied after remote description is set | Pass |
| **A7** | Stale candidates from an older connection epoch are discarded | Pass |
| **A8** | SignalR reconnect does not create duplicate peer connections | Pass |
| **A9** | Controlled recreation flow (`restartConnection`) recovers failed connection with incremented epoch | Pass |
| **B1** | First voice activation requests microphone permission | Pass |
| **B2** | Repeated activation reuses existing live microphone stream | Pass |
| **B3** | Ended microphone track triggers recovery callback and fetches fresh stream | Pass |
| **B4** | Microphone permission denial produces user-friendly error message | Pass |
| **B5** | Leaving voice stops all local tracks | Pass |
| **B6** | Rejoining voice obtains fresh stream and re-attaches sender | Pass |
| **B7** | Existing audio sender receives replacement track via `replaceTrack()` without SDP renegotiation | Pass |
| **C1** | First press enables microphone track | Pass |
| **C2** | Release disables microphone track | Pass |
| **C3** | Repeated press/release cycles work 25 consecutive times without degradation | Pass |
| **C4-5** | Track ID and RTP sender remain unchanged across normal PTT cycles | Pass |
| **C6** | Duplicate pointer-down events do not trigger duplicate starts | Pass |
| **C7** | Pointer cancellation releases the microphone | Pass |
| **C8** | Lost pointer capture releases the microphone | Pass |
| **C9** | Window blur releases the microphone | Pass |
| **C10** | Component destruction releases the microphone | Pass |
| **C11** | Keyboard `KeyV` shortcut activates and deactivates transmission | Pass |
| **C12** | Keyboard `Space` shortcut activates transmission without scrolling page | Pass |
| **C13** | Keyboard shortcuts do not activate while typing in inputs or textareas | Pass |
| **C14** | Disabled controls cannot activate transmission | Pass |
| **C15** | Microphone track never remains enabled after release | Pass |
| **D1** | Speaking status transmitted over DataChannel when open | Pass |
| **D2** | DataChannel unavailability does not break RTP audio transmission | Pass |
| **D3** | Opponent speaking indicator updates correctly | Pass |
| **D4** | Opponent speaking indicator resets on disconnect | Pass |
| **D5** | Remote audio attaches correctly when tracks arrive | Pass |
| **D6** | Remote audio playback retries after user interaction on autoplay block | Pass |
| **D7** | Muting opponent suppresses playback without affecting incoming tracks | Pass |
| **D8** | Remote track ending resets stream and speaking indicator | Pass |

### 6.2. Two-Peer Integration Test
Located in `frontend/src/lib/services/webrtcIntegration.test.ts`.
- Simulates two complete `WebRtcService` instances exchanging signaling messages over an asynchronous pipe.
- Verifies joining voice, peer negotiation, 12 alternating speaking cycles, leaving voice, rejoining voice with fresh streams, and SignalR reconnect preservation without connection teardown.

### 6.3. Playwright Dual-Browser End-to-End Test
Located in `frontend/e2e/webrtcVoice.spec.ts`.
- Launches two real Chromium browser contexts with fake media stream devices (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`) and microphone permissions.
- Alice (Host / White) and Bob (Guest / Black) join a real match, establish WebRTC peer connection, enable voice, transmit audio via PTT (`KeyV`, `Space`, mouse drag), verify mutual speaking indicators, leave voice, and rejoin voice seamlessly.

