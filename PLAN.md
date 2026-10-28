# PLAN.md — Gesture Rider

Single source of truth for every agent and human. If code and this file disagree, this file wins. If something here is unclear, STOP and ask; do not guess.

## 1. What we are building

Webcam-controlled motorcycle racing game for a university tech event stall. Player enters a name, picks a subject (Python / HTML / CSS / Maths), races ~1-2 min, answers 4 multiple-choice quiz checkpoints, has 3 lives, competes on a local leaderboard. Many strangers play back to back, so reliability beats polish.

Baseline: pseudo-3D canvas racer in `game.js` (from GitHub, MIT, credit original author in README). Keep its renderer, traffic, collision, MediaPipe input. Do not rebuild.

## 2. Rules for all agents

1. Read this whole file first.
2. Only touch files you own (section 3). Never edit another owner's file.
3. Never merge. Work on your own branch, commit, then stop and summarize.
4. Do NOT switch branches in the main project folder. Use `git worktree add ../gesture-rider-<task> -b agent/<task> dev` and work there.
5. No new dependencies, no build step, no frameworks. Plain HTML/CSS/JS, opens from localhost.
6. Show user-entered text with `textContent` only, never `innerHTML`.
7. Original or properly licensed assets only. GTA-inspired mood, but no copied art, logos, audio.
8. Do not add features not listed here.

## 3. File ownership

| File | Owner |
|---|---|
| `game.js`, `index.html` | IDE (human + IDE agent) only |
| `data/questions-python.js`, `-html.js`, `-css.js`, `-maths.js`, `tools/validate-questions.js` | App agent "questions" |
| `audio.js` | App agent "audio" |
| `styles.css` | IDE until HTML skeleton exists, then App agent "theme" |
| `PLAN.md`, `README.md` | Human |

## 4. Game states (single `gameState` variable, every input handler checks it)

`MENU` -> `RACING` -> `QUIZ_QUESTION` -> `QUIZ_FEEDBACK` -> `COUNTDOWN` -> `RACING` ...
`RACING` -> `WASTED` (lives = 0) -> `RESULTS`
`RACING` -> `RESULTS` (finish line reached)
`RESULTS` -> `MENU` or restart.

Only `RACING` advances movement, traffic, collisions, race timer. One animation loop only, never start a second one. Delta time clamped to 0.05s; reset the last-frame timestamp whenever resuming.

## 5. Decisions (final)

- Race length: constant `RACE_DISTANCE` in config (tuned in playtest, target 1-2 min). Checkpoints at 20%, 40%, 60%, 80% of it; finish at 100%. Progress is by distance, never time.
- Checkpoint tiers: CP1 = `easy`, CP2 = `easy`, CP3 = `easy-medium`, CP4 = `medium`.
- Quiz timer: 15 s (Python/HTML/CSS), 25 s (Maths). Timeout = incorrect.
- Answer keys: A/B/C/D or 1/2/3/4. Ignore held-key repeats (`e.repeat`) and lock input for the first 600 ms of each question.
- After the 3-2-1 countdown: 1.0 s grace where damage is ignored (coins still collect). Once per checkpoint.
- Traffic density multiplier by stage (start-CP1, CP1-2, CP2-3, CP3-4, CP4-finish): `[1.0, 1.0, 1.25, 1.5, 1.5]`, hard cap 1.5. Traffic speed range unchanged.
- Fairness: all randomness (road, traffic, coins, obstacles) uses a seeded RNG with a fixed `SEED`, so every run is the same road.
- Remove the baseline "close call +500" and the distance-based score.
- Inactivity: warn at 45 s, reset to `MENU` at 60 s with no keys or hand input. Never during `QUIZ_*` or `COUNTDOWN`.
- Quick Start: Python, default name "Rider".
- Name: max 12 chars, trimmed.

## 6. Lives, collisions, coins

