# NEEDS-HTML.md

This document lists design elements referenced in the visual design specification and theme requirements that require dedicated DOM elements not currently present in `index.html`. Per agent rules, these elements were not added directly to `index.html`.

---

### 1. Steering Direction Indicator

- **Element:** `<div id="steering-indicator">` containing `<span id="steer-left" class="steer-arrow">◄</span>` and `<span id="steer-right" class="steer-arrow">►</span>`
- **Location:** Inside `#ui-layer`, centered near the lower-middle of the screen or adjacent to the speed gauge.
- **Purpose:** Provides immediate visual feedback indicating active steering direction (left or right) and intensity when tilting hands or pressing A/D keys.

---

### 2. Collision / Damage Banner & Flash Overlay

- **Element:** `<div id="collision-banner" class="hidden"><span id="collision-banner-text">COLLISION -10</span></div>` and `<div id="damage-flash" class="hidden"></div>`
- **Location:** Direct children of `#game-container`.
- **Purpose:** Displays a high-intensity red-pink chromatic vignette flash and alert banner upon hitting traffic or obstacle barriers (-1 life, -10 score) to communicate collision events clearly in loud arcade/stall environments.

---

### 3. Checkpoint Grace Period Shield Indicator

- **Element:** `<div id="grace-indicator" class="hidden"><span class="shield-icon">🛡️</span> <span id="grace-text">SHIELD ACTIVE</span></div>`
- **Location:** Inside `#ui-layer`, anchored below `#checkpoint-pill`.
- **Purpose:** Visually communicates the 1.0 s post-countdown invulnerability grace period during which collisions ignore damage, reassuring the player that they can accelerate without penalty.

---

### 4. Stage & Checkpoint Race Progress Bar

- **Element:** `<div id="race-progress-track"><div id="race-progress-fill"></div><div class="cp-marker cp-1">CP1</div><div class="cp-marker cp-2">CP2</div><div class="cp-marker cp-3">CP3</div><div class="cp-marker cp-4">CP4</div><div class="cp-marker cp-finish">FINISH</div><div id="race-rider-pin">🏍️</div></div>`
- **Location:** Inside `#ui-layer`, along the top-center below the checkpoint and lives pills.
- **Purpose:** Gives riders a spatial visual reference of their progress along the course and proximity to upcoming quiz checkpoints.

---

### 5. Audio Mute / Unmute Toggle Button

- **Element:** `<button type="button" id="audio-toggle-btn" class="hud-btn" aria-label="Toggle Sound"><span id="audio-icon">🔊</span></button>`
- **Location:** Inside `#ui-layer` (top-right or menu screen corner).
- **Purpose:** Enables organizers or players at the university event booth to quickly silence or restore Web Audio engine sound without navigating browser settings or muting system volume.
