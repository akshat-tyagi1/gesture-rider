# PLAYTEST.md — Organizer Playtest Checklist

A tick-box checklist built from `PLAN.md` to verify the game before and during the event. Anything not yet integrated into the current build is marked with **(planned)**.

---

## 1. First-Time Player Test
- [ ] **Webcam Permission:** Server running on `python3 -m http.server 8000`, page loaded from `http://localhost:8000`, and browser camera prompt accepted.
- [ ] **Webcam Preview:** Corner preview canvas displays live camera feed with MediaPipe tracking landmarks.
- [ ] **Menu Onboarding:** Menu instructions clearly show how to steer (tilt hand), accelerate (open palm), brake (fist), and use keyboard fallback.
- [ ] **Name Input (planned):** Accepts user name up to 12 characters, trimmed, defaulting to "Rider".
- [ ] **Subject Selection (planned):** Player can select from Python, HTML, CSS, or Maths (Quick Start defaults to Python / Rider).
- [ ] **Poor Lighting Test:** Test under dim ambient light, shadow conditions, and moderate backlighting to verify tracking limits and ensure camera angle avoids silhouette dropouts.
- [ ] **First-Time Friend Run:** Have a friend who has never played test the stall. Verify they can grasp the controls within 15 seconds, understand "Show your hand" prompts, and complete a run without confusion.

---

## 2. Keyboard Fallback
- [ ] **Steering Keys:** Pressing `A` / `D` or `Left` / `Right` Arrow keys steers the motorcycle left and right.
- [ ] **Throttle Keys:** Pressing `W`, `Up` Arrow, or `Space` accelerates the motorcycle.
- [ ] **Brake Keys:** Pressing `S` or `Down` Arrow decelerates / brakes the motorcycle.
- [ ] **Instant Override:** Pressing any keyboard control immediately overrides hand gesture input.
- [ ] **Controls Hint HUD:** Keyboard control hint overlay is clearly visible in the UI.
- [ ] **Seamless Switching:** Alternating between hand gestures and keyboard controls during a race is smooth and causes no control lockup or twitching.

---

## 3. Camera Loss
- [ ] **Tracking-Loss Detection:** Cover the camera or pull hand completely out of view for `>300 ms`.
- [ ] **Prompt Display:** "Show your hand" (`#tracking-lost-msg`) banner displays prominently on screen.
- [ ] **Safe Coasting:** Bike coasts and decelerates gradually when tracking is lost; does NOT crash or lose a life.
- [ ] **Recovery:** Returning hand to the camera frame dismisses the banner within 300 ms and immediately resumes steering and throttle control.
- [ ] **Keyboard Rescue:** Pressing any keyboard movement key while hand tracking is lost immediately clears the warning and takes active control.

---

## 4. All 4 Checkpoints
- [ ] **Checkpoint Spacing (planned):** Checkpoints trigger at exactly 20%, 40%, 60%, and 80% of `RACE_DISTANCE`.
- [ ] **Tier Distribution (planned):**
  - CP1 serves an `easy` tier question.
  - CP2 serves an `easy` tier question.
  - CP3 serves an `easy-medium` tier question.
  - CP4 serves a `medium` tier question.
- [ ] **Simulation Pause (planned):** Entering `QUIZ_QUESTION` pauses motorcycle movement, road scrolling, traffic simulation, and the race clock.
- [ ] **Text Security (planned):** Question text, options, and explanations render via `textContent` (no `innerHTML` injection).
- [ ] **600 ms Input Lock (planned):** Answer inputs are locked for the first 600 ms of the question appearing to prevent accidental skips from race button presses.
- [ ] **Answer Input (planned):** Keys `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4` select the corresponding option. Held-key repeat events (`e.repeat`) are strictly ignored.
- [ ] **Quiz Timer (planned):** Countdown timer runs for 15 seconds (Python, HTML, CSS) or 25 seconds (Maths).
- [ ] **Timeout Handling (planned):** Letting the timer expire marks the question as timeout/incorrect (-20 score) and shows feedback.
- [ ] **Feedback Card (planned):** `QUIZ_FEEDBACK` card displays correct answer and a one-sentence explanation.
- [ ] **Countdown & Grace Period (planned):** Resuming the race shows a 3-2-1 countdown followed by a 1.0 s grace period where collision damage is ignored (coins can still be collected).
- [ ] **Traffic Density Ramp (planned):** Traffic density multiplier increases by stage: `[1.0, 1.0, 1.25, 1.5, 1.5]` across stages (start-CP1, CP1-2, CP2-3, CP3-4, CP4-finish), capped at 1.5.

---