- 3 lives. Hitting traffic or a crash object: -1 life, -2 coins (min 0), brief slowdown, hit animation + sound.
- Each obstacle can hit once: flag it `hit` and clear the flag only when it is far behind/away. No invulnerability timer.
- Lives are always visible. Losing all 3 = immediate `WASTED`, remaining checkpoints skipped (not counted wrong).
- Tracking lost (no hand result for >300 ms): show "Show your hand", coast/slow down, never crash or lose a life because of it. Keyboard always works and overrides gesture when any key is pressed.

## 7. Scoring (clamp score >= 0 after every event)

Coin +5 | Correct +100 | Wrong -20 | Timeout -20 | Finish race +50 | Crash: no direct deduction.
HUD shows only: score, coins, checkpoint number (+ lives). Accuracy and stats only on results screen.

## 8. Question banks

Files: `data/questions-<subject>.js`, each contains exactly:
`window.QUESTION_BANKS = window.QUESTION_BANKS || {}; window.QUESTION_BANKS.<subject> = [ ... ];`

Each question object:
`{ id: "py-e-01", subject: "python", tier: "easy", q: "...", options: ["...","...","...","..."], answer: 0, explain: "..." }`

- subject: python | html | css | maths. tier: easy | easy-medium | medium.
- Per subject: 8 easy, 6 easy-medium, 6 medium.
- Exactly 4 options, all distinct, no "all/none of the above". `answer` is the index 0-3 of the correct option; spread correct indexes evenly (no index above 40% of a subject).
- Length limits (projector readability): q <= 140 chars, each option <= 50 chars, explain <= 120 chars (one sentence).
- Exactly one defensible correct answer. No trick wording. Maths must be solvable mentally in ~20 s.
- Topics: Python (variables/types, operators, conditionals, loops, output prediction); HTML (semantic elements, links/images, forms, document structure, basics); CSS (selectors, box model, margin/padding, flexbox, basic layout); Maths (arithmetic, percentages/ratios, number patterns, basic logic, short reasoning).
- Output-prediction questions must be verified by actually running the code.
- Code/tags in question text is plain text (rendered with `textContent`).

## 9. Audio (`audio.js`)

Exposes global `Sfx` with methods, all safe to call before init (no throw):
`init()` (call from a user click), `engineUpdate(speedRatio 0-1)`, `engineStop()`, `coin()`, `crash()`, `quizOpen()`, `correct()`, `wrong()`, `tick()`, `go()`, `wasted()`.
All sounds synthesized with Web Audio (no audio files). Port the engine and wind synthesis from the `AudioController` class in `game.js` (copy, do not delete the original).

## 10. Leaderboard (later phase)

localStorage key `gestureRider.v1.leaderboard`. Entry: `{ name, score, coins, subject, answered, correct, timeouts, finished, date }`. Sort by score desc, then coins desc. Top 10. Validate every entry on load; drop bad ones, never crash. Personal best per name (case-insensitive). Prevent duplicate submit per run. Organizer reset: Ctrl+Shift+L, then type RESET to confirm.

## 11. Visual direction (later phase)

Near-black/charcoal, asphalt grey, dirty off-white text, yellow accents, bold readable type, compact HUD, dark mission-style quiz card, large answer buttons, dramatic WASTED screen. Gritty urban, not neon.

## 12. Phases

1. Stabilize core (single loop, `gameState`, dt clamp, tracking-loss, keyboard merge, resize, seeded RNG, mountain flicker fix)
2. Lives, collisions, coins, score
3. One full quiz checkpoint
4. Question banks wired in, all 4 checkpoints, traffic ramp
5. Scoring, results, leaderboard
6. Reliability (inactivity reset, repeat runs, camera loss)
7. Visual + audio polish, WASTED screen

## 13. Out of scope

Police/wanted level, story, upgrades, multiplayer, online accounts/leaderboard, AI-generated questions, free-text questions, second-monitor view.