/**
 * ------------------------------------------------------------------
 * THEME SPECIFICATION (THEME.md section 1)
 * ------------------------------------------------------------------
 */
const THEME = Object.freeze({
    skyTop: '#090420',
    skyMid: '#2a0a4a',
    skyLow: '#6a1b6e',
    sunTop: '#ff2d6f',
    sunBottom: '#ff9a3c',
    cyan: '#19f0ff',
    pink: '#ff2e8a',
    magenta: '#e040fb',
    window: '#ffa726',
    windowCyan: '#19f0ff',
    building: '#0f1124',
    buildingEdge: '#1f6f86',
    asphalt: '#10131c',
    asphaltTeal: '#0f2a33',
    ground: '#05060f',
    text: '#e8f7ff',
    gold: '#ffd23f',
    goldEdge: '#c89414',
    danger: '#ff3355',
    ok: '#39ff9c'
});

/**
 * ------------------------------------------------------------------
 * CONFIGURATION & CONSTANTS
 * ------------------------------------------------------------------
 */
const SEED = 42; // Fixed seed – every run sees the same road/traffic/sprites.

const CONFIG = {
    FPS: 60,
    DEBUG_FPS: false,
    FOV: 100,
    CAMERA_HEIGHT: 1000,
    CAMERA_DEPTH: 0.84,
    SEGMENT_LENGTH: 200,
    DRAW_DISTANCE: 300,
    LANES: 2,
    ROAD_WIDTH: 2000,
    MAX_SPEED: 8000,
    ACCEL: 75,
    BRAKING: -240,
    DECEL: -35,
    OFF_ROAD_DECEL: -150,
    SKY_SPEED: 0.001,

    // Phase 2
    START_LIVES: 3,
    HIT_SPEED_FACTOR: 0.4,   // speed cut to 40% on hit
    HIT_FLASH_MS: 300,       // red flash duration
    COIN_SCORE: 5,
    CRASH_PENALTY: 10,       // score deducted per hit (PLAN §7)
    HIT_LIFE_COST: 1,
    // Traffic hit requires car to be > 250 units AHEAD of player first
    CAR_HIT_AHEAD_THRESHOLD: 250,

    // Finish line (PLAN §5, §7)
    RACE_DISTANCE: 900000,
    FINISH_BONUS: 50,

    // Quiz / checkpoints (Phase 3)
    CHECKPOINT_THRESHOLDS: [0.20, 0.40, 0.60, 0.80],
    QUIZ_CORRECT_SCORE: 100,
    QUIZ_WRONG_PENALTY: 20,
    QUIZ_LOCKOUT_MS: 600,       // ignore answer keys for first 600 ms
    QUIZ_FEEDBACK_AUTO_MS: 6000, // auto-dismiss feedback after 6 s
    COUNTDOWN_SECONDS: 3,
    GRACE_DURATION: 1.0,         // 1 s grace after countdown (no hit checks)
    STAGE_MULTIPLIERS: [1.0, 1.0, 1.25, 1.5, 1.5], // Stage-based traffic density (PLAN §5)

    COLORS: {
        SKY_TOP: THEME.skyTop,
        SKY_BOTTOM: THEME.skyLow,
        ROAD_LIGHT: THEME.asphalt,
        ROAD_DARK: THEME.asphalt,
        GRASS_LIGHT: THEME.ground,
        GRASS_DARK: '#070a14',
        LANE_MARKER: '#e8f7ff',
        RUMBLE: THEME.pink,
        FOG: THEME.skyLow,
        TREE_TRUNK: '#443322',
        TREE_LEAVES: THEME.magenta
    }
};

/**
 * ------------------------------------------------------------------
 * GAME STATES  (single source of truth)
 * ------------------------------------------------------------------
 * MENU -> RACING -> QUIZ -> FEEDBACK -> COUNTDOWN -> RACING ...
 * RACING -> WASTED (lives=0) or FINISHED (distance reached).
 * Only RACING advances simulation, traffic, collisions, race timer.
 */
const STATE = {
    MENU: 'MENU',
    RACING: 'RACING',
    QUIZ: 'QUIZ',
    FEEDBACK: 'FEEDBACK',
    COUNTDOWN: 'COUNTDOWN',
    WASTED: 'WASTED',
    FINISHED: 'FINISHED'
};

/**
 * ------------------------------------------------------------------
 * SEEDED PSEUDO-RANDOM NUMBER GENERATOR  (LCG)
 * ------------------------------------------------------------------
 */
function makeLCG(seed) {
    let s = seed >>> 0;
    return function () {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/**
 * ------------------------------------------------------------------
 * AUDIO INTERFACE (Safe Sfx wrapper)
 * ------------------------------------------------------------------
 */
function safeSfx(method, ...args) {
    if (window.game && window.game.isMuted) return;
    if (typeof Sfx !== 'undefined' && Sfx && typeof Sfx[method] === 'function') {
        try {
            Sfx[method](...args);
        } catch (e) {
            // safe fail if audio is unavailable
        }
    }
}

/**
 * ------------------------------------------------------------------
 * INPUT HANDLING
 * ------------------------------------------------------------------
 */
class InputSystem {
    constructor(game = null) {
        this.game = game;
        this.keys = {};
        this.gesture = { tilt: 0, throttle: 0, brake: 0, active: false };

        this.keyboardSteer = 0;
        this.steerSpeed = 0.45;
        this.steerReturn = 0.35;

        this.lastHandTime = 0;
        this.TRACKING_TIMEOUT = 300;

        window.addEventListener('pointerdown', () => {
            if (this.game) this.game.registerActivity();
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            if (this.game) this.game.registerActivity();

            // Ignore all game keys (WASD, arrows, number keys, Ctrl+Shift+L) while any input is focused
            const isInput = (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select')) ||
                            (e.target && e.target.matches && e.target.matches('input, textarea, select'));
            if (isInput) return;

            // Audio mute shortcut (M key)
            if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
                if (this.game) this.game.toggleMute();
                return;
            }

            // Organizer reset shortcut (PLAN §10): Ctrl+Shift+L on menu or results screens
            if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l' || e.code === 'KeyL')) {
                if (this.game && (this.game.gameState === STATE.MENU || this.game.gameState === STATE.FINISHED || this.game.gameState === STATE.WASTED)) {
                    e.preventDefault();
                    this.game.openOrganizerModal();
                    return;
                }
            }

            if (this.game && this.game.isOrganizerModalOpen) return;
            if (this.game && this.game.gameState === STATE.MENU) return;
            this.keys[e.code] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            const isInput = (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select')) ||
                            (e.target && e.target.matches && e.target.matches('input, textarea, select'));
            if (isInput) return;
            if (this.game && this.game.isOrganizerModalOpen) return;
            if (this.game && this.game.gameState === STATE.MENU) return;
            this.keys[e.code] = false;
        });

        this.videoElement = document.getElementById('input_video');
        this.canvasPreview = document.getElementById('webcam-preview');
        this.ctxPreview = this.canvasPreview.getContext('2d');

        this.hands = new Hands({ locateFile: (file) => `vendor/mediapipe/hands/${file}` });
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        this.hands.onResults(this.onHandsResults.bind(this));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => await this.hands.send({ image: this.videoElement }),
            width: 320,
            height: 240
        });
    }

    startCamera() { return this.camera.start(); }

    isTrackingLost() {
        if (this.lastHandTime === 0) return false;
        return (Date.now() - this.lastHandTime) > this.TRACKING_TIMEOUT;
    }

    onHandsResults(results) {
        this.ctxPreview.save();
        this.ctxPreview.clearRect(0, 0, this.canvasPreview.width, this.canvasPreview.height);

        // Draw camera frame into canvas (CSS transform: scaleX(-1) handles visual mirroring once)
        this.ctxPreview.drawImage(results.image, 0, 0, this.canvasPreview.width, this.canvasPreview.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            if (typeof drawConnectors === 'function' && typeof HAND_CONNECTIONS !== 'undefined') {
                drawConnectors(this.ctxPreview, landmarks, HAND_CONNECTIONS, { color: THEME.cyan, lineWidth: 2 });
            }
            if (typeof drawLandmarks === 'function') {
                drawLandmarks(this.ctxPreview, landmarks, { color: THEME.pink, lineWidth: 1 });
            }
            this.processGesture(landmarks);
            this.gesture.active = true;
            this.lastHandTime = Date.now();
            if (this.game) this.game.registerActivity();
            const s = document.getElementById('g-status');
            if (s) { s.textContent = 'HAND DETECTED'; s.style.color = THEME.ok; }
        } else {
            this.gesture.active = false;
            this.gesture.tilt = 0;
            this.gesture.throttle = 0;
            this.gesture.brake = 0;
            this.resetDebugPanel();
        }
        this.ctxPreview.restore();
    }

    resetDebugPanel() {
        const s = document.getElementById('g-status');
        if (s) { s.textContent = 'SHOW YOUR HAND'; s.style.color = THEME.danger; }
        const tiltEl = document.getElementById('g-tilt');
        if (tiltEl) tiltEl.textContent = '0°';
        const actionEl = document.getElementById('g-action');
        if (actionEl) actionEl.textContent = 'Idle';
    }

    processGesture(landmarks) {
        const wrist = landmarks[0];
        const middleBase = landmarks[9];
        const dx = middleBase.x - wrist.x;
        const dy = middleBase.y - wrist.y;

        const angle = Math.atan2(dy, dx);
        const neutralAngle = -Math.PI / 2;
        this.gesture.tilt = Math.max(-1, Math.min(1, (angle - neutralAngle) / 0.5));
        if (Math.abs(this.gesture.tilt) < 0.05) this.gesture.tilt = 0;

        const tiltEl = document.getElementById('g-tilt');
        if (tiltEl) tiltEl.textContent = (this.gesture.tilt * 90).toFixed(0) + '°';

        const tips = [8, 12, 16, 20];
        const pips = [6, 10, 14, 18];
        let extended = 0;
        for (let i = 0; i < 4; i++) {
            if (this.dist(wrist, landmarks[tips[i]]) > this.dist(wrist, landmarks[pips[i]]) * 1.1) extended++;
        }

        let actionText = 'Coast';
        if (extended >= 3) { this.gesture.throttle = 1; this.gesture.brake = 0; actionText = 'ACCEL'; }
        else if (extended <= 1) { this.gesture.throttle = 0; this.gesture.brake = 1; actionText = 'BRAKE'; }
        else { this.gesture.throttle = 0; this.gesture.brake = 0; }

        const actionEl = document.getElementById('g-action');
        if (actionEl) actionEl.textContent = actionText;
    }

    dist(p1, p2) { return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2); }

    anyKeyHeld() {
        return !!(this.keys['ArrowLeft'] || this.keys['KeyA'] ||
            this.keys['ArrowRight'] || this.keys['KeyD'] ||
            this.keys['ArrowUp'] || this.keys['KeyW'] ||
            this.keys['ArrowDown'] || this.keys['KeyS']);
    }

    getCommand() {
        let cmd = { steer: 0, accel: 0, brake: 0 };
        const keyOverride = this.anyKeyHeld();
        const trackingLost = this.isTrackingLost();

        if (!keyOverride && this.gesture.active && !trackingLost) {
            cmd.steer = this.gesture.tilt;
            cmd.accel = this.gesture.throttle;
            cmd.brake = this.gesture.brake;
        } else {
            let targetSteer = 0;
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) targetSteer = 1;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) targetSteer = -1;

            if (targetSteer !== 0) {
                this.keyboardSteer += (targetSteer - this.keyboardSteer) * this.steerSpeed;
            } else {
                this.keyboardSteer *= (1 - this.steerReturn);
                if (Math.abs(this.keyboardSteer) < 0.01) this.keyboardSteer = 0;
            }

            cmd.steer = this.keyboardSteer;
            if (this.keys['ArrowUp'] || this.keys['KeyW']) cmd.accel = 1;
            if (this.keys['ArrowDown'] || this.keys['KeyS']) cmd.brake = 1;
            this.updateKeyHints();
        }

        // Steering indicator pills (NEEDS-HTML §1)
        const steerLeftEl = document.getElementById('steer-left');
        const steerRightEl = document.getElementById('steer-right');
        if (steerLeftEl) steerLeftEl.classList.toggle('active', cmd.steer > 0.15);
        if (steerRightEl) steerRightEl.classList.toggle('active', cmd.steer < -0.15);

        return cmd;
    }

    updateKeyHints() {
        const hint = document.getElementById('controls-hint');
        if (!hint) return;
        hint.querySelectorAll('.key').forEach(key => {
            const k = key.textContent;
            let active = false;
            if (k === 'W') active = !!(this.keys['KeyW'] || this.keys['ArrowUp']);
            if (k === 'A') active = !!(this.keys['KeyA'] || this.keys['ArrowLeft']);
            if (k === 'S') active = !!(this.keys['KeyS'] || this.keys['ArrowDown']);
            if (k === 'D') active = !!(this.keys['KeyD'] || this.keys['ArrowRight']);
            key.classList.toggle('active', active);
        });
    }
}

/**
 * ------------------------------------------------------------------
 * VISUAL EFFECTS (Particles)
 * ------------------------------------------------------------------
 */