## 5. 3 Lives and Early Game Over
- [ ] **Initial Lives:** Player starts every run with exactly 3 lives (HUD displays `❤️❤️❤️`).
- [ ] **Collision Penalty:** Hitting a traffic car or obstacle deducts 1 life and 10 score (`CRASH_PENALTY`).
- [ ] **Collision Feedback:** Collision triggers a brief slowdown (speed cut to 40%), hit sound effect, and red screen flash (300 ms).
- [ ] **Single Hit Obstacle Rule:** Each obstacle can register a hit only once (flagged `hit` until far behind; no invulnerability timer).
- [ ] **HUD Lives Update:** Lives counter decrements visibly on each collision (`❤️❤️❤️` -> `❤️❤️` -> `❤️` -> empty).
- [ ] **Immediate WASTED:** Losing all 3 lives immediately triggers `WASTED` state and stops race progression.
- [ ] **Checkpoint Skip on Wasted (planned):** Any checkpoints not yet reached when crashing out are skipped (not counted as wrong answers).
- [ ] **Game-Over Screen:** `WASTED` screen displays final score, high score, and a restart button.

---

## 6. Scoring
- [ ] **Single Score System:** Single score value displayed on HUD, clamped at `>= 0` after every event (score never drops below zero).
- [ ] **Coin Score:** Collecting a road coin awards `+5` score.
- [ ] **Hidden Coins Counter:** Hidden `coinsCollected` counter increments on every coin pickup and is never decreased on crashes.
- [ ] **Crash Penalty:** Collision deducts `-10` score (`CRASH_PENALTY`), clamped at 0.
- [ ] **Quiz Correct (planned):** Answering a quiz checkpoint correctly awards `+100` score.
- [ ] **Quiz Wrong (planned):** Answering a quiz checkpoint incorrectly deducts `-20` score, clamped at 0.
- [ ] **Quiz Timeout (planned):** Running out of time on a quiz checkpoint deducts `-20` score, clamped at 0.
- [ ] **Finish Bonus (planned):** Reaching 100% distance awards `+50` finish bonus.
- [ ] **No Legacy Scoring:** Baseline "close call +500" and distance-based incremental scoring are completely removed.
- [ ] **Results Screen Stats (planned):** Accuracy, correct counts, and timeout stats appear only on Results screen, keeping in-race HUD compact.

---

## 7. Leaderboard Persistence (planned)
- [ ] **Storage Key (planned):** Leaderboard entries persist in `localStorage` under `gestureRider.v1.leaderboard`.
- [ ] **Top 10 Display (planned):** Leaderboard displays the top 10 ranked players.
- [ ] **Sorting Order (planned):** Sorted by score descending; tied scores broken by `coinsCollected` descending.
- [ ] **Personal Best (planned):** Player personal bests tracked case-insensitively under `gestureRider.v1.pb`.
- [ ] **Duplicate Run Prevention (planned):** Duplicate submissions from the same completed run are blocked via `gestureRider.v1.runs`.
- [ ] **Data Validation:** Corrupted or invalid JSON items in `localStorage` are dropped on load without crashing the game (`Store.load()` validation).
- [ ] **Organizer Reset Shortcut (planned):** Pressing `Ctrl + Shift + L` and typing `RESET` clears all leaderboard, personal best, and run data.

---

## 8. Repeated Participants
- [ ] **PB Update (planned):** Player completing a second run with the same name updates personal best only if the new score exceeds the old one.
- [ ] **Leaderboard Deduplication (planned):** Leaderboard shows a player's personal best rather than multiple duplicate entries for the same name.
- [ ] **Deterministic Road Fairness:** Fixed seed (`SEED = 42`) generates identical road curves, hills, traffic placement, and coin spawns across every run.
- [ ] **Quick Restart (planned):** Restarting via Quick Start ("Rider" / Python) resets state cleanly and allows rapid replay.

---

## 9. Inactivity Reset (planned)
- [ ] **Inactivity Warning (planned):** Warning message appears at 45 seconds of no keyboard or hand gesture input.
- [ ] **Return to Menu (planned):** Game resets back to `MENU` state after 60 seconds of continuous inactivity.
- [ ] **Quiz Protection (planned):** Inactivity timer is strictly paused during `QUIZ_QUESTION`, `QUIZ_FEEDBACK`, and `COUNTDOWN` states.
- [ ] **Timer Reset (planned):** Pressing any key or moving a hand in front of the camera immediately cancels the warning and resets the 60-second timer.

---

## 10. 5 Runs in a Row with No Slowdown
- [ ] **Consecutive Runs:** Complete 5 full consecutive runs back-to-back in the same browser window without refreshing the page.
- [ ] **Stable 60 FPS:** Game maintains smooth frame rate with no progressive lag, stuttering, or memory leaks across all 5 runs.
- [ ] **Single Loop Check:** Restarting a run does not spawn secondary `requestAnimationFrame` loops.
- [ ] **Delta Time Clamping:** Delta time remains clamped to `0.05 s` (`Math.min(dt, 0.05)`), preventing physics leaps.
- [ ] **Object & Particle Cleanup:** Particle system, road segments, and hit states are cleanly reset on each restart.
- [ ] **Audio Cleanliness:** Web Audio engine synthesis and sound effects remain crisp without clipping, buzzing, or accumulating audio oscillators across runs.
