# EVENT-GUIDE.md — Stall Organizer Guide

Practical guide for organizers running the Gesture Rider stall at a university tech event.

---

## 1. Pre-Event Setup

Follow these steps before opening the stall to players:

1. **Start the Local Web Server**
   - Open a terminal inside the project directory:
     ```bash
     cd /path/to/gesture-rider
     python3 -m http.server 8000
     ```
   - Keep this terminal process running in the background throughout the event.

2. **Open the Game URL**
   - Always open: `http://localhost:8000`
   - **Crucial:** Always use `http://localhost:8000`. Do **not** use `http://127.0.0.1:8000` or open files directly (`file://`). Browser camera permissions require a secure origin (`localhost`), and browser `localStorage` (leaderboard, personal bests) is strictly origin-specific.

3. **Allow the Camera**
   - When the browser displays the camera permission prompt, click **Allow**.
   - Verify that the webcam preview feed appears in the corner and the status reads "Tracking" once a hand is raised in front of the lens.

4. **Go Fullscreen**
   - Press **F11** (or `Fn + F11` / browser Fullscreen shortcut `Cmd + Shift + F` on macOS).
   - Running fullscreen hides browser toolbars, bookmarks, and prevents accidental clicks outside the canvas.

5. **Lighting & Camera Placement Tips**
   - **Front Lighting:** Illuminate the player's hand from the front or above. Avoid strong backlights, open windows, or bright spotlights directly behind the player; backlighting creates silhouettes that cause MediaPipe hand tracking to fail.
   - **Camera Height & Angle:** Mount the webcam at chest or desk height, angled straight or slightly upward toward the player's chest/hand area.
   - **Player Distance:** Players should stand or sit approximately 0.5 m to 1.0 m away from the camera.
   - **Clean Background:** Keep the space directly behind the player as clear as possible. Crowds walking close behind can disrupt hand detection.

---

## 2. Player Flow at the Stall

Each run takes approximately 1 to 2 minutes. Guide players through the following sequence:

1. **Name Entry (planned)**
   - Player enters their name (maximum 12 characters, trimmed; default: "Rider").
2. **Subject Selection (planned)**
   - Player chooses a quiz topic: **Python**, **HTML**, **CSS**, or **Maths** (or uses Quick Start: Python / Rider).
3. **The Race**
   - **Steer:** Tilt hand left or right like turning a doorknob (or use keyboard `A`/`D` or Left/Right Arrow keys).
   - **Accelerate:** Open palm wide (or press `W` / Up Arrow / Space).
   - **Brake:** Form a fist (or press `S` / Down Arrow).
   - **Lives & Collisions:** The player starts with 3 lives (`❤️❤️❤️`). Hitting traffic or obstacles deducts 1 life, penalizes 10 points (score clamped at `>= 0`), triggers a brief slowdown, and flashes the screen red.
   - **Coins:** Collecting road coins awards +5 points.
   - **Early Game Over:** Losing all 3 lives immediately triggers `WASTED` state; remaining checkpoints are skipped.
4. **Quiz Checkpoints (planned)**
   - At 20%, 40%, 60%, and 80% of race distance, the race pauses for a multiple-choice question.
   - Tiers: CP1 (Easy), CP2 (Easy), CP3 (Easy-Medium), CP4 (Medium).
   - Timer: 15 seconds (Python, HTML, CSS) or 25 seconds (Maths). Input is locked for the first 600 ms to avoid accidental keypresses.
   - Answer keys: `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4`.
   - Scoring: Correct = +100 score; Wrong = -20 score; Timeout = -20 score.
   - Resume: 3-2-1 countdown followed by a 1.0 s grace period where collision damage is ignored (coins can still be collected).
5. **Results (planned)**
   - Reaching 100% distance awards a +50 finish bonus.
   - Results screen displays final score, coins collected, accuracy/stats, and personal best.
   - Top 10 scores are ranked on the local leaderboard.

---

## 3. What to Do Between Players

1. Return the game to the `MENU` screen (click restart / try again or press reset).
2. Check that the webcam preview is active, clear of obstructions, and ready for the next participant.
3. **Inactivity Reset (planned):** If a player walks away, the game warns at 45 seconds of inactivity and automatically resets back to `MENU` after 60 seconds with no keyboard or hand input.
4. Invite the next player, remind them to hold their hand in view (or use keyboard fallback), and have them enter their name and subject.

---

## 4. Organizer Leaderboard Reset (planned)

To wipe the leaderboard and reset high scores for a new day or session:
1. Press `Ctrl + Shift + L` on any screen.
2. When the prompt appears, type `RESET` in all caps and confirm.
3. This resets the local leaderboard (`gestureRider.v1.leaderboard`), personal best records (`gestureRider.v1.pb`), and run trackers (`gestureRider.v1.runs`).
*(Note: In the current build, `Store.reset()` is implemented in `storage.js` and can be called via browser console; the `Ctrl+Shift+L` hotkey dialog is planned).*

---

## 5. Troubleshooting Table

| Issue / Symptom | Probable Cause | Organizer Solution |
| :--- | :--- | :--- |
| **No camera permission** | Browser denied camera access or prompt was dismissed. | 1. Click the lock/camera icon on the left side of the browser URL bar.<br>2. Set Camera permissions to **Allow** for `http://localhost:8000`.<br>3. Reload page (`Cmd+R` or `Ctrl+R`).<br>4. *Fallback:* Keyboard (`W`/`A`/`S`/`D` or Arrow keys) always works immediately without camera. |
| **Wrong port or address (scores seem missing)** | Opened `http://127.0.0.1:8000`, a different port (e.g. `8080`), or a different hostname. | Browser `localStorage` is isolated strictly by protocol, hostname, and port. If scores were recorded on `http://localhost:8000`, they will not appear on `127.0.0.1`. Always verify and lock the browser address to exactly `http://localhost:8000`. |
| **Game slow / low FPS / stuttering** | Hardware acceleration disabled in browser, laptop running on battery saver, or background tasks heavy. | 1. Open Chrome/Edge settings (`chrome://settings/system`) and toggle on **"Use graphics acceleration when available"**, then restart browser.<br>2. Connect laptop to AC power.<br>3. Close heavy background tabs or video capture software.<br>*(Note: Physics delta time is clamped to 0.05 s to keep the game stable).* |
| **Hand not detected / "Show your hand" stuck** | Hand outside webcam frame, harsh backlight, or poor lighting. | 1. Check the small webcam preview thumbnail in the corner.<br>2. Position the player 0.5 m–1.0 m in front of the lens with palm open.<br>3. Eliminate glare or backlight behind the player (e.g. close blinds or turn off rear lights).<br>4. If hand tracking drops for >300 ms, the bike coasts safely without crashing.<br>5. Keyboard controls override gesture input immediately at any moment. |