class ParticleSystem {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.particles = [];
        this.maxParticles = 50;
    }

    resize(width, height) { this.width = width; this.height = height; }

    updateAndDraw(speedRatio) {
        if (speedRatio < 0.5) return;
        if (this.particles.length < this.maxParticles && Math.random() > 0.5) {
            this.particles.push({ x: Math.random() * this.width, y: Math.random() * this.height, speed: 10 + Math.random() * 20 });
        }
        this.ctx.strokeStyle = `rgba(255,255,255,${speedRatio * 0.3})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        const cx = this.width / 2, cy = this.height / 2;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            const angle = Math.atan2(p.y - cy, p.x - cx);
            p.x += Math.cos(angle) * p.speed * speedRatio;
            p.y += Math.sin(angle) * p.speed * speedRatio;
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x - Math.cos(angle) * 20, p.y - Math.sin(angle) * 20);
            if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) this.particles.splice(i, 1);
        }
        this.ctx.stroke();
    }
}

/**
 * ------------------------------------------------------------------
 * UTILITY
 * ------------------------------------------------------------------
 */
class Utils {
    static project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        if (p.camera.z <= 0) { p.screen.scale = 0; return; }
        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
    }
    static percentRemaining(n, total) { return (n % total) / total; }
    static interpolate(a, b, percent) { return a + (b - a) * percent; }
    static randomIntRng(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
}

/**
 * ------------------------------------------------------------------
 * GAME
 * ------------------------------------------------------------------
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.input = new InputSystem(this);
        this.particles = new ParticleSystem(this.ctx, this.width, this.height);

        this.gameState = STATE.MENU;
        this.loopRunning = false;
        this.lastInputTime = performance.now();
        this.isOrganizerModalOpen = false;

        // Race state
        this.position = 0;
        this.playerX = 0;
        this.cameraX = 0;
        this.speed = 0;
        this.score = 0;
        this.distanceRun = 0;
        this.segments = [];

        // Phase 2 state
        this.lives = CONFIG.START_LIVES;
        this.coinsCollected = 0;  // hidden counter: coins picked up, never reduced (PLAN §7)
        this.hitFlashUntil = 0;   // timestamp until red flash is shown

        // Phase 3 — quiz/checkpoint state
        this.playerName = 'Rider';
        this.subjects = ['python'];   // array of 1-4 selected subjects
        this.quizRun = null;          // QuizRun from quiz.js
        this.checkpointIndex = 0;     // 0..4 — how many checkpoints reached
        this.graceTime = 0;           // seconds remaining of post-countdown grace
        this.currentQuestion = null;  // question object from quiz.js
        this.quizStartTime = 0;       // performance.now() when question shown
        this.quizAnswerLocked = false;
        this.quizChosenIndex = -1;    // index chosen by player (0-3, or -1)
        this.feedbackStartTime = 0;
        this.countdownStartTime = 0;
        this.countdownNum = 3;

        this.lastSteer = 0;
        this.runId = this.generateRunId();

        this.mountainPoints = [];
        this.highScore = parseInt(localStorage.getItem('gestureRiderHighScore')) || 0;
        this.rng = makeLCG(SEED);
        this.stage = 0;               // 0..4 — traffic density stage (PLAN §5)
        this._stageInitialized = false;
        this.allCars = [];

        // Audio & visual theme state
        this.isMuted = false;
        this.skyOffset = 0;
        this.screenShakeUntil = 0;
        this.fpsFrames = 0;
        this.lastFpsLog = performance.now();
        this.fps = 60;
        this.bgLayers = this.createBackgroundLayers(this.width, this.height);

        const muteBtn = document.getElementById('audio-toggle-btn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleMute());
        }

        this.resetRoad();
        this._buildMountains();

        this.trackingLostEl = document.getElementById('tracking-lost-msg');

        this.step = this.step.bind(this);
        this.lastTime = performance.now();

        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        const nextPlayerBtn = document.getElementById('next-player-btn');
        if (nextPlayerBtn) {
            nextPlayerBtn.addEventListener('click', () => this.nextPlayer());
        }
        window.addEventListener('resize', () => this._onResize());

        // --- Quiz option buttons ---
        for (let i = 0; i < 4; i++) {
            const btn = document.getElementById(`quiz-opt-${i}`);
            if (btn) {
                btn.addEventListener('click', () => this._handleQuizAnswer(i));
            }
        }

        // --- Quiz keydown handler ---
        this._onQuizKey = this._onQuizKey.bind(this);
        window.addEventListener('keydown', this._onQuizKey);

        // --- Organizer modal listeners (PLAN §10) ---
        const organizerCancelBtn = document.getElementById('organizer-cancel-btn');
        if (organizerCancelBtn) {
            organizerCancelBtn.addEventListener('click', () => this.closeOrganizerModal());
        }
        const organizerConfirmBtn = document.getElementById('organizer-confirm-btn');
        if (organizerConfirmBtn) {
            organizerConfirmBtn.addEventListener('click', () => {
                const inputEl = document.getElementById('organizer-reset-input');
                if (inputEl && inputEl.value.trim() === 'RESET') {
                    if (typeof Store !== 'undefined' && Store.reset) Store.reset();
                    this.renderLeaderboard();
                    this.closeOrganizerModal();
                }
            });
        }
        const organizerInput = document.getElementById('organizer-reset-input');
        if (organizerInput) {
            organizerInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeOrganizerModal();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (organizerInput.value.trim() === 'RESET') {
                        if (typeof Store !== 'undefined' && Store.reset) Store.reset();
                        this.renderLeaderboard();
                        this.closeOrganizerModal();
                    }
                }
            });
        }

        this.renderLeaderboard();

        // Start single RAF loop
        this.loopRunning = true;
        requestAnimationFrame(this.step);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (typeof Sfx !== 'undefined' && Sfx && Sfx.masterGain && Sfx.ctx) {
            try {
                Sfx.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, Sfx.ctx.currentTime);
            } catch (err) {}
        }
        const icon = document.getElementById('audio-icon');
        if (icon) icon.textContent = this.isMuted ? '🔇' : '🔊';
    }

    createBackgroundLayers(width, height) {
        const horizon = height / 2;
        const bgW = width * 2;

        // 1. Sky Canvas (gradient + perspective grid + stars + streaks)
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = width;
        skyCanvas.height = height;
        const sCtx = skyCanvas.getContext('2d');

        const skyGrad = sCtx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0, THEME.skyTop);
        skyGrad.addColorStop(0.5, THEME.skyMid);
        skyGrad.addColorStop(1, THEME.skyLow);
        sCtx.fillStyle = skyGrad;
        sCtx.fillRect(0, 0, width, horizon + 20);

        // Perspective grid lines fanning from vanishing point
        sCtx.save();
        sCtx.strokeStyle = 'rgba(25, 240, 255, 0.07)';
        sCtx.lineWidth = 1;
        const vpX = width / 2;
        for (let a = -width; a <= width * 2; a += 45) {
            sCtx.beginPath();
            sCtx.moveTo(vpX, horizon);
            sCtx.lineTo(a, 0);
            sCtx.stroke();
        }
        sCtx.restore();

        // Stars & streaks
        const rng = makeLCG(SEED + 101);
        for (let i = 0; i < 75; i++) {
            const sx = rng() * width;
            const sy = rng() * (horizon * 0.85);
            const sa = 0.3 + rng() * 0.7;
            const sr = 0.5 + rng() * 1.2;
            sCtx.fillStyle = `rgba(255, 255, 255, ${sa})`;
            sCtx.beginPath();
            sCtx.arc(sx, sy, sr, 0, Math.PI * 2);
            sCtx.fill();
        }
        sCtx.strokeStyle = 'rgba(25, 240, 255, 0.16)';
        sCtx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const lx = rng() * width;
            const ly = rng() * (horizon * 0.6);
            const len = 30 + rng() * 50;
            sCtx.beginPath();
            sCtx.moveTo(lx, ly);
            sCtx.lineTo(lx + len, ly - len * 0.4);
            sCtx.stroke();
        }

        // 2. Sun Canvas (striped pink-orange disc with soft glow)
        const sunCanvas = document.createElement('canvas');
        const sunR = Math.min(width * 0.16, 90);
        sunCanvas.width = sunR * 3;
        sunCanvas.height = sunR * 3;
        const sunCtx = sunCanvas.getContext('2d');
        const sunCX = sunCanvas.width / 2;
        const sunCY = sunCanvas.height / 2;

        const sunGlow = sunCtx.createRadialGradient(sunCX, sunCY, sunR * 0.5, sunCX, sunCY, sunR * 1.45);
        sunGlow.addColorStop(0, 'rgba(255, 45, 111, 0.38)');
        sunGlow.addColorStop(0.7, 'rgba(255, 154, 60, 0.15)');
        sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sunCtx.fillStyle = sunGlow;
        sunCtx.fillRect(0, 0, sunCanvas.width, sunCanvas.height);

        sunCtx.save();
        sunCtx.beginPath();
        sunCtx.arc(sunCX, sunCY, sunR, 0, Math.PI * 2);
        sunCtx.clip();

        const sunGrad = sunCtx.createLinearGradient(0, sunCY - sunR, 0, sunCY + sunR);
        sunGrad.addColorStop(0, THEME.sunTop);
        sunGrad.addColorStop(1, THEME.sunBottom);
        sunCtx.fillStyle = sunGrad;
        sunCtx.fillRect(sunCX - sunR, sunCY - sunR, sunR * 2, sunR * 2);

        // Horizontal dark slices that get thicker toward bottom
        const sliceCount = 8;
        for (let i = 1; i < sliceCount; i++) {
            const frac = i / sliceCount;
            const sy = sunCY - sunR + (sunR * 2) * (0.35 + frac * 0.65);
            const thick = 2 + frac * 6;
            sunCtx.fillStyle = '#090420';
            sunCtx.fillRect(sunCX - sunR, sy, sunR * 2, thick);
        }
        sunCtx.restore();

        // 3. Far Skyline Canvas (dark blue-purple silhouettes with tiny window dots)
        const farCanvas = document.createElement('canvas');
        farCanvas.width = bgW;
        farCanvas.height = horizon;
        const fCtx = farCanvas.getContext('2d');
        const farRng = makeLCG(SEED + 202);

        let curX = 0;
        while (curX < bgW) {
            const bW = 25 + farRng() * 45;
            const bH = 30 + farRng() * (horizon * 0.35);
            fCtx.fillStyle = '#120d2c';
            fCtx.fillRect(curX, horizon - bH, bW, bH);

            for (let wy = horizon - bH + 6; wy < horizon - 8; wy += 8) {
                for (let wx = curX + 4; wx < curX + bW - 4; wx += 6) {
                    if (farRng() > 0.65) {
                        fCtx.fillStyle = farRng() > 0.4 ? THEME.window : THEME.windowCyan;
                        fCtx.fillRect(wx, wy, 2, 3);
                    }
                }
            }
            curX += bW + (farRng() * 6);
        }

        // 4. Mid Skyline Canvas (taller dark towers, orange windows, cyan rim light, beacons)
        const midCanvas = document.createElement('canvas');
        midCanvas.width = bgW;
        midCanvas.height = horizon;
        const mCtx = midCanvas.getContext('2d');
        const midRng = makeLCG(SEED + 303);

        curX = 0;
        while (curX < bgW) {
            const bW = 35 + midRng() * 60;
            const bH = 50 + midRng() * (horizon * 0.55);
            const by = horizon - bH;

            mCtx.fillStyle = THEME.building;
            mCtx.fillRect(curX, by, bW, bH);

            mCtx.fillStyle = THEME.buildingEdge;
            mCtx.fillRect(curX + bW - 2, by, 2, bH);

            for (let wy = by + 8; wy < horizon - 10; wy += 10) {
                for (let wx = curX + 6; wx < curX + bW - 6; wx += 8) {
                    if (midRng() > 0.5) {
                        mCtx.fillStyle = midRng() > 0.25 ? THEME.window : THEME.windowCyan;
                        mCtx.fillRect(wx, wy, 3, 4);
                    }
                }
            }

            if (midRng() > 0.5) {
                mCtx.fillStyle = '#ff2244';
                mCtx.fillRect(curX + bW / 2 - 1, by - 4, 3, 4);
            }

            curX += bW + (midRng() * 12);
        }

        return { skyCanvas, sunCanvas, farCanvas, midCanvas, sunR, horizon, bgW };
    }

    _buildMountains() {
        this.mountainPoints = [];
    }

    _onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.particles.resize(this.width, this.height);
        this.bgLayers = this.createBackgroundLayers(this.width, this.height);
    }

    /**
     * Reset road using fixed seeded RNG.
     * Phase 2 additions: crash-object sprites, coin lines.
     */
    resetRoad() {
        this.segments = [];
        this.allCars = [];
        this.rng = makeLCG(SEED);
        const TOTAL_SEGMENTS = 2000;
        for (let i = 0; i < TOTAL_SEGMENTS; i++) {
            const curve = (i > 100 && i < 300) ? 2 : (i > 500 && i < 700) ? -3 : (i > 1000 && i < 1200) ? 4 : (i > 1500 && i < 1700) ? -2 : 0;
            this.segments.push({
                index: i,
                p1: { world: { y: 0, z: i * CONFIG.SEGMENT_LENGTH }, camera: {}, screen: {} },
                p2: { world: { y: 0, z: (i + 1) * CONFIG.SEGMENT_LENGTH }, camera: {}, screen: {} },
                color: Math.floor(i / 3) % 2 ? CONFIG.COLORS.ROAD_DARK : CONFIG.COLORS.ROAD_LIGHT,
                curve,
                cars: [],
                sprites: [],
                coins: [],
                gate: null
            });

            // Traffic cars
            if (i > 20 && i % 40 === 0 && this.rng() > 0.3) {
                const lanes = [-0.5, 0.5];
                this.addCar(i, lanes[Math.floor(this.rng() * lanes.length)], Utils.randomIntRng(this.rng, 2000, 5200));
            }

            // Palm trees with neon fronds (replacing pine trees)
            if (i % 14 === 0 && this.rng() > 0.2) {
                const side = this.rng() > 0.5 ? 1 : -1;
                this.addSprite(i, side * (1.3 + this.rng() * 0.4), 'palm');
            }

            // Curved streetlights with cyan head every ~20 segments
            if (i % 20 === 0) {
                const side = (i % 40 === 0) ? 1 : -1;
                this.addSprite(i, side * 1.25, 'streetlight');
            }

            // Neon billboards every ~80 segments
            if (i % 80 === 0) {
                const side = (i % 160 === 0) ? 1 : -1;
                const labels = ['RIDE', 'QUIZ', 'SPEED', 'NEON'];
                this.addSprite(i, side * 1.45, 'billboard', labels[Math.floor(this.rng() * labels.length)]);
            }

            // Dark skyscrapers, rocks and light posts beside road (never on road)
            if (i % 35 === 0 && this.rng() > 0.25) {
                const side = this.rng() > 0.5 ? 1 : -1;
                const bgTypes = ['building-a', 'building-b', 'building-c', 'rock', 'light-post'];
                const bgType = bgTypes[Math.floor(this.rng() * bgTypes.length)];
                this.addSprite(i, side * (1.8 + this.rng() * 1.2), bgType);
            }

            // Crash barriers / cones — one every ~60 segments, never in first 30
            if (i > 30 && i % 60 === 0 && this.rng() > 0.4) {
                // Place in one of the two tracks
                const lanes = [-0.5, 0.5];
                const lane = lanes[Math.floor(this.rng() * lanes.length)];
                const type = this.rng() > 0.5 ? 'barrier' : 'cone';
                this.addSprite(i, lane, type);
            }

        }

        // --- Second pass: coin placement (all segments now exist) ---
        // Runs of 3-5 coins in a lane, seeded RNG continues from where it left off.
        for (let i = 10; i < TOTAL_SEGMENTS; i++) {
            if (i % 30 === 0 && this.rng() > 0.5) {
                const lanes = [-0.5, 0.5];
                const lane = lanes[Math.floor(this.rng() * lanes.length)];
                const count = 3 + Math.floor(this.rng() * 3); // 3-5
                for (let c = 0; c < count; c++) {
                    const targetSeg = i + c * 3;
                    if (targetSeg < TOTAL_SEGMENTS) {
                        this.segments[targetSeg].coins.push({ offset: lane, collected: false });
                    }
                }
            }
        }

        this.setStage(0, true);
    }

    addCar(segmentIndex, offset, speed) {
        if (segmentIndex < 0 || segmentIndex >= this.segments.length) return;
        const carTypes = ['sedan', 'coupe', 'van', 'truck'];
        const carColors = ['purple', 'blue', 'red', 'teal'];
        const car = {
            offset,
            z: segmentIndex * CONFIG.SEGMENT_LENGTH,
            speed,
            type: carTypes[Math.floor(this.rng() * carTypes.length)],
            colorKey: carColors[Math.floor(this.rng() * carColors.length)],
            r: this.rng(),
            active: false,
            hit: false,
            canHit: false
        };
        this.segments[segmentIndex].cars.push(car);
        this.allCars.push(car);
    }

    /**
     * setStage — updates stage-based traffic density (PLAN §5).
     * Stage = number of quiz checkpoints passed (0 to 4).
     * Multipliers: [1.0, 1.0, 1.25, 1.5, 1.5].
     * A car is active only when car.r < multiplier(stage) / 1.5.
     * When a checkpoint is passed, newly active cars appear only where |dist| > 600.
     */
    setStage(newStage, forceLog = false) {
        const stage = Math.max(0, Math.min(4, newStage));
        const mult = CONFIG.STAGE_MULTIPLIERS[stage] || 1.0;
        const threshold = mult / 1.5;
        const playerZ = this.position + CONFIG.CAMERA_HEIGHT;
        const trackLen = (this.segments && this.segments.length) ? this.segments.length * CONFIG.SEGMENT_LENGTH : 400000;

        for (const car of this.allCars) {
            if (car.r < threshold) {
                if (car.active) {
                    // Stays active
                } else {
                    let dist = car.z - playerZ;
                    if (dist < -trackLen / 2) dist += trackLen;
                    if (dist > trackLen / 2) dist -= trackLen;
                    if (Math.abs(dist) > 600 || this.gameState !== STATE.RACING) {
                        car.active = true;
                    }
                }
            } else {
                car.active = false;
            }
        }

        this.stage = stage;
        this._stageInitialized = true;
    }

    addSprite(segmentIndex, offset, type, label = null) {
        if (segmentIndex < 0 || segmentIndex >= this.segments.length) return;
        this.segments[segmentIndex].sprites.push({
            offset,
            type,
            label,
            hit: false
        });
    }

    generateRunId() {
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    }

    registerActivity() {
        this.lastInputTime = performance.now();
        const idleWarning = document.getElementById('idle-warning');
        if (idleWarning && !idleWarning.classList.contains('hidden')) {
            idleWarning.classList.add('hidden');
        }
    }

    openOrganizerModal() {
        this.isOrganizerModalOpen = true;
        const modal = document.getElementById('organizer-modal');
        const titleEl = document.getElementById('organizer-modal-title');
        const msgEl = document.getElementById('organizer-modal-msg');
        const inputEl = document.getElementById('organizer-reset-input');

        if (titleEl) titleEl.textContent = 'Reset Leaderboard';
        if (msgEl) msgEl.textContent = 'Type RESET to erase the leaderboard:';
        if (inputEl) inputEl.value = '';
        if (modal) modal.classList.remove('hidden');
        if (inputEl) {
            setTimeout(() => inputEl.focus(), 50);
        }
        this.registerActivity();
    }

    closeOrganizerModal() {
        this.isOrganizerModalOpen = false;
        const modal = document.getElementById('organizer-modal');
        const inputEl = document.getElementById('organizer-reset-input');
        if (inputEl) inputEl.blur();
        if (modal) modal.classList.add('hidden');
        this.registerActivity();
    }

    returnToMenu() {
        const idleWarning = document.getElementById('idle-warning');
        if (idleWarning) idleWarning.classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('countdown-screen').classList.add('hidden');
        document.getElementById('overlay-screen').classList.remove('hidden');
        if (this.trackingLostEl) this.trackingLostEl.style.display = 'none';

        this.closeOrganizerModal();

        this.resetRoad();
        this.speed = 0;
        this.score = 0;
        this.distanceRun = 0;
        this.position = 0;
        this.playerX = 0;
        this.cameraX = 0;
        this.lives = CONFIG.START_LIVES;
        this.coinsCollected = 0;
        this.hitFlashUntil = 0;
        this.graceTime = 0;
        this.checkpointIndex = 0;
        this.currentQuestion = null;
        this.quizAnswerLocked = false;
        this.quizChosenIndex = -1;
        this.feedbackStartTime = 0;
        this.countdownStartTime = 0;
        this.countdownNum = 3;
        this.quizRun = null;
        this.lastSteer = 0;
        this.runId = this.generateRunId();

        safeSfx('engineStop');

        const scoreVal = document.getElementById('scoreVal');
        if (scoreVal) scoreVal.textContent = '0';
        const distVal = document.getElementById('distVal');
        if (distVal) distVal.textContent = '0.0';
        const speedVal = document.getElementById('speedVal');
        if (speedVal) speedVal.textContent = '0';
        const cpEl = document.getElementById('checkpointVal');
        if (cpEl) cpEl.textContent = 'Q 0/4';
        const livesVal = document.getElementById('livesVal');
        if (livesVal) livesVal.textContent = '❤️❤️❤️';

        this.input.keys = {};
        this.input.keyboardSteer = 0;
        this.input.gesture.tilt = 0;
        this.input.gesture.throttle = 0;
        this.input.gesture.brake = 0;

        const nameInput = document.getElementById('player-name');
        if (nameInput) nameInput.value = '';

        this.gameState = STATE.MENU;
        this.renderLeaderboard();
        this.registerActivity();
    }

    nextPlayer() {
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('overlay-screen').classList.remove('hidden');
        const nameInput = document.getElementById('player-name');
        if (nameInput) nameInput.value = '';
        this.gameState = STATE.MENU;
        this.lastSteer = 0;
        this.runId = this.generateRunId();
        safeSfx('engineStop');
        this.renderLeaderboard();
        this.registerActivity();
    }

    renderLeaderboard() {
        const entries = (typeof Store !== 'undefined' && Store.load) ? Store.load() : [];
        this._fillLeaderboardList(document.getElementById('leaderboard-list'), entries);
        this._fillLeaderboardList(document.getElementById('menu-leaderboard-list'), entries);
    }

    /**
     * _fillLeaderboardList — populates a <ol> with leaderboard rows.
     * Shared renderer for both the results screen and the home-screen panel.
     * Uses only textContent and createElement; no innerHTML.
     */
    _fillLeaderboardList(listEl, entries) {
        if (!listEl) return;
        while (listEl.firstChild) {
            listEl.removeChild(listEl.firstChild);
        }
        if (!entries || entries.length === 0) {
            const li = document.createElement('li');
            const empty = document.createElement('span');
            empty.className = 'lb-empty';
            empty.textContent = 'No scores yet';
            li.appendChild(empty);
            listEl.appendChild(li);
            return;
        }

        // Subject → short tag mapping
        const TAG_MAP = { python: 'PY', html: 'HTML', css: 'CSS', maths: 'MATHS' };

        entries.forEach((entry, i) => {
            const li = document.createElement('li');

            const rankSpan = document.createElement('span');
            rankSpan.className = 'lb-rank';
            rankSpan.textContent = (i + 1) + '.';
            li.appendChild(rankSpan);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'lb-name';
            nameSpan.textContent = entry.name;
            li.appendChild(nameSpan);

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'lb-score';
            scoreSpan.textContent = entry.score + ' pts';
            li.appendChild(scoreSpan);

            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'lb-tags';
            const subjectsArr = Array.isArray(entry.subjects) ? entry.subjects : (entry.subject ? [entry.subject] : ['python']);
            for (const subj of subjectsArr) {
                const tag = document.createElement('span');
                tag.className = 'lb-tag';
                tag.textContent = TAG_MAP[subj] || subj.toUpperCase();
                tagsDiv.appendChild(tag);
            }
            li.appendChild(tagsDiv);

            listEl.appendChild(li);
        });
    }

    start(name, subjects) {
        this.playerName = name || 'Rider';
        this.subjects = (Array.isArray(subjects) && subjects.length > 0) ? subjects : ['python'];
        this.quizRun = Quiz.startRun(this.subjects);
        this.checkpointIndex = 0;
        this.questionIndex = 0;
        this.nextQuestionDistance = 8000;
        this.currentGate = null;
        const banner = document.getElementById('top-question-banner');
        if (banner) banner.className = 'hidden';
        const cpEl = document.getElementById('checkpointVal');
        if (cpEl) cpEl.textContent = 'Q 0/10';
        this.setStage(0);
        this.graceTime = 0;
        safeSfx('init');
        this.gameState = STATE.RACING;
        this.lastSteer = 0;
        this.runId = this.generateRunId();
        this.input.keys = {};
        this.input.keyboardSteer = 0;
        this.lastTime = performance.now();
        this.registerActivity();
        if (!this.loopRunning) {
            this.loopRunning = true;
            requestAnimationFrame(this.step);
        }
    }

    restart() {
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('countdown-screen').classList.add('hidden');
        const banner = document.getElementById('top-question-banner');
        if (banner) banner.className = 'hidden';
        this.resetRoad();
        this.speed = 0;
        this.score = 0;
        this.distanceRun = 0;
        this.position = 0;
        this.playerX = 0;
        this.cameraX = 0;
        this.lives = CONFIG.START_LIVES;
        this.coinsCollected = 0;
        this.hitFlashUntil = 0;
        // Quiz reset
        this.checkpointIndex = 0;
        this.questionIndex = 0;
        this.nextQuestionDistance = 8000;
        this.currentGate = null;
        this.setStage(0);
        this.graceTime = 0;
        this.currentQuestion = null;
        this.quizAnswerLocked = false;
        this.quizChosenIndex = -1;
        this.feedbackStartTime = 0;
        this.countdownStartTime = 0;
        this.countdownNum = 3;
        this.quizRun = Quiz.startRun(this.subjects);
        const cpEl = document.getElementById('checkpointVal');
        if (cpEl) cpEl.textContent = 'Q 0/10';
        this.lastTime = performance.now();
        safeSfx('init');
        safeSfx('engineStop');
        this.lastSteer = 0;
        this.runId = this.generateRunId();
        this.input.keys = {};
        this.input.keyboardSteer = 0;
        this.registerActivity();
        this.gameState = STATE.RACING;
    }

    /**
     * addScore — central scoring gate; clamps score at 0.
     */
    addScore(delta) {
        this.score = Math.max(0, this.score + delta);
    }

    /**
     * takeHit — -1 life, -CRASH_PENALTY score, speed cut, red flash, crash sound.
     * No coin deduction (PLAN §7). Per-obstacle hit flag prevents double-hits.
     * If lives reach 0, transitions to WASTED.
     */
    takeHit() {
        if (this.gameState !== STATE.RACING) return;
        if (this.graceTime > 0) return; // post-countdown grace
        this.lives -= CONFIG.HIT_LIFE_COST;
        this.addScore(-CONFIG.CRASH_PENALTY);
        this.speed *= CONFIG.HIT_SPEED_FACTOR;
        this.hitFlashUntil = Date.now() + CONFIG.HIT_FLASH_MS;
        this.screenShakeUntil = Date.now() + 600;

        // Hit feedback (THEME §5): red edge vignette, short shake, and "COLLISION!" banner (~600 ms)
        const flashEl = document.getElementById('damage-flash');
        if (flashEl) {
            flashEl.classList.remove('hidden');
            setTimeout(() => { if (flashEl) flashEl.classList.add('hidden'); }, 600);
        }
        const bannerEl = document.getElementById('collision-banner');
        if (bannerEl) {
            const textEl = document.getElementById('collision-banner-text');
            if (textEl) textEl.textContent = 'COLLISION -10';
            bannerEl.classList.remove('hidden');
            setTimeout(() => { if (bannerEl) bannerEl.classList.add('hidden'); }, 600);
        }

        safeSfx('crash');
        this._showScoreFloat(`-${CONFIG.CRASH_PENALTY}`, false);
        this._updateHUD();

        if (this.lives <= 0) {
            this.wasted();
        }
    }

    /**
     * endRun — shared end-of-run helper.
     * Sets gameState, stops the bike, saves best score, populates and shows game-over screen.
     */
    endRun(title, state) {
        this.gameState = state;
        this.speed = 0;
        this.lastSteer = 0;
        safeSfx('engineStop');

        const quizStats = this.quizRun ? this.quizRun.stats() : { answered: 0, correct: 0, timeouts: 0, accuracyPct: 0 };
        const submitArgs = {
            runId: this.runId,
            name: this.playerName,
            score: Math.floor(this.score),
            coins: this.coinsCollected,
            subjects: this.subjects,
            answered: quizStats.answered,
            correct: quizStats.correct,
            timeouts: quizStats.timeouts,
            finished: state === STATE.FINISHED
        };
        console.log('[LBDBG] submit args:', submitArgs);
        let submitResult = null;
        if (typeof Store !== 'undefined' && Store.submit) {
            submitResult = Store.submit(submitArgs);
        }
        console.log('[LBDBG] submit result:', submitResult);

        if (submitResult && typeof submitResult.personalBest === 'number') {
            this.highScore = submitResult.personalBest;
        } else if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('gestureRiderHighScore', this.highScore);
        }

        document.getElementById('game-over-title').textContent = title;
        document.getElementById('final-score').textContent = Math.floor(this.score);
        document.getElementById('best-score').textContent = this.highScore;

        const banner = document.getElementById('top-question-banner');
        if (banner) banner.className = 'hidden';

        // Results stats (PLAN §7)
        const statCoins = document.getElementById('stat-coins');
        if (statCoins) statCoins.textContent = this.coinsCollected;
        const statAnswered = document.getElementById('stat-answered');
        const totalTarget = Math.max(10, this.questionIndex || 10);
        if (statAnswered) statAnswered.textContent = `${quizStats.answered} / ${totalTarget}`;
        const statAccuracy = document.getElementById('stat-accuracy');
        if (statAccuracy) statAccuracy.textContent = `${quizStats.accuracyPct}%`;

        this.renderLeaderboard();

        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    /**
     * wasted — transition to WASTED state.
     */
    wasted() {
        safeSfx('wasted');
        safeSfx('engineStop');
        this.endRun('WASTED', STATE.WASTED);
    }

    /**
     * getRaceProgress — returns 0..1 progress toward the finish line.
     */
    getRaceProgress() {
        return Math.max(0, Math.min(1, this.distanceRun / CONFIG.RACE_DISTANCE));
    }

    update(dt) {
        // --- Inactivity Tracking (PLAN §5) ---
        if (this.gameState === STATE.QUIZ || this.gameState === STATE.FEEDBACK || this.gameState === STATE.COUNTDOWN) {
            // Never count or trigger during QUIZ, FEEDBACK, COUNTDOWN; reset timer when those states end.
            this.lastInputTime = performance.now();
            const idleWarning = document.getElementById('idle-warning');
            if (idleWarning && !idleWarning.classList.contains('hidden')) {
                idleWarning.classList.add('hidden');
            }
        } else if (
            this.gameState === STATE.MENU ||
            this.gameState === STATE.WASTED ||
            this.gameState === STATE.FINISHED ||
            this.gameState === STATE.RACING
        ) {
            const idleElapsed = performance.now() - this.lastInputTime;
            const idleWarning = document.getElementById('idle-warning');
            if (idleElapsed >= 60000) {
                this.returnToMenu();
                return;
            } else if (idleElapsed >= 45000) {
                if (idleWarning && idleWarning.classList.contains('hidden')) {
                    idleWarning.classList.remove('hidden');
                }
            } else {
                if (idleWarning && !idleWarning.classList.contains('hidden')) {
                    idleWarning.classList.add('hidden');
                }
            }
        }

        if (this.gameState !== STATE.RACING) {
            this.lastSteer = 0;
            safeSfx('engineStop');
        }

        // --- QUIZ state: drive timer from performance.now() ---
        if (this.gameState === STATE.QUIZ) {
            if (this.trackingLostEl) this.trackingLostEl.style.display = 'none';
            if (this.currentQuestion) {
                const elapsed = (performance.now() - this.quizStartTime) / 1000;
                const timeLimit = this.currentQuestion.timeLimit;
                const remaining = Math.max(0, timeLimit - elapsed);
                const timerNum = document.getElementById('quiz-timer-num');
                const timerBar = document.getElementById('quiz-timer-bar');
                if (timerNum) timerNum.textContent = Math.ceil(remaining);
                if (timerBar) timerBar.style.width = `${(remaining / timeLimit) * 100}%`;
                if (remaining <= 0 && !this.quizAnswerLocked) {
                    // Timeout
                    this.quizAnswerLocked = true;
                    this.quizChosenIndex = -1;
                    this.quizRun.record('timeout');
                    this.addScore(-CONFIG.QUIZ_WRONG_PENALTY);
                    this._showScoreFloat(`-${CONFIG.QUIZ_WRONG_PENALTY}`, false);
                    safeSfx('wrong');
                    this._startFeedback('TIME UP');
                }
            }
            return;
        }

        // --- FEEDBACK state: auto-dismiss after 6 s ---
        if (this.gameState === STATE.FEEDBACK) {
            if (this.trackingLostEl) this.trackingLostEl.style.display = 'none';
            if (performance.now() - this.feedbackStartTime >= CONFIG.QUIZ_FEEDBACK_AUTO_MS) {
                this._startCountdown();
            }
            return;
        }

        // --- COUNTDOWN state: 3-2-1 ---
        if (this.gameState === STATE.COUNTDOWN) {
            if (this.trackingLostEl) this.trackingLostEl.style.display = 'none';
            const elapsed = (performance.now() - this.countdownStartTime) / 1000;
            const num = CONFIG.COUNTDOWN_SECONDS - Math.floor(elapsed);
            if (num !== this.countdownNum && num >= 1) {
                this.countdownNum = num;
                const cdEl = document.getElementById('countdown-num');
                if (cdEl) cdEl.textContent = num;
                safeSfx('tick');
            }
            if (elapsed >= CONFIG.COUNTDOWN_SECONDS) {
                this._resumeRacing();
            }
            return;
        }

        if (this.gameState !== STATE.RACING) return;

        const trackingLost = this.input.isTrackingLost();
        if (this.trackingLostEl) {
            this.trackingLostEl.style.display = trackingLost ? 'flex' : 'none';
        }
        if (trackingLost) {
            this.input.resetDebugPanel();
        }

        const cmd = this.input.getCommand();
        this.lastSteer = cmd.steer;
        const ratio = this.speed / CONFIG.MAX_SPEED;
        safeSfx('engineUpdate', ratio);

        if (cmd.accel > 0) this.speed += CONFIG.ACCEL * cmd.accel * dt * 60;
        else if (cmd.brake > 0) this.speed += CONFIG.BRAKING * dt * 60;
        else this.speed += CONFIG.DECEL * dt * 60;

        this.speed = Math.max(0, Math.min(this.speed, CONFIG.MAX_SPEED));

        const steerAuthority = 0.35 + 0.65 * (this.speed / CONFIG.MAX_SPEED);
        const dx = dt * 3.5 * cmd.steer * steerAuthority;
        this.playerX -= dx;

        const playerSegment = this.findSegment(this.position + CONFIG.CAMERA_DEPTH * CONFIG.SEGMENT_LENGTH);
        this.playerX -= dx * playerSegment.curve * ratio * 0.1;

        if ((this.playerX < -1 || this.playerX > 1) && this.speed > 1500) this.speed += CONFIG.OFF_ROAD_DECEL * dt * 60;
        this.playerX = Math.max(-2, Math.min(2, this.playerX));

        // Smooth third-person chase camera follow
        const chaseSpeed = 7.5;
        if (this.cameraX === undefined) this.cameraX = this.playerX;
        this.cameraX += (this.playerX - this.cameraX) * Math.min(1, dt * chaseSpeed);

        // Decrement grace time & update shield indicator (NEEDS-HTML §3)
        if (this.graceTime > 0) this.graceTime = Math.max(0, this.graceTime - dt);
        const graceEl = document.getElementById('grace-indicator');
        if (graceEl) {
            graceEl.classList.toggle('hidden', this.graceTime <= 0);
        }

        // Parallax horizontal scroll: track curve and steering
        this.skyOffset = (this.skyOffset || 0) + (playerSegment.curve * ratio * 6) + (cmd.steer * ratio * 3);

        // --- Substepped movement and collisions ---
        const steps = Math.max(1, Math.ceil(this.speed * dt / 100));
        const subDt = dt / steps;
        const trackLength = this.segments.length * CONFIG.SEGMENT_LENGTH;

        for (let s = 0; s < steps; s++) {
            if (this.gameState !== STATE.RACING) break;

            this.position += this.speed * subDt;
            this.distanceRun += this.speed * subDt;

            if (this.position >= trackLength) this.position -= trackLength;
            if (this.position < 0) this.position += trackLength;

            this.updateTraffic(subDt);
            this.checkSpriteCollisions();
            this.checkCoinCollections();
            this.checkGateCollision();

            // Finish line — triggers once (state change prevents re-entry)
            if (this.gameState === STATE.RACING && this.distanceRun >= CONFIG.RACE_DISTANCE) {
                this.addScore(CONFIG.FINISH_BONUS);
                this._showScoreFloat(`+${CONFIG.FINISH_BONUS}`, true);
                this.endRun('FINISH!', STATE.FINISHED);
                break;
            }
        }

        // --- Continuous 2-Track Choice Question Spawning (non-pausing, real-time) ---
        if (this.gameState === STATE.RACING) {
            this.checkQuestionSpawning();
        }

        this._updateHUD();
    }

    /**
     * checkQuestionSpawning — spawns real-time 2-track choice questions.
     * Game NEVER stops or pauses. At least 10 questions per run, closely spaced.
     */
    checkQuestionSpawning() {
        if (this.gameState !== STATE.RACING) return;
        if (this.currentGate) return;
        if (this.distanceRun < this.nextQuestionDistance) return;

        this.questionIndex++;
        const q = this.quizRun.nextQuestion(this.questionIndex);
        if (!q) return;

        // Determine correct track (50% left, 50% right)
        const isLeftCorrect = this.rng() > 0.5;
        const correctTrack = isLeftCorrect ? 'left' : 'right';
        const wrongOptions = q.options.filter((_, idx) => idx !== q.answerIndex);
        const wrongText = wrongOptions[Math.floor(this.rng() * wrongOptions.length)] || 'None';
        const correctText = q.options[q.answerIndex];
        const leftText = isLeftCorrect ? correctText : wrongText;
        const rightText = isLeftCorrect ? wrongText : correctText;

        // Place gate ~220 segments (44,000 units) ahead of player position
        // Gives the player 5.5 to 7+ seconds to comfortably read the question and steer
        const gateDistAhead = 220 * CONFIG.SEGMENT_LENGTH;
        const targetPos = this.position + gateDistAhead;
        const gateSegIndex = Math.floor(targetPos / CONFIG.SEGMENT_LENGTH) % this.segments.length;

        // Clear traffic and barriers near gate so tracks are clear to navigate
        for (let off = -6; off <= 6; off++) {
            const sIdx = (gateSegIndex + off + this.segments.length) % this.segments.length;
            this.segments[sIdx].cars = [];
            this.segments[sIdx].sprites = [];
        }

        const gate = {
            id: q.id,
            index: this.questionIndex,
            q: q.q,
            subject: q.subject,
            leftText,
            rightText,
            correctTrack,
            segmentIndex: gateSegIndex,
            resolved: false
        };

        this.currentGate = gate;
        this.segments[gateSegIndex].gate = gate;

        // Update Top Screen Question Banner
        const banner = document.getElementById('top-question-banner');
        if (banner) {
            banner.classList.remove('hidden', 'flash-correct', 'flash-wrong');
            const subjEl = document.getElementById('tqb-subject');
            if (subjEl) subjEl.textContent = (q.subject || 'QUIZ').toUpperCase();
            const counterEl = document.getElementById('tqb-counter');
            if (counterEl) counterEl.textContent = `QUESTION ${this.questionIndex}/10`;
            const qEl = document.getElementById('tqb-question');
            if (qEl) qEl.textContent = q.q;
            const leftEl = document.getElementById('tqb-left-text');
            if (leftEl) leftEl.textContent = leftText;
            const rightEl = document.getElementById('tqb-right-text');
            if (rightEl) rightEl.textContent = rightText;
        }

        const cpEl = document.getElementById('checkpointVal');
        if (cpEl) cpEl.textContent = `Q ${this.questionIndex}/10`;

        // Progressive stage density bump
        this.setStage(Math.min(4, Math.floor(this.questionIndex / 3)));
    }

    /**
     * checkGateCollision — checks if player has passed the gate in real-time.
     * Correct track -> score +100. Wrong track -> live is lost!
     */
    checkGateCollision() {
        if (!this.currentGate || this.currentGate.resolved) return;

        const gate = this.currentGate;
        const playerZ = this.position + CONFIG.CAMERA_HEIGHT;
        const trackLen = this.segments.length * CONFIG.SEGMENT_LENGTH;
        const gateZ = gate.segmentIndex * CONFIG.SEGMENT_LENGTH;

        let dist = gateZ - playerZ;
        if (dist < -trackLen / 2) dist += trackLen;
        if (dist > trackLen / 2) dist -= trackLen;

        // Live distance indicator on banner hint while approaching gate
        if (dist > 0) {
            const hintEl = document.getElementById('tqb-hint');
            if (hintEl) {
                const meters = Math.round(dist / 100);
                hintEl.textContent = meters > 15 ? `GATE IN ${meters}m — STEER TO TRACK` : 'GATE AHEAD!';
            }
        }

        // Trigger on passing gate line
        if (dist <= 0 && dist > -400) {
            gate.resolved = true;
            const chosenTrack = this.playerX < 0 ? 'left' : 'right';
            const isOffRoad = Math.abs(this.playerX) > 1.25;
            const isCorrect = !isOffRoad && (chosenTrack === gate.correctTrack);

            const banner = document.getElementById('top-question-banner');

            if (isCorrect) {
                this.quizRun.record('correct');
                this.addScore(CONFIG.QUIZ_CORRECT_SCORE);
                safeSfx('correct');
                this._showScoreFloat(`+${CONFIG.QUIZ_CORRECT_SCORE} CORRECT!`, true);
                if (banner) {
                    banner.classList.remove('flash-wrong');
                    banner.classList.add('flash-correct');
                }
            } else {
                this.quizRun.record('wrong');
                this.lives = Math.max(0, this.lives - 1);
                this._updateHUD();
                safeSfx('wrong');
                safeSfx('crash');
                this.hitFlashUntil = Date.now() + CONFIG.HIT_FLASH_MS;
                this.screenShakeUntil = Date.now() + 600;
                this.speed *= CONFIG.HIT_SPEED_FACTOR;

                const flashEl = document.getElementById('damage-flash');
                if (flashEl) {
                    flashEl.classList.remove('hidden');
                    setTimeout(() => { if (flashEl) flashEl.classList.add('hidden'); }, 600);
                }
                const bannerEl = document.getElementById('collision-banner');
                if (bannerEl) {
                    const textEl = document.getElementById('collision-banner-text');
                    if (textEl) textEl.textContent = 'WRONG TRACK -1 LIFE';
                    bannerEl.classList.remove('hidden');
                    setTimeout(() => { if (bannerEl) bannerEl.classList.add('hidden'); }, 600);
                }

                this._showScoreFloat('-1 LIFE WRONG!', false);
                if (banner) {
                    banner.classList.remove('flash-correct');
                    banner.classList.add('flash-wrong');
                }
            }

            const gateRef = gate;
            setTimeout(() => {
                if (this.currentGate === gateRef) {
                    if (banner) {
                        banner.classList.add('hidden');
                        banner.classList.remove('flash-correct', 'flash-wrong');
                    }
                    this.segments[gateRef.segmentIndex].gate = null;
                    this.currentGate = null;
                }
            }, 1200);

            // Short interval between questions ("decrease the time between the questions")
            this.nextQuestionDistance = this.distanceRun + 20000;

            if (this.lives <= 0) {
                this.wasted();
            }
        }
    }

    // ----------------------------------------------------------------
    // QUIZ FLOW METHODS
    // ----------------------------------------------------------------

    /**
     * _showQuiz — transition to QUIZ state, fill quiz card from quiz.js.
     */
    _showQuiz() {
        this.gameState = STATE.QUIZ;
        safeSfx('engineStop');
        safeSfx('quizOpen');

        const q = this.quizRun.nextQuestion(this.checkpointIndex);
        this.currentQuestion = q;
        this.quizStartTime = performance.now();
        this.quizAnswerLocked = false;
        this.quizChosenIndex = -1;

        // Fill card
        const progEl = document.getElementById('quiz-progress');
        if (progEl) progEl.textContent = `Question ${this.checkpointIndex} of 4`;
        const qEl = document.getElementById('quiz-question');
        if (qEl) qEl.textContent = q.q;

        const letters = ['A', 'B', 'C', 'D'];
        for (let i = 0; i < 4; i++) {
            const btn = document.getElementById(`quiz-opt-${i}`);
            if (!btn) continue;
            btn.className = 'quiz-opt-btn'; // reset classes
            btn.disabled = false;
            const keyEl = btn.querySelector('.opt-key');
            const textEl = btn.querySelector('.opt-text');
            if (keyEl) keyEl.textContent = letters[i];
            if (textEl) textEl.textContent = q.options[i];
        }

        // Timer initial
        const timerNum = document.getElementById('quiz-timer-num');
        const timerBar = document.getElementById('quiz-timer-bar');
        if (timerNum) timerNum.textContent = q.timeLimit;
        if (timerBar) timerBar.style.width = '100%';

        // Show quiz card, hide feedback within it
        document.getElementById('quiz-feedback').classList.add('hidden');
        document.getElementById('quiz-screen').classList.remove('hidden');
    }

    /**
     * _handleQuizAnswer — process the selected answer.
     */
    _handleQuizAnswer(chosenIndex) {
        if (this.gameState !== STATE.QUIZ) return;
        if (this.quizAnswerLocked) return;
        // Lockout for first 600 ms
        if (performance.now() - this.quizStartTime < CONFIG.QUIZ_LOCKOUT_MS) return;

        this.quizAnswerLocked = true;
        this.quizChosenIndex = chosenIndex;

        const q = this.currentQuestion;
        const correct = chosenIndex === q.answerIndex;

        // Record in quiz.js
        this.quizRun.record(correct ? 'correct' : 'wrong');

        // Score & sound
        if (correct) {
            this.addScore(CONFIG.QUIZ_CORRECT_SCORE);
            this._showScoreFloat(`+${CONFIG.QUIZ_CORRECT_SCORE}`, true);
            safeSfx('correct');
        } else {
            this.addScore(-CONFIG.QUIZ_WRONG_PENALTY);
            this._showScoreFloat(`-${CONFIG.QUIZ_WRONG_PENALTY}`, false);
            safeSfx('wrong');
        }

        // Mark buttons
        const chosenBtn = document.getElementById(`quiz-opt-${chosenIndex}`);
        if (chosenBtn) chosenBtn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
            const correctBtn = document.getElementById(`quiz-opt-${q.answerIndex}`);
            if (correctBtn) correctBtn.classList.add('correct');
        }

        this._startFeedback(correct ? 'CORRECT' : 'WRONG');
    }

    /**
     * _startFeedback — show feedback panel, transition to FEEDBACK state.
     */
    _startFeedback(resultLabel) {
        this.gameState = STATE.FEEDBACK;
        this.feedbackStartTime = performance.now();

        const q = this.currentQuestion;
        const letters = ['A', 'B', 'C', 'D'];

        const labelEl = document.getElementById('quiz-result-label');
        if (labelEl) {
            labelEl.textContent = resultLabel;
            if (resultLabel === 'CORRECT') labelEl.style.color = '#44ff88';
            else labelEl.style.color = '#ff6677';
        }

        const correctEl = document.getElementById('quiz-correct-answer');
        if (correctEl) correctEl.textContent = `Correct answer: ${letters[q.answerIndex]}. ${q.options[q.answerIndex]}`;

        const explainEl = document.getElementById('quiz-explanation');
        if (explainEl) explainEl.textContent = q.explain || '';

        // Disable option buttons
        for (let i = 0; i < 4; i++) {
            const btn = document.getElementById(`quiz-opt-${i}`);
            if (btn) btn.disabled = true;
        }

        document.getElementById('quiz-feedback').classList.remove('hidden');
    }

    /**
     * _startCountdown — hide quiz, show 3-2-1 countdown.
     */
    _startCountdown() {
        this.gameState = STATE.COUNTDOWN;
        this.countdownStartTime = performance.now();
        this.countdownNum = CONFIG.COUNTDOWN_SECONDS;

        safeSfx('engineStop');
        safeSfx('tick');

        document.getElementById('quiz-screen').classList.add('hidden');
        const cdEl = document.getElementById('countdown-num');
        if (cdEl) cdEl.textContent = this.countdownNum;
        document.getElementById('countdown-screen').classList.remove('hidden');
    }

    /**
     * _resumeRacing — called when countdown finishes.
     */
    _resumeRacing() {
        document.getElementById('countdown-screen').classList.add('hidden');

        // Reset timing to avoid dt jump
        this.lastTime = performance.now();

        // Clear stale input
        this.input.keys = {};
        this.input.keyboardSteer = 0;
        this.input.gesture.tilt = 0;
        this.input.gesture.throttle = 0;
        this.input.gesture.brake = 0;
        this.lastSteer = 0;

        // Grace period: 1 s of racing where hits are skipped
        this.graceTime = CONFIG.GRACE_DURATION;

        this.gameState = STATE.RACING;
        safeSfx('go');
        this.registerActivity();
    }

    /**
     * _onQuizKey — keydown handler for quiz answers and feedback dismiss.
     */
    _onQuizKey(e) {
        if (this.isOrganizerModalOpen) return;
        this.registerActivity();
        const isInput = (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select')) ||
                        (e.target && e.target.matches && e.target.matches('input, textarea, select'));
        if (isInput) return;

        // Prevent Space/Enter from scrolling/triggering
        if (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter') {
            if (this.gameState === STATE.QUIZ || this.gameState === STATE.FEEDBACK || this.gameState === STATE.COUNTDOWN) {
                e.preventDefault();
            }
        }

        // Answer keys in QUIZ state
        if (this.gameState === STATE.QUIZ && !this.quizAnswerLocked) {
            if (e.repeat) return;
            const map = {
                'KeyA': 0, 'Digit1': 0, 'Numpad1': 0, 'a': 0, 'A': 0, '1': 0,
                'KeyB': 1, 'Digit2': 1, 'Numpad2': 1, 'b': 1, 'B': 1, '2': 1,
                'KeyC': 2, 'Digit3': 2, 'Numpad3': 2, 'c': 2, 'C': 2, '3': 2,
                'KeyD': 3, 'Digit4': 3, 'Numpad4': 3, 'd': 3, 'D': 3, '4': 3
            };
            const choice = (e.code && e.code in map) ? map[e.code] : (e.key && e.key in map ? map[e.key] : undefined);
            if (choice !== undefined) {
                e.preventDefault();
                this._handleQuizAnswer(choice);
            }
            return;
        }

        // Dismiss feedback with Space/Enter
        if (this.gameState === STATE.FEEDBACK) {
            if (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter') {
                this._startCountdown();
            }
            return;
        }
    }

    _updateHUD() {
        document.getElementById('scoreVal').textContent = Math.floor(this.score);
        document.getElementById('distVal').textContent = (this.distanceRun / 100000).toFixed(1);
        document.getElementById('speedVal').textContent = Math.floor(this.speed / 100);
        document.getElementById('livesVal').textContent = '❤️'.repeat(Math.max(0, this.lives));
    }

    /**
     * checkSpriteCollisions — trees and crash objects.
     * One-hit rule: once flagged hit, ignore until the obstacle is far behind.
     */
    checkSpriteCollisions() {
        const playerZ = this.position + CONFIG.CAMERA_HEIGHT;
        const trackLen = this.segments.length * CONFIG.SEGMENT_LENGTH;
        const startSeg = Math.floor(playerZ / CONFIG.SEGMENT_LENGTH) % this.segments.length;

        for (let i = -1; i <= 2; i++) {
            const idx = (startSeg + i + this.segments.length) % this.segments.length;
            const segment = this.segments[idx];

            for (let j = 0; j < segment.sprites.length; j++) {
                const sprite = segment.sprites[j];
                // Roadside scenery does not block the road; only barrier and cone do
                if (!['barrier', 'cone'].includes(sprite.type)) continue;

                let dist = segment.p1.world.z - playerZ;
                if (dist < -trackLen / 2) dist += trackLen;
                if (dist > trackLen / 2) dist -= trackLen;

                // Clear hit flag when obstacle is still ahead (> 300 units) so the
                // near-player scan window (i = -1..+2) can actually see it re-armed.
                if (dist > 300) sprite.hit = false;

                if (sprite.hit) continue;

                if (Math.abs(dist) < 150) {
                    const objW = sprite.type === 'barrier' ? 0.5 : 0.2;
                    const playerW = 0.26;
                    if (this.overlap(this.playerX, playerW, sprite.offset, objW)) {
                        sprite.hit = true;
                        this.takeHit();
                        return;
                    }
                }
            }
        }
    }

    /**
     * checkCoinCollections — collect coins on overlap.
     * collected flag is permanent for this run; reset in resetRoad().
     */
    checkCoinCollections() {
        const playerZ = this.position + CONFIG.CAMERA_HEIGHT;
        const trackLen = this.segments.length * CONFIG.SEGMENT_LENGTH;
        const startSeg = Math.floor(playerZ / CONFIG.SEGMENT_LENGTH) % this.segments.length;

        for (let i = -1; i <= 2; i++) {
            const idx = (startSeg + i + this.segments.length) % this.segments.length;
            const segment = this.segments[idx];

            for (let j = 0; j < segment.coins.length; j++) {
                const coin = segment.coins[j];
                if (coin.collected) continue;

                let dist = segment.p1.world.z - playerZ;
                if (dist < -trackLen / 2) dist += trackLen;
                if (dist > trackLen / 2) dist -= trackLen;

                if (Math.abs(dist) < 120) {
                    const coinW = 0.18;
                    const playerW = 0.28;
                    if (this.overlap(this.playerX, playerW, coin.offset, coinW)) {
                        coin.collected = true;
                        this.coinsCollected++;
                        this.addScore(CONFIG.COIN_SCORE);
                        this._showScoreFloat(`+${CONFIG.COIN_SCORE}`, true);
                        safeSfx('coin');
                    }
                }
            }
        }
    }

    /**
     * updateTraffic — Phase 2 rules:
     *  • car.canHit starts false; becomes true once car is > threshold AHEAD of player.
     *  • car.hit (one-hit): set on collision, cleared when car is far behind.
     *  • Distance-based score accumulation removed (PLAN §6).
     */
    updateTraffic(dt) {
        const carsToMove = [];
        const playerZ = this.position + CONFIG.CAMERA_HEIGHT;
        const trackLen = this.segments.length * CONFIG.SEGMENT_LENGTH;
        const threshold = (CONFIG.STAGE_MULTIPLIERS[this.stage] || 1.0) / 1.5;

        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            for (let j = 0; j < segment.cars.length; j++) {
                const car = segment.cars[j];

                // Inactive cars are not drawn, not updated, and cannot hit the player
                if (!car.active) {
                    if (car.r < threshold) {
                        let dist = car.z - playerZ;
                        if (dist < -trackLen / 2) dist += trackLen;
                        if (dist > trackLen / 2) dist -= trackLen;
                        if (Math.abs(dist) > 600) {
                            car.active = true;
                        }
                    }
                    if (!car.active) continue;
                }

                car.z += car.speed * dt;
                if (car.z > trackLen) car.z -= trackLen;
                if (car.z < 0) car.z += trackLen;

                const actualSeg = Math.floor(car.z / CONFIG.SEGMENT_LENGTH) % this.segments.length;
                if (i !== actualSeg) carsToMove.push({ car, from: i, to: actualSeg });

                let dist = car.z - playerZ; // positive = car is ahead of player
                if (dist < -trackLen / 2) dist += trackLen;
                if (dist > trackLen / 2) dist -= trackLen;

                // Grant hit-permission only when car is sufficiently ahead
                if (dist > CONFIG.CAR_HIT_AHEAD_THRESHOLD) car.canHit = true;
                // Reset when car has passed far behind
                if (dist < -CONFIG.CAR_HIT_AHEAD_THRESHOLD) { car.canHit = false; car.hit = false; }

                if (!car.canHit) continue;
                if (car.hit) continue;

                if (Math.abs(dist) < 200) {
                    const carW = 0.45, playerW = 0.26;
                    if (this.overlap(this.playerX, playerW, car.offset, carW)) {
                        car.hit = true;
                        this.takeHit();
                    }
                }
            }
        }

        for (const move of carsToMove) {
            const from = this.segments[move.from];
            const to = this.segments[move.to];
            const idx = from.cars.indexOf(move.car);
            if (idx > -1) { from.cars.splice(idx, 1); to.cars.push(move.car); }
        }
    }

    overlap(x1, w1, x2, w2) {
        return !((x1 + w1 / 2 < x2 - w2 / 2) || (x1 - w1 / 2 > x2 + w2 / 2));
    }

    findSegment(z) {
        return this.segments[Math.floor(z / CONFIG.SEGMENT_LENGTH) % this.segments.length];
    }

    /**
     * _showScoreFloat — floating score delta popup near the score HUD.
     * isPositive=true → green, false → red. Duration 700 ms (PLAN §7).
     */
    _showScoreFloat(text, isPositive) {
        const area = document.getElementById('message-area');
        if (!area) return;
        const msg = document.createElement('div');
        msg.className = 'float-msg score-float';
        msg.style.color = isPositive ? '#00ff88' : '#ff3366';
        msg.textContent = text;
        area.appendChild(msg);
        setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 700);
    }

    // ----------------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------------

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.renderBackground();

        const camX = (this.cameraX !== undefined) ? this.cameraX : this.playerX;
        const speedRatio = this.speed / CONFIG.MAX_SPEED;

        // Subtle camera movement during acceleration and collisions
        let camShakeX = (Math.random() - 0.5) * speedRatio * 2.5;
        let camShakeY = (Math.random() - 0.5) * speedRatio * 2.5;
        const accelDip = speedRatio * 3.5;

        if (Date.now() < this.screenShakeUntil) {
            camShakeX += (Math.random() - 0.5) * 16;
            camShakeY += (Math.random() - 0.5) * 16;
        }

        this.ctx.save();
        this.ctx.translate(camShakeX, camShakeY + accelDip);

        const baseSegment = this.findSegment(this.position);
        const basePercent = Utils.percentRemaining(this.position, CONFIG.SEGMENT_LENGTH);

        const playerSegment = this.findSegment(this.position + CONFIG.CAMERA_DEPTH * CONFIG.SEGMENT_LENGTH);
        const playerPercent = Utils.percentRemaining(this.position + CONFIG.CAMERA_DEPTH * CONFIG.SEGMENT_LENGTH, CONFIG.SEGMENT_LENGTH);
        const playerY = Utils.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);

        let dx = -(baseSegment.curve * basePercent);
        let x = 0;
        let maxY = this.height;

        for (let n = 0; n < CONFIG.DRAW_DISTANCE; n++) {
            const segment = this.segments[(baseSegment.index + n) % this.segments.length];
            segment.looped = segment.index < baseSegment.index;
            x += dx; dx += segment.curve;
            const loopOffset = segment.looped ? this.segments.length * CONFIG.SEGMENT_LENGTH : 0;

            Utils.project(segment.p1, (camX * CONFIG.ROAD_WIDTH) - x, playerY + CONFIG.CAMERA_HEIGHT, this.position - loopOffset, CONFIG.CAMERA_DEPTH, this.width, this.height, CONFIG.ROAD_WIDTH);
            Utils.project(segment.p2, (camX * CONFIG.ROAD_WIDTH) - x - dx, playerY + CONFIG.CAMERA_HEIGHT, this.position - loopOffset, CONFIG.CAMERA_DEPTH, this.width, this.height, CONFIG.ROAD_WIDTH);

            if (segment.p1.camera.z <= CONFIG.CAMERA_DEPTH || segment.p2.screen.y >= maxY || segment.p2.screen.y >= segment.p1.screen.y) continue;

            this.renderSegment(segment);
            maxY = segment.p1.screen.y;
            segment.clipY = maxY;
        }

        // Third-person player car screen positioning (anchored lower-middle)
        const lateralLag = (this.playerX - camX);
        const steerSway = -(this.lastSteer || 0) * (this.width * 0.022);
        const carScreenX = this.width / 2 + lateralLag * (this.width * 0.35) + steerSway;
        const carScreenY = this.height * 0.85;
        const carW = Math.max(140, Math.min(460, this.width * 0.22));
        const carH = carW * 0.46;

        // Headlight beams projected forward from the player's car
        const horizon = this.height / 2;
        const coneTopY = horizon + (this.height - horizon) * 0.45;
        const coneTopW = (baseSegment.p1.screen.w || 300) * 0.85;
        const carFrontY = carScreenY - carH * 0.55;
        const hlSpread = coneTopW * 0.8;

        const coneGrad = this.ctx.createLinearGradient(0, coneTopY, 0, carFrontY);
        coneGrad.addColorStop(0, 'rgba(25, 240, 255, 0)');
        coneGrad.addColorStop(0.35, 'rgba(15, 240, 255, 0.04)');
        coneGrad.addColorStop(1, 'rgba(15, 240, 255, 0.22)');
        this.ctx.fillStyle = coneGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(carScreenX - hlSpread, coneTopY);
        this.ctx.lineTo(carScreenX + hlSpread, coneTopY);
        this.ctx.lineTo(carScreenX + carW * 0.38, carFrontY);
        this.ctx.lineTo(carScreenX - carW * 0.38, carFrontY);
        this.ctx.closePath();
        this.ctx.fill();

        // 12-20 cyan speed streaks whose alpha and length scale with speed (THEME §3)
        this.renderSpeedStreaks(speedRatio);

        // Back-to-front: gates, sprites, cars, coins
        let drawnRoadsideCount = 0;
        const now = performance.now();
        const coinPhase = (now / 1000 * 2.5) % 1;

        for (let n = CONFIG.DRAW_DISTANCE - 1; n > 0; n--) {
            if (n < 3) continue;
            const segment = this.segments[(baseSegment.index + n) % this.segments.length];

            // 2-Track Choice Gates (preserved)
            if (segment.gate) {
                this.renderGate(segment);
            }

            // Cars via Sprites.drawCar with varied colourKey
            for (const car of segment.cars) {
                if (!car.active) continue;
                const scale = segment.p1.screen.w;
                if (scale > 5) {
                    if (typeof Sprites !== 'undefined' && Sprites.drawCar) {
                        Sprites.drawCar(this.ctx, car.type, segment.p1.screen.x + scale * car.offset, segment.p1.screen.y, scale, car.colorKey);
                    } else {
                        this.renderCar(segment.p1.screen.x + scale * car.offset, segment.p1.screen.y, scale, car);
                    }
                }
            }

            // Roadside scenery, barriers, cones via Sprites
            for (const sprite of segment.sprites) {
                const scale = segment.p1.screen.w;
                if (scale > 5) {
                    if (sprite.type === 'barrier') {
                        if (typeof Sprites !== 'undefined' && Sprites.drawBarrier) {
                            Sprites.drawBarrier(this.ctx, segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale);
                        } else {
                            this.renderSprite(segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale, sprite.type);
                        }
                    } else if (sprite.type === 'cone') {
                        if (typeof Sprites !== 'undefined' && Sprites.drawCone) {
                            Sprites.drawCone(this.ctx, segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale);
                        } else {
                            this.renderSprite(segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale, sprite.type);
                        }
                    } else {
                        // Roadside scenery capped at ~60 per frame
                        if (drawnRoadsideCount < 60) {
                            drawnRoadsideCount++;
                            if (typeof Sprites !== 'undefined' && Sprites.drawScenery) {
                                Sprites.drawScenery(this.ctx, sprite.type, segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale, sprite.label);
                            } else {
                                this.renderSprite(segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale, sprite.type);
                            }
                        }
                    }
                }
            }

            // Coins via Sprites.drawCoin with spin phase
            for (const coin of segment.coins) {
                if (coin.collected) continue;
                const scale = segment.p1.screen.w;
                if (scale > 5) {
                    const r = Math.min(28, Math.max(4, scale * 0.08));
                    if (typeof Sprites !== 'undefined' && Sprites.drawCoin) {
                        Sprites.drawCoin(this.ctx, segment.p1.screen.x + scale * coin.offset, segment.p1.screen.y - r * 1.5, r, coinPhase);
                    } else {
                        this.renderCoin(segment.p1.screen.x + scale * coin.offset, segment.p1.screen.y, scale);
                    }
                }
            }
        }

        this.particles.updateAndDraw(speedRatio);

        // Third-person Cyberpunk Sports Car (clearly visible on the road)
        this.renderPlayerCar(carScreenX, carScreenY, carW, carH);

        this.ctx.restore(); // Restore camera shake and pitch

        // Red flash overlay on hit
        if (Date.now() < this.hitFlashUntil) {
            const alpha = (this.hitFlashUntil - Date.now()) / CONFIG.HIT_FLASH_MS * 0.45;
            this.ctx.fillStyle = `rgba(255,0,0,${alpha})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    renderBackground() {
        if (!this.bgLayers) return;
        const { skyCanvas, sunCanvas, farCanvas, midCanvas, horizon, bgW } = this.bgLayers;

        // 1. Sky & stars
        this.ctx.drawImage(skyCanvas, 0, 0);

        // 2. Striped sun (slight parallax)
        const sunX = (this.width / 2 - sunCanvas.width / 2) + (this.skyOffset || 0) * 0.05;
        const sunY = horizon - sunCanvas.height * 0.65;
        this.ctx.drawImage(sunCanvas, sunX, sunY);

        // 3. Far skyline (scrolled parallax)
        const farOffset = ((this.skyOffset || 0) * 0.2) % bgW;
        let farX = -farOffset;
        while (farX > 0) farX -= bgW;
        while (farX < this.width) {
            this.ctx.drawImage(farCanvas, farX, 0);
            farX += bgW;
        }

        // 4. Mid skyline (faster parallax)
        const midOffset = ((this.skyOffset || 0) * 0.45) % bgW;
        let midX = -midOffset;
        while (midX > 0) midX -= bgW;
        while (midX < this.width) {
            this.ctx.drawImage(midCanvas, midX, 0);
            midX += bgW;
        }

        // 5. Thin teal glow band at horizon (haze)
        const hazeGrad = this.ctx.createLinearGradient(0, horizon - 14, 0, horizon + 14);
        hazeGrad.addColorStop(0, 'rgba(25, 240, 255, 0)');
        hazeGrad.addColorStop(0.5, 'rgba(25, 240, 255, 0.22)');
        hazeGrad.addColorStop(1, 'rgba(25, 240, 255, 0)');
        this.ctx.fillStyle = hazeGrad;
        this.ctx.fillRect(0, horizon - 14, this.width, 28);
    }

    renderSpeedStreaks(speedRatio) {
        if (speedRatio < 0.15) return;
        const horizon = this.height / 2;
        const vpX = this.width / 2;
        const streakCount = 16;
        this.ctx.save();
        this.ctx.lineWidth = 1.5;

        const rng = makeLCG(999);
        for (let i = 0; i < streakCount; i++) {
            const angle = rng() * Math.PI * 2;
            const minDist = 80 + rng() * 120;
            const len = (40 + rng() * 120) * speedRatio;
            const alpha = Math.min(0.65, speedRatio * (0.15 + rng() * 0.35));

            this.ctx.strokeStyle = `rgba(25, 240, 255, ${alpha})`;
            this.ctx.beginPath();
            const sx = vpX + Math.cos(angle) * minDist;
            const sy = horizon + Math.sin(angle) * minDist * 0.6;
            const ex = vpX + Math.cos(angle) * (minDist + len);
            const ey = horizon + Math.sin(angle) * (minDist + len) * 0.6;
            this.ctx.moveTo(sx, sy);
            this.ctx.lineTo(ex, ey);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    renderSegment(segment) {
        const x1 = segment.p1.screen.x, y1 = segment.p1.screen.y, w1 = segment.p1.screen.w;
        const x2 = segment.p2.screen.x, y2 = segment.p2.screen.y, w2 = segment.p2.screen.w;

        // Dark ground beside the road: near-black with subtle dark-blue horizontal bands (no green grass)
        this.ctx.fillStyle = (Math.floor(segment.index / 3) % 2) ? '#080c16' : THEME.ground;
        this.ctx.fillRect(0, y2, this.width, y1 - y2);

        // Dark asphalt road
        this.ctx.fillStyle = THEME.asphalt;
        this.ctx.beginPath();
        this.ctx.moveTo(x1 - w1, y1); this.ctx.lineTo(x2 - w2, y2);
        this.ctx.lineTo(x2 + w2, y2); this.ctx.lineTo(x1 + w1, y1);
        this.ctx.fill();

        // Edge rumble strips: big alternating slabs, cyan (#19f0ff) and hot pink (#ff2e8a), by segment index
        const r1 = w1 / Math.max(6, 2 * CONFIG.LANES);
        const r2 = w2 / Math.max(6, 2 * CONFIG.LANES);
        this.ctx.fillStyle = (Math.floor(segment.index / 2) % 2) ? THEME.cyan : THEME.pink;
        this.ctx.beginPath(); this.ctx.moveTo(x1 - w1 - r1, y1); this.ctx.lineTo(x1 - w1, y1); this.ctx.lineTo(x2 - w2, y2); this.ctx.lineTo(x2 - w2 - r2, y2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.moveTo(x1 + w1 + r1, y1); this.ctx.lineTo(x1 + w1, y1); this.ctx.lineTo(x2 + w2, y2); this.ctx.lineTo(x2 + w2 + r2, y2); this.ctx.fill();

        // Center lane dashes: bright cyan-white (#e8f7ff), glowing slightly (2-track divider)
        if (Math.floor(segment.index / 2) % 2) {
            const l1 = w1 / 35, l2 = w2 / 35;
            this.ctx.fillStyle = '#e8f7ff';
            this.ctx.beginPath();
            this.ctx.moveTo(x1 - l1, y1);
            this.ctx.lineTo(x1 + l1, y1);
            this.ctx.lineTo(x2 + l2, y2);
            this.ctx.lineTo(x2 - l2, y2);
            this.ctx.fill();
        }
    }

    renderSprite(x, y, scale, type) {
        if (scale <= 0) return;
        const w = scale * 0.5, h = scale * 1.5;

        if (type === 'tree') {
            this.ctx.fillStyle = CONFIG.COLORS.TREE_TRUNK;
            this.ctx.fillRect(x - w * 0.2, y - h, w * 0.4, h);
            this.ctx.fillStyle = CONFIG.COLORS.TREE_LEAVES;
            this.ctx.beginPath(); this.ctx.moveTo(x - w, y - h * 0.5); this.ctx.lineTo(x, y - h * 1.5); this.ctx.lineTo(x + w, y - h * 0.5); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.moveTo(x - w * 0.8, y - h); this.ctx.lineTo(x, y - h * 1.8); this.ctx.lineTo(x + w * 0.8, y - h); this.ctx.fill();
        } else if (type === 'barrier') {
            // Orange/white striped road barrier
            const bw = scale * 0.55, bh = scale * 0.35;
            // Main body — alternating stripes
            for (let s = 0; s < 4; s++) {
                this.ctx.fillStyle = s % 2 === 0 ? '#ff6600' : '#ffffff';
                this.ctx.fillRect(x - bw / 2 + s * bw / 4, y - bh, bw / 4, bh);
            }
            // Dark outline
            this.ctx.strokeStyle = '#222';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - bw / 2, y - bh, bw, bh);
            // Top cap
            this.ctx.fillStyle = '#cc4400';
            this.ctx.fillRect(x - bw / 2 - 2, y - bh - 4, bw + 4, 5);
        } else if (type === 'cone') {
            // Orange traffic cone
            const ch = scale * 0.8, cw = scale * 0.25;
            // Cone body
            this.ctx.fillStyle = '#ff6600';
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - ch);
            this.ctx.lineTo(x - cw, y);
            this.ctx.lineTo(x + cw, y);
            this.ctx.closePath();
            this.ctx.fill();
            // White band
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            const bandY = y - ch * 0.35;
            const bandW = cw * 0.65;
            this.ctx.moveTo(x - bandW, bandY);
            this.ctx.lineTo(x + bandW, bandY);
            this.ctx.lineTo(x + bandW * 1.1, bandY + ch * 0.12);
            this.ctx.lineTo(x - bandW * 1.1, bandY + ch * 0.12);
            this.ctx.closePath();
            this.ctx.fill();
            // Base
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(x - cw * 1.1, y - 3, cw * 2.2, 4);
        }
    }

    /**
     * renderCoin — yellow circle with $ symbol, perspective-scaled.
     */
    renderCoin(x, y, scale) {
        if (scale <= 0) return;
        const r = Math.min(28, Math.max(4, scale * 0.06));
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(x, y - r * 1.5, r, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fill();
        this.ctx.strokeStyle = '#b8860b';
        this.ctx.lineWidth = Math.max(1, r * 0.15);
        this.ctx.stroke();
        if (r > 8) {
            this.ctx.fillStyle = '#b8860b';
            this.ctx.font = `bold ${Math.floor(r)}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('$', x, y - r * 1.5);
        }
        this.ctx.restore();
    }

    /**
     * renderGate — renders the 2-track choice gate gantry, road chevrons, and overhead signboards in pseudo-3D.
     */
    renderGate(segment) {
        const gate = segment.gate;
        if (!gate) return;
        const p1 = segment.p1;
        const cx = p1.screen.x;
        const cy = p1.screen.y;
        const scale = p1.screen.w;
        if (scale < 6) return;

        this.ctx.save();

        // 1. Road surface chevrons pointing down each track
        const arrowW = scale * 0.35;
        const arrowH = Math.max(3, scale * 0.15);
        const leftX = cx - scale * 0.5;
        const rightX = cx + scale * 0.5;

        // Left track chevron (cyan)
        this.ctx.fillStyle = 'rgba(25, 240, 255, 0.45)';
        this.ctx.beginPath();
        this.ctx.moveTo(leftX - arrowW / 2, cy);
        this.ctx.lineTo(leftX, cy - arrowH);
        this.ctx.lineTo(leftX + arrowW / 2, cy);
        this.ctx.lineTo(leftX + arrowW * 0.3, cy);
        this.ctx.lineTo(leftX, cy - arrowH * 0.5);
        this.ctx.lineTo(leftX - arrowW * 0.3, cy);
        this.ctx.closePath();
        this.ctx.fill();

        // Right track chevron (magenta)
        this.ctx.fillStyle = 'rgba(255, 46, 138, 0.45)';
        this.ctx.beginPath();
        this.ctx.moveTo(rightX - arrowW / 2, cy);
        this.ctx.lineTo(rightX, cy - arrowH);
        this.ctx.lineTo(rightX + arrowW / 2, cy);
        this.ctx.lineTo(rightX + arrowW * 0.3, cy);
        this.ctx.lineTo(rightX, cy - arrowH * 0.5);
        this.ctx.lineTo(rightX - arrowW * 0.3, cy);
        this.ctx.closePath();
        this.ctx.fill();

        // 2. Overhead Gantry Arch Support Pillars and Truss
        const pillarL = cx - scale * 1.05;
        const pillarR = cx + scale * 1.05;
        const archTopY = cy - scale * 1.15;
        const beamThick = Math.max(3, scale * 0.08);

        // Left vertical pillar
        this.ctx.fillStyle = '#101628';
        this.ctx.strokeStyle = '#19f0ff';
        this.ctx.lineWidth = Math.max(1, scale * 0.02);
        this.ctx.fillRect(pillarL - beamThick / 2, archTopY, beamThick, cy - archTopY);
        this.ctx.strokeRect(pillarL - beamThick / 2, archTopY, beamThick, cy - archTopY);

        // Right vertical pillar
        this.ctx.strokeStyle = '#ff2e8a';
        this.ctx.fillRect(pillarR - beamThick / 2, archTopY, beamThick, cy - archTopY);
        this.ctx.strokeRect(pillarR - beamThick / 2, archTopY, beamThick, cy - archTopY);

        // Horizontal truss cross-beam
        this.ctx.fillStyle = '#0f1422';
        this.ctx.fillRect(pillarL, archTopY, pillarR - pillarL, beamThick);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(pillarL, archTopY, pillarR - pillarL, beamThick);

        // 3. Two Large Overhead Signboards hanging over Left & Right tracks
        const boardW = scale * 0.88;
        const boardH = scale * 0.46;
        const boardY = archTopY + beamThick;

        // Left Track Signboard (Cyan)
        this.ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
        this.ctx.strokeStyle = '#19f0ff';
        this.ctx.lineWidth = Math.max(2, scale * 0.035);
        this.ctx.fillRect(leftX - boardW / 2, boardY, boardW, boardH);
        this.ctx.strokeRect(leftX - boardW / 2, boardY, boardW, boardH);

        const fontScale = Math.max(4, scale * 0.09);
        this.ctx.fillStyle = '#19f0ff';
        this.ctx.font = `bold ${Math.round(fontScale * 0.85)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('◄ LEFT TRACK', leftX, boardY + boardH * 0.28);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.round(fontScale)}px sans-serif`;
        this._renderFittedText(gate.leftText, leftX, boardY + boardH * 0.68, boardW * 0.9, fontScale);

        // Right Track Signboard (Magenta)
        this.ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
        this.ctx.strokeStyle = '#ff2e8a';
        this.ctx.lineWidth = Math.max(2, scale * 0.035);
        this.ctx.fillRect(rightX - boardW / 2, boardY, boardW, boardH);
        this.ctx.strokeRect(rightX - boardW / 2, boardY, boardW, boardH);

        this.ctx.fillStyle = '#ff2e8a';
        this.ctx.font = `bold ${Math.round(fontScale * 0.85)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('RIGHT TRACK ►', rightX, boardY + boardH * 0.28);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.round(fontScale)}px sans-serif`;
        this._renderFittedText(gate.rightText, rightX, boardY + boardH * 0.68, boardW * 0.9, fontScale);

        this.ctx.restore();
    }

    _renderFittedText(text, cx, cy, maxW, baseFontPx) {
        if (!text) return;
        let str = String(text).trim();
        if (str.length > 24) {
            str = str.substring(0, 22) + '…';
        }
        let currentSize = Math.max(3, baseFontPx);
        this.ctx.font = `bold ${Math.round(currentSize)}px sans-serif`;
        let m = this.ctx.measureText(str).width;
        if (m > maxW && maxW > 5) {
            currentSize = Math.max(3, currentSize * (maxW / m));
            this.ctx.font = `bold ${Math.round(currentSize)}px sans-serif`;
        }
        this.ctx.fillText(str, cx, cy);
    }

    renderCar(x, y, scale, car) {
        if (scale <= 0) return;
        const w = scale * 0.5, h = scale * 0.4;
        this.ctx.fillStyle = car.type === 'truck' ? '#334455' : '#882222';
        this.ctx.fillRect(x - w / 2, y - h, w, h);
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(x - w / 2 - w * 0.1, y - h * 0.3, w * 0.2, h * 0.3);
        this.ctx.fillRect(x + w / 2 - w * 0.1, y - h * 0.3, w * 0.2, h * 0.3);
        this.ctx.fillStyle = '#ff0000';
        this.ctx.shadowBlur = 10; this.ctx.shadowColor = '#ff0000';
        this.ctx.fillRect(x - w * 0.4, y - h * 0.6, w * 0.15, h * 0.15);
        this.ctx.fillRect(x + w * 0.25, y - h * 0.6, w * 0.15, h * 0.15);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#221111';
        this.ctx.fillRect(x - w * 0.4, y - h * 0.9, w * 0.8, h * 0.3);
    }

    renderPlayerCar(cx, cy, carW, carH) {
        const ctx = this.ctx;
        const speedRatio = this.speed / CONFIG.MAX_SPEED;
        const cmd = this.input ? this.input.getCommand() : { steer: 0, accel: 0, brake: 0 };
        const steerLean = -(this.lastSteer || 0);
        const roll = steerLean * 0.055; // Chassis roll banking into turn

        // Pitch squat during acceleration and braking
        const squatY = (cmd.accel > 0 ? 3 : 0) - (cmd.brake > 0 ? 4 : 0);

        ctx.save();
        ctx.translate(cx, cy + squatY);
        ctx.rotate(roll);

        // Safe roundRect helper
        const roundRectPath = (x, y, w, h, r) => {
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, r);
            } else {
                ctx.beginPath();
                ctx.rect(x, y, w, h);
            }
        };

        // ==========================================
        // 1. NEON UNDERGLOW & ROAD CONTACT SHADOW
        // ==========================================
        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.beginPath();
        ctx.ellipse(0, 4, carW * 0.52, carH * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vibrant cyan & magenta underglow reflection on the dark asphalt
        const underglow = ctx.createRadialGradient(0, 0, carW * 0.08, 0, 0, carW * 0.56);
        underglow.addColorStop(0, 'rgba(25, 240, 255, 0.42)');
        underglow.addColorStop(0.5, 'rgba(224, 64, 251, 0.25)');
        underglow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = underglow;
        ctx.beginPath();
        ctx.ellipse(0, 2, carW * 0.62, carH * 0.30, 0, 0, Math.PI * 2);
        ctx.fill();

        // ==========================================
        // 2. WIDE REAR WHEELS & ILLUMINATED RIMS
        // ==========================================
        const wheelW = carW * 0.16;
        const wheelH = carH * 0.48;
        const wheelY = -wheelH * 0.65;
        const wheelXLeft = -carW * 0.46;
        const wheelXRight = carW * 0.46 - wheelW;

        const drawWheel = (wx, isLeft) => {
            ctx.save();
            ctx.translate(wx + wheelW / 2, wheelY + wheelH / 2);
            // Slight camber
            ctx.rotate(isLeft ? 0.04 : -0.04);

            // Tire rubber
            ctx.fillStyle = '#0a0c10';
            ctx.strokeStyle = '#181c26';
            ctx.lineWidth = 2;
            roundRectPath(-wheelW / 2, -wheelH / 2, wheelW, wheelH, 4);
            ctx.fill();
            ctx.stroke();

            // Tread grooves
            ctx.strokeStyle = '#050608';
            ctx.lineWidth = 1.5;
            for (let i = -wheelH * 0.35; i <= wheelH * 0.35; i += wheelH * 0.22) {
                ctx.beginPath();
                ctx.moveTo(-wheelW * 0.45, i);
                ctx.lineTo(wheelW * 0.45, i);
                ctx.stroke();
            }

            // Glowing illuminated neon rim / inner ring
            ctx.shadowBlur = 10;
            ctx.shadowColor = THEME.cyan;
            ctx.strokeStyle = THEME.cyan;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 0, wheelW * 0.32, wheelH * 0.38, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Center neon hub
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, wheelW * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };

        drawWheel(wheelXLeft, true);
        drawWheel(wheelXRight, false);

        // ==========================================
        // 3. CARBON FIBER REAR DIFFUSER & LOWER STANCE
        // ==========================================
        const diffW = carW * 0.68;
        const diffH = carH * 0.28;
        const diffY = -diffH;

        ctx.fillStyle = '#0a0d14';
        ctx.beginPath();
        ctx.moveTo(-diffW / 2, diffY + diffH * 0.3);
        ctx.lineTo(-diffW * 0.45, 0);
        ctx.lineTo(diffW * 0.45, 0);
        ctx.lineTo(diffW / 2, diffY + diffH * 0.3);
        ctx.closePath();
        ctx.fill();

        // 4 Vertical aerodynamic diffuser strakes / fins
        ctx.lineWidth = 2;
        const strakeSpacing = diffW * 0.22;
        for (let s = -1.5; s <= 1.5; s += 1.0) {
            const sx = s * strakeSpacing;
            ctx.strokeStyle = '#181d2a';
            ctx.beginPath();
            ctx.moveTo(sx, diffY + diffH * 0.2);
            ctx.lineTo(sx, 0);
            ctx.stroke();

            // Neon pink tip on diffuser fins
            ctx.save();
            ctx.strokeStyle = THEME.pink;
            ctx.shadowBlur = 6;
            ctx.shadowColor = THEME.pink;
            ctx.beginPath();
            ctx.moveTo(sx - 2, 0);
            ctx.lineTo(sx + 2, 0);
            ctx.stroke();
            ctx.restore();
        }

        // Center F1-style rain / collision warning light
        ctx.save();
        ctx.fillStyle = (Date.now() % 400 < 200 || cmd.brake > 0) ? '#ff003c' : '#330510';
        ctx.shadowBlur = (cmd.brake > 0) ? 14 : 6;
        ctx.shadowColor = '#ff003c';
        ctx.beginPath();
        ctx.moveTo(0, -diffH * 0.85);
        ctx.lineTo(-carW * 0.035, -diffH * 0.25);
        ctx.lineTo(carW * 0.035, -diffH * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // ==========================================
        // 4. TWIN PLASMA EXHAUST THRUSTERS
        // ==========================================
        const exW = carW * 0.10;
        const exH = carH * 0.16;
        const exY = -diffH - exH * 0.4;
        const exLeftX = -carW * 0.25;
        const exRightX = carW * 0.25;

        const drawExhaust = (exCenter) => {
            // Hexagonal housing
            ctx.fillStyle = '#10141f';
            ctx.strokeStyle = '#252e42';
            ctx.lineWidth = 2;
            roundRectPath(exCenter - exW / 2, exY - exH / 2, exW, exH, 3);
            ctx.fill();
            ctx.stroke();

            // Inner glowing heat core
            const heatGrad = ctx.createRadialGradient(exCenter, exY, 1, exCenter, exY, exW * 0.5);
            heatGrad.addColorStop(0, '#ffffff');
            heatGrad.addColorStop(0.4, THEME.cyan);
            heatGrad.addColorStop(0.85, THEME.magenta);
            heatGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
            ctx.fillStyle = heatGrad;
            roundRectPath(exCenter - exW * 0.38, exY - exH * 0.35, exW * 0.76, exH * 0.70, 2);
            ctx.fill();

            // Dynamic plasma flame under acceleration or high speed
            if (cmd.accel > 0 || speedRatio > 0.4) {
                const flameLen = (carH * 0.35) * (0.5 + 0.5 * speedRatio) * (0.8 + Math.random() * 0.4);
                ctx.save();
                ctx.shadowBlur = 18;
                ctx.shadowColor = THEME.cyan;
                const flameGrad = ctx.createLinearGradient(exCenter, exY, exCenter, exY + flameLen);
                flameGrad.addColorStop(0, '#ffffff');
                flameGrad.addColorStop(0.3, THEME.cyan);
                flameGrad.addColorStop(0.7, THEME.pink);
                flameGrad.addColorStop(1, 'rgba(255, 46, 138, 0)');
                ctx.fillStyle = flameGrad;
                ctx.beginPath();
                ctx.moveTo(exCenter - exW * 0.32, exY);
                ctx.lineTo(exCenter + exW * 0.32, exY);
                ctx.lineTo(exCenter, exY + flameLen);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        };

        drawExhaust(exLeftX);
        drawExhaust(exRightX);

        // ==========================================
        // 5. MAIN AERODYNAMIC BODYWORK
        // ==========================================
        const bodyTopY = -carH * 0.65;
        const bodyBotY = -diffH * 0.6;
        const bodyW = carW * 0.88;

        const bodyGrad = ctx.createLinearGradient(0, bodyTopY, 0, bodyBotY);
        bodyGrad.addColorStop(0, '#1c2233');
        bodyGrad.addColorStop(0.5, '#121623');
        bodyGrad.addColorStop(1, '#0a0c14');
        ctx.fillStyle = bodyGrad;

        ctx.beginPath();
        ctx.moveTo(-bodyW / 2, bodyBotY);
        ctx.lineTo(-bodyW / 2, -carH * 0.45);
        ctx.quadraticCurveTo(-bodyW * 0.48, bodyTopY + carH * 0.05, -bodyW * 0.36, bodyTopY);
        ctx.lineTo(bodyW * 0.36, bodyTopY);
        ctx.quadraticCurveTo(bodyW * 0.48, bodyTopY + carH * 0.05, bodyW / 2, -carH * 0.45);
        ctx.lineTo(bodyW / 2, bodyBotY);
        ctx.quadraticCurveTo(0, bodyBotY - carH * 0.05, -bodyW / 2, bodyBotY);
        ctx.closePath();
        ctx.fill();

        // Metallic bevel stroke around bodywork
        ctx.strokeStyle = '#2b344d';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing cyan accent lines tracing the sculpted aero contours
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = THEME.cyan;
        ctx.strokeStyle = THEME.cyan;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bodyW * 0.44, -carH * 0.42);
        ctx.lineTo(-bodyW * 0.34, bodyTopY + carH * 0.06);
        ctx.lineTo(-bodyW * 0.22, bodyTopY + carH * 0.06);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bodyW * 0.44, -carH * 0.42);
        ctx.lineTo(bodyW * 0.34, bodyTopY + carH * 0.06);
        ctx.lineTo(bodyW * 0.22, bodyTopY + carH * 0.06);
        ctx.stroke();
        ctx.restore();

        // Rear engine deck cooling vents / louvers
        ctx.fillStyle = '#0a0d16';
        ctx.strokeStyle = '#181d2a';
        ctx.lineWidth = 1;
        for (let v = 0; v < 3; v++) {
            const vy = bodyTopY + carH * (0.08 + v * 0.06);
            const vw = carW * (0.28 - v * 0.04);
            roundRectPath(-vw / 2, vy, vw, carH * 0.035, 2);
            ctx.fill();
            ctx.stroke();
        }

        // ==========================================
        // 6. COCKPIT CANOPY & GLASS REFLECTIONS
        // ==========================================
        const roofY = -carH * 0.94;
        const roofW = carW * 0.36;
        const canopyBaseW = carW * 0.52;
        const canopyBaseY = bodyTopY + carH * 0.04;

        // Dark tinted polarized glass
        const glassGrad = ctx.createLinearGradient(0, roofY, 0, canopyBaseY);
        glassGrad.addColorStop(0, '#060912');
        glassGrad.addColorStop(0.5, '#0b1222');
        glassGrad.addColorStop(1, '#05070d');
        ctx.fillStyle = glassGrad;

        ctx.beginPath();
        ctx.moveTo(-canopyBaseW / 2, canopyBaseY);
        ctx.quadraticCurveTo(-roofW * 0.65, roofY + carH * 0.25, -roofW / 2, roofY);
        ctx.lineTo(roofW / 2, roofY);
        ctx.quadraticCurveTo(roofW * 0.65, roofY + carH * 0.25, canopyBaseW / 2, canopyBaseY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#1f2639';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Cyan / magenta skyline reflection on the rear glass
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-canopyBaseW * 0.4, canopyBaseY - carH * 0.02);
        ctx.lineTo(-roofW * 0.35, roofY + carH * 0.06);
        ctx.lineTo(roofW * 0.15, roofY + carH * 0.06);
        ctx.lineTo(-canopyBaseW * 0.05, canopyBaseY - carH * 0.02);
        ctx.closePath();
        const reflGrad = ctx.createLinearGradient(0, roofY, 0, canopyBaseY);
        reflGrad.addColorStop(0, 'rgba(25, 240, 255, 0.22)');
        reflGrad.addColorStop(1, 'rgba(224, 64, 251, 0.04)');
        ctx.fillStyle = reflGrad;
        ctx.fill();
        ctx.restore();

        // Interior HUD glow / digital speedometer visible inside the cockpit
        const kmh = Math.floor(this.speed / 100);
        ctx.save();
        ctx.fillStyle = this.speed > CONFIG.MAX_SPEED * 0.88 ? THEME.danger : THEME.cyan;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.font = `bold ${Math.round(carH * 0.15)}px 'Orbitron', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(kmh, 0, (roofY + canopyBaseY) / 2);
        ctx.restore();

        // ==========================================
        // 7. CYBERPUNK LED TAILLIGHT CLUSTER (FULL-WIDTH)
        // ==========================================
        const tlY = -carH * 0.46;
        const tlW = carW * 0.76;
        const tlH = Math.max(4, carH * 0.075);
        const isBraking = cmd.brake > 0;

        ctx.save();
        ctx.shadowBlur = isBraking ? 26 : 14;
        ctx.shadowColor = isBraking ? '#ff003c' : THEME.pink;

        // Dark light housing strip
        ctx.fillStyle = '#080a10';
        roundRectPath(-tlW / 2, tlY - tlH / 2, tlW, tlH, 3);
        ctx.fill();

        // Full-width continuous geometric LED light bar
        const lightGrad = ctx.createLinearGradient(-tlW / 2, 0, tlW / 2, 0);
        if (isBraking) {
            lightGrad.addColorStop(0, '#ff1a53');
            lightGrad.addColorStop(0.5, '#ffffff');
            lightGrad.addColorStop(1, '#ff1a53');
        } else {
            lightGrad.addColorStop(0, THEME.pink);
            lightGrad.addColorStop(0.2, '#ff1a53');
            lightGrad.addColorStop(0.5, THEME.cyan);
            lightGrad.addColorStop(0.8, '#ff1a53');
            lightGrad.addColorStop(1, THEME.pink);
        }
        ctx.fillStyle = lightGrad;
        roundRectPath(-tlW * 0.48, tlY - tlH * 0.38, tlW * 0.96, tlH * 0.76, 2);
        ctx.fill();

        // High-intensity sharp LED segments
        const segW = tlW * 0.06;
        for (let i = -tlW * 0.44; i <= tlW * 0.44; i += segW * 1.5) {
            ctx.fillStyle = isBraking ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(i, tlY - tlH * 0.28, segW * 0.65, tlH * 0.56);
        }

        // Center illuminated cyber badge / model emblem ("RIDER")
        ctx.shadowBlur = 8;
        ctx.shadowColor = THEME.cyan;
        ctx.fillStyle = THEME.cyan;
        ctx.font = `bold ${Math.round(carH * 0.09)}px 'Orbitron', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RIDER', 0, tlY + tlH * 1.4);
        ctx.restore();

        // ==========================================
        // 8. ACTIVE AERO CARBON-FIBER REAR SPOILER
        // ==========================================
        const wingY = -carH * 0.72;
        const wingW = carW * 0.84;
        const wingH = carH * 0.08;

        // Dual mounting stanchions
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(-carW * 0.22, wingY, carW * 0.04, bodyTopY - wingY);
        ctx.fillRect(carW * 0.18, wingY, carW * 0.04, bodyTopY - wingY);

        // Main wing blade
        ctx.fillStyle = '#141824';
        ctx.strokeStyle = '#232b3f';
        ctx.lineWidth = 1.5;
        roundRectPath(-wingW / 2, wingY - wingH / 2, wingW, wingH, 3);
        ctx.fill();
        ctx.stroke();

        // Wing endplates (left & right vertical fins)
        const epW = carW * 0.035;
        const epH = carH * 0.22;
        ctx.fillStyle = '#0d101a';
        roundRectPath(-wingW / 2 - epW / 2, wingY - epH / 2, epW, epH, 2);
        ctx.fill();
        roundRectPath(wingW / 2 - epW / 2, wingY - epH / 2, epW, epH, 2);
        ctx.fill();

        // Neon edge accent on top of rear wing
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = THEME.cyan;
        ctx.strokeStyle = THEME.cyan;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-wingW / 2, wingY - wingH / 2);
        ctx.lineTo(wingW / 2, wingY - wingH / 2);
        ctx.stroke();

        // Magenta accents on endplate edges
        ctx.shadowColor = THEME.pink;
        ctx.strokeStyle = THEME.pink;
        ctx.beginPath();
        ctx.moveTo(-wingW / 2 - epW / 2, wingY - epH / 2);
        ctx.lineTo(-wingW / 2 - epW / 2, wingY + epH / 2);
        ctx.moveTo(wingW / 2 + epW / 2, wingY - epH / 2);
        ctx.lineTo(wingW / 2 + epW / 2, wingY + epH / 2);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    /**
     * The one and only RAF callback. dt clamped to 0.05 s.
     */
    step(now) {
        requestAnimationFrame(this.step);
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        // Tiny FPS counter (log once per second, behind CONFIG.DEBUG_FPS flag)
        this.fpsFrames = (this.fpsFrames || 0) + 1;
        if (!this.lastFpsLog) this.lastFpsLog = now;
        if (now - this.lastFpsLog >= 1000) {
            this.fps = Math.round((this.fpsFrames * 1000) / (now - this.lastFpsLog));
            if (CONFIG.DEBUG_FPS) {
                console.log(`[FPS] ${this.fps}`);
            }
            this.fpsFrames = 0;
            this.lastFpsLog = now;
        }

        this.update(dt);
        this.render();

        // In frozen states (QUIZ/FEEDBACK/COUNTDOWN) we still render the road
        // but the sim doesn't advance (handled by update returning early).
    }
}

/**
 * ------------------------------------------------------------------
 * BOOTSTRAP
 * ------------------------------------------------------------------
 */
window.onload = () => {
    const startBtn = document.getElementById('start-btn');
    const quickStartBtn = document.getElementById('quick-start-btn');
    const loadingMsg = document.getElementById('loading-msg');
    const overlay = document.getElementById('overlay-screen');
    const nameInput = document.getElementById('player-name');
    const game = new Game();

    // --- Multi-select subject picker ---
    // selectedSubjects: always an array of 1-4 subjects, default ["python"]
    let selectedSubjects = ['python'];

    const subjectBtns = document.querySelectorAll('.subject-btn');

    function syncSubjectToggleUI() {
        subjectBtns.forEach(btn => {
            const subj = btn.getAttribute('data-subject');
            const on = selectedSubjects.includes(subj);
            if (on) {
                btn.classList.add('selected');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('selected');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    subjectBtns.forEach(btn => {
        // Keyboard: Space / Enter toggles the button (accessibility)
        btn.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });

        btn.addEventListener('click', () => {
            const subj = btn.getAttribute('data-subject');
            if (!subj) return;
            const alreadyOn = selectedSubjects.includes(subj);
            if (alreadyOn) {
                // Last one cannot be switched off
                if (selectedSubjects.length === 1) return;
                selectedSubjects = selectedSubjects.filter(s => s !== subj);
            } else {
                if (selectedSubjects.length >= 4) return;
                selectedSubjects = [...selectedSubjects, subj];
            }
            syncSubjectToggleUI();
        });
    });

    const getPlayerName = () => {
        const raw = (nameInput && nameInput.value) ? nameInput.value.trim() : '';
        if (!raw) return 'Rider';
        return raw.slice(0, 12);
    };

    const startGame = (name, subjects) => {
        if (game.gameState !== STATE.MENU) return;
        overlay.classList.add('hidden');
        game.start(name, subjects);
    };

    // Enable/disable both start buttons together
    const setBtnsEnabled = (enabled) => {
        startBtn.disabled = !enabled;
        if (quickStartBtn) quickStartBtn.disabled = !enabled;
    };

    (async () => {
        setBtnsEnabled(false);
        startBtn.textContent = 'Loading Camera...';
        loadingMsg.textContent = 'Initializing hand tracking...';
        try {
            await game.input.startCamera();
            setBtnsEnabled(true);
            startBtn.textContent = 'START ENGINE';
            loadingMsg.textContent = 'Camera ready — click START ENGINE or press W to go';
        } catch (e) {
            console.error(e);
            setBtnsEnabled(true);
            startBtn.textContent = 'START (Keyboard Mode)';
            loadingMsg.textContent = 'Camera unavailable — keyboard controls only';
        }
    })();

    startBtn.addEventListener('click', () => {
        safeSfx('init');
        startGame(getPlayerName(), selectedSubjects);
    });
    if (quickStartBtn) {
        quickStartBtn.addEventListener('click', () => {
            safeSfx('init');
            // Quick Start always uses ["python"] and the typed/default name
            selectedSubjects = ['python'];
            syncSubjectToggleUI();
            startGame(getPlayerName(), ['python']);
        });
    }
};
