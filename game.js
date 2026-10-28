/**
 * ------------------------------------------------------------------
 * CONFIGURATION & CONSTANTS
 * ------------------------------------------------------------------
 */
const SEED = 42; // Fixed seed – every run sees the same road/traffic/sprites.

const CONFIG = {
    FPS: 60,
    FOV: 100,
    CAMERA_HEIGHT: 1000,
    CAMERA_DEPTH: 0.84,
    SEGMENT_LENGTH: 200,
    DRAW_DISTANCE: 300,
    LANES: 3,
    ROAD_WIDTH: 2000,
    MAX_SPEED: 12000,
    ACCEL: 100,
    BRAKING: -300,
    DECEL: -50,
    OFF_ROAD_DECEL: -200,
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
    RACE_DISTANCE: 1200000,
    FINISH_BONUS: 50,

    // Quiz / checkpoints (Phase 3)
    CHECKPOINT_THRESHOLDS: [0.20, 0.40, 0.60, 0.80],
    QUIZ_CORRECT_SCORE: 100,
    QUIZ_WRONG_PENALTY: 20,
    QUIZ_LOCKOUT_MS: 600,       // ignore answer keys for first 600 ms
    QUIZ_FEEDBACK_AUTO_MS: 6000, // auto-dismiss feedback after 6 s
    COUNTDOWN_SECONDS: 3,
    GRACE_DURATION: 1.0,         // 1 s grace after countdown (no hit checks)

    COLORS: {
        SKY_TOP: '#000022',
        SKY_BOTTOM: '#003366',
        ROAD_LIGHT: '#444444',
        ROAD_DARK: '#3e3e3e',
        GRASS_LIGHT: '#104010',
        GRASS_DARK: '#0b300b',
        LANE_MARKER: '#ffffff',
        RUMBLE: '#550000',
        FOG: '#001525',
        TREE_TRUNK: '#443322',
        TREE_LEAVES: '#004400'
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
 * AUDIO ENGINE (Synthesized) — unchanged from baseline
 * ------------------------------------------------------------------
 */
class AudioController {
    constructor() {
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.windNode = null;
        this.windGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 100;

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 400;

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;

        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();

        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        this.windNode = this.ctx.createBufferSource();
        this.windNode.buffer = noiseBuffer;
        this.windNode.loop = true;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'highpass';
        windFilter.frequency.value = 800;

        this.windNode.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);
        this.windNode.start();

        this.initialized = true;
    }

    update(speedRatio) {
        if (!this.initialized) return;
        const r = Math.max(0, Math.min(1, speedRatio));
        const targetFreq = 80 + (r * 220);
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        this.engineFilter.frequency.setTargetAtTime(400 + (r * 1000), this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(0.1 + r * 0.2, this.ctx.currentTime, 0.1);
        this.windGain.gain.setTargetAtTime(r > 0.5 ? (r - 0.5) * 2 * 0.3 : 0, this.ctx.currentTime, 0.1);
    }

    playCrash() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 1);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(t);
        noise.stop(t + 2);

        this.engineGain.gain.cancelScheduledValues(t);
        this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
        this.engineGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        this.windGain.gain.cancelScheduledValues(t);
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, t);
        this.windGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
}

/**
 * ------------------------------------------------------------------
 * INPUT HANDLING
 * ------------------------------------------------------------------
 */
class InputSystem {
    constructor() {
        this.keys = {};
        this.gesture = { tilt: 0, throttle: 0, brake: 0, active: false };

        this.keyboardSteer = 0;
        this.steerSpeed = 0.25;
        this.steerReturn = 0.2;

        this.lastHandTime = 0;
        this.TRACKING_TIMEOUT = 300;

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

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
        this.ctxPreview.drawImage(results.image, 0, 0, this.canvasPreview.width, this.canvasPreview.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            drawConnectors(this.ctxPreview, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(this.ctxPreview, landmarks, { color: '#FF0000', lineWidth: 1 });
            this.processGesture(landmarks);
            this.gesture.active = true;
            this.lastHandTime = Date.now();
            const s = document.getElementById('g-status');
            if (s) { s.textContent = 'Tracking'; s.style.color = '#00ff88'; }
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
        if (s) { s.textContent = 'No Hand'; s.style.color = '#ff0055'; }
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
        this.gesture.tilt = Math.max(-1, Math.min(1, (angle - neutralAngle) / 0.8));
        if (Math.abs(this.gesture.tilt) < 0.1) this.gesture.tilt = 0;

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

        this.input = new InputSystem();
        this.audio = new AudioController();
        this.particles = new ParticleSystem(this.ctx, this.width, this.height);

        this.gameState = STATE.MENU;
        this.loopRunning = false;

        // Race state
        this.position = 0;
        this.playerX = 0;
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
        this.subject = 'python';
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

        this.mountainPoints = [];
        this.highScore = parseInt(localStorage.getItem('gestureRiderHighScore')) || 0;
        this.rng = makeLCG(SEED);

        this.resetRoad();
        this._buildMountains();

        this.trackingLostEl = document.getElementById('tracking-lost-msg');

        this.step = this.step.bind(this);
        this.lastTime = 0;

        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        window.addEventListener('resize', () => this._onResize());

        // --- Quiz keydown handler ---
        this._onQuizKey = this._onQuizKey.bind(this);
        window.addEventListener('keydown', this._onQuizKey);
    }

    _buildMountains() {
        this.mountainPoints = [];
        const rng = makeLCG(SEED + 1);
        for (let i = 0; i <= this.width; i += 50) {
            this.mountainPoints.push({ x: i, y: (this.height / 2) - 50 + rng() * 50 });
        }
        this.mountainPoints.push({ x: this.width, y: this.height / 2 + 50 });
    }

    _onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.particles.resize(this.width, this.height);
        this._buildMountains();
    }

    /**
     * Reset road using fixed seeded RNG.
     * Phase 2 additions: crash-object sprites, coin lines.
     */
    resetRoad() {
        this.segments = [];
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
                coins: []
            });

            // Traffic cars
            if (i > 20 && i % 40 === 0 && this.rng() > 0.3) {
                const lanes = [-0.65, 0, 0.65];
                this.addCar(i, lanes[Math.floor(this.rng() * lanes.length)], Utils.randomIntRng(this.rng, 3000, 8000));
            }

            // Roadside trees
            if (i % 20 === 0 && this.rng() > 0.2) {
                const side = this.rng() > 0.5 ? 1 : -1;
                this.addSprite(i, side * (1.5 + this.rng()), 'tree');
            }

            // Crash barriers / cones — one every ~60 segments, never in first 30
            if (i > 30 && i % 60 === 0 && this.rng() > 0.4) {
                // Place in one of the three lanes (not perfectly centred — slight offset)
                const lanes = [-0.65, 0, 0.65];
                const lane = lanes[Math.floor(this.rng() * lanes.length)];
                const type = this.rng() > 0.5 ? 'barrier' : 'cone';
                this.addSprite(i, lane, type);
            }

        }

        // --- Second pass: coin placement (all segments now exist) ---
        // Runs of 3-5 coins in a lane, seeded RNG continues from where it left off.
        for (let i = 10; i < TOTAL_SEGMENTS; i++) {
            if (i % 30 === 0 && this.rng() > 0.5) {
                const lanes = [-0.65, 0, 0.65];
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
    }

    addCar(segmentIndex, offset, speed) {
        if (segmentIndex < 0 || segmentIndex >= this.segments.length) return;
        this.segments[segmentIndex].cars.push({
            offset,
            z: segmentIndex * CONFIG.SEGMENT_LENGTH,
            speed,
            type: this.rng() > 0.5 ? 'car' : 'truck',
            hit: false,
            canHit: false
        });
    }

    addSprite(segmentIndex, offset, type) {
        if (segmentIndex < 0 || segmentIndex >= this.segments.length) return;
        this.segments[segmentIndex].sprites.push({
            offset,
            type,
            hit: false
        });
    }

    start(name, subject) {
        this.playerName = name || 'Rider';
        this.subject = subject || 'python';
        this.quizRun = Quiz.startRun(this.subject);
        this.checkpointIndex = 0;
        this.graceTime = 0;
        this.audio.init();
        this.gameState = STATE.RACING;
        this.lastTime = performance.now();
        if (!this.loopRunning) {
            this.loopRunning = true;
            requestAnimationFrame(this.step);
        }
    }

    restart() {
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('countdown-screen').classList.add('hidden');
        this.resetRoad();
        this.speed = 0;
        this.score = 0;
        this.distanceRun = 0;
        this.position = 0;
        this.playerX = 0;
        this.lives = CONFIG.START_LIVES;
        this.coinsCollected = 0;
        this.hitFlashUntil = 0;
        // Quiz reset
        this.checkpointIndex = 0;
        this.graceTime = 0;
        this.currentQuestion = null;
        this.quizAnswerLocked = false;
        this.quizChosenIndex = -1;
        this.feedbackStartTime = 0;
        this.countdownStartTime = 0;
        this.countdownNum = 3;
        this.quizRun = Quiz.startRun(this.subject);
        const cpEl = document.getElementById('checkpointVal');
        if (cpEl) cpEl.textContent = 'Q 0/4';
        this.lastTime = performance.now();
        this.audio.resume();
        this.audio.update(0);
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
        this.audio.playCrash();
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

        if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('gestureRiderHighScore', this.highScore);
        }

        document.getElementById('game-over-title').textContent = title;
        document.getElementById('final-score').textContent = Math.floor(this.score);
        document.getElementById('best-score').textContent = this.highScore;

        // Results stats (PLAN §7)
        const statCoins = document.getElementById('stat-coins');
        if (statCoins) statCoins.textContent = this.coinsCollected;
        const quizStats = this.quizRun ? this.quizRun.stats() : { answered: 0, accuracyPct: 0 };
        const statAnswered = document.getElementById('stat-answered');
        if (statAnswered) statAnswered.textContent = `${quizStats.answered} / 4`;
        const statAccuracy = document.getElementById('stat-accuracy');
        if (statAccuracy) statAccuracy.textContent = `${quizStats.accuracyPct}%`;

        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    /**
     * wasted — transition to WASTED state.
     */
    wasted() {
        this.endRun('WASTED', STATE.WASTED);
    }

    /**
     * getRaceProgress — returns 0..1 progress toward the finish line.
     */
    getRaceProgress() {
        return Math.max(0, Math.min(1, this.distanceRun / CONFIG.RACE_DISTANCE));
    }

    update(dt) {
        // --- QUIZ state: drive timer from performance.now() ---
        if (this.gameState === STATE.QUIZ) {
            this.audio.update(0);
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
                    this._startFeedback('TIME UP');
                }
            }
            return;
        }

        // --- FEEDBACK state: auto-dismiss after 6 s ---
        if (this.gameState === STATE.FEEDBACK) {
            this.audio.update(0);
            if (this.trackingLostEl) this.trackingLostEl.style.display = 'none';
            if (performance.now() - this.feedbackStartTime >= CONFIG.QUIZ_FEEDBACK_AUTO_MS) {
                this._startCountdown();
            }
            return;
        }

        // --- COUNTDOWN state: 3-2-1 ---
        if (this.gameState === STATE.COUNTDOWN) {
            this.audio.update(0);
            if (this.trackingLostEl) this.trackingLostEl.style.display = 'none';
            const elapsed = (performance.now() - this.countdownStartTime) / 1000;
            const num = CONFIG.COUNTDOWN_SECONDS - Math.floor(elapsed);
            if (num !== this.countdownNum && num >= 1) {
                this.countdownNum = num;
                const cdEl = document.getElementById('countdown-num');
                if (cdEl) cdEl.textContent = num;
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
        const ratio = this.speed / CONFIG.MAX_SPEED;
        this.audio.update(ratio);

        if (cmd.accel > 0) this.speed += CONFIG.ACCEL * cmd.accel * dt * 60;
        else if (cmd.brake > 0) this.speed += CONFIG.BRAKING * dt * 60;
        else this.speed += CONFIG.DECEL * dt * 60;

        this.speed = Math.max(0, Math.min(this.speed, CONFIG.MAX_SPEED));

        const dx = dt * 2 * cmd.steer * (this.speed / CONFIG.MAX_SPEED);
        this.playerX -= dx;

        const playerSegment = this.findSegment(this.position + CONFIG.CAMERA_DEPTH * CONFIG.SEGMENT_LENGTH);
        this.playerX -= dx * playerSegment.curve * ratio * 0.1;

        if ((this.playerX < -1 || this.playerX > 1) && this.speed > 2000) this.speed += CONFIG.OFF_ROAD_DECEL * dt * 60;
        this.playerX = Math.max(-2, Math.min(2, this.playerX));

        // Decrement grace time
        if (this.graceTime > 0) this.graceTime = Math.max(0, this.graceTime - dt);

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

            // Finish line — triggers once (state change prevents re-entry)
            if (this.gameState === STATE.RACING && this.distanceRun >= CONFIG.RACE_DISTANCE) {
                this.addScore(CONFIG.FINISH_BONUS);
                this._showScoreFloat(`+${CONFIG.FINISH_BONUS}`, true);
                this.endRun('FINISH!', STATE.FINISHED);
                break;
            }
        }

        // --- Checkpoint detection (after substeps, while still RACING) ---
        if (this.gameState === STATE.RACING && this.checkpointIndex < CONFIG.CHECKPOINT_THRESHOLDS.length) {
            const progress = this.getRaceProgress();
            if (progress >= CONFIG.CHECKPOINT_THRESHOLDS[this.checkpointIndex]) {
                this.checkpointIndex++;
                const cpEl = document.getElementById('checkpointVal');
                if (cpEl) cpEl.textContent = `Q ${this.checkpointIndex}/4`;
                this._showQuiz();
            }
        }

        this._updateHUD();
    }

    // ----------------------------------------------------------------
    // QUIZ FLOW METHODS
    // ----------------------------------------------------------------

    /**
     * _showQuiz — transition to QUIZ state, fill quiz card from quiz.js.
     */
    _showQuiz() {
        this.gameState = STATE.QUIZ;
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

        // Score
        if (correct) {
            this.addScore(CONFIG.QUIZ_CORRECT_SCORE);
            this._showScoreFloat(`+${CONFIG.QUIZ_CORRECT_SCORE}`, true);
        } else {
            this.addScore(-CONFIG.QUIZ_WRONG_PENALTY);
            this._showScoreFloat(`-${CONFIG.QUIZ_WRONG_PENALTY}`, false);
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

        // Grace period: 1 s of racing where hits are skipped
        this.graceTime = CONFIG.GRACE_DURATION;

        this.gameState = STATE.RACING;
    }

    /**
     * _onQuizKey — keydown handler for quiz answers and feedback dismiss.
     */
    _onQuizKey(e) {
        // Prevent Space/Enter from scrolling/triggering
        if (e.code === 'Space' || e.code === 'Enter') {
            if (this.gameState === STATE.QUIZ || this.gameState === STATE.FEEDBACK || this.gameState === STATE.COUNTDOWN) {
                e.preventDefault();
            }
        }

        // Answer keys in QUIZ state
        if (this.gameState === STATE.QUIZ && !this.quizAnswerLocked) {
            if (e.repeat) return;
            const map = { 'KeyA': 0, 'Digit1': 0, 'Numpad1': 0, 'KeyB': 1, 'Digit2': 1, 'Numpad2': 1, 'KeyC': 2, 'Digit3': 2, 'Numpad3': 2, 'KeyD': 3, 'Digit4': 3, 'Numpad4': 3 };
            if (e.code in map) {
                e.preventDefault();
                this._handleQuizAnswer(map[e.code]);
            }
            return;
        }

        // Dismiss feedback with Space/Enter
        if (this.gameState === STATE.FEEDBACK) {
            if (e.code === 'Space' || e.code === 'Enter') {
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
                // Trees are roadside — they don't block the road lanes; only barrier/cone do
                if (sprite.type === 'tree') continue;

                let dist = segment.p1.world.z - playerZ;
                if (dist < -trackLen / 2) dist += trackLen;
                if (dist > trackLen / 2) dist -= trackLen;

                // Clear hit flag when obstacle is still ahead (> 300 units) so the
                // near-player scan window (i = -1..+2) can actually see it re-armed.
                if (dist > 300) sprite.hit = false;

                if (sprite.hit) continue;

                if (Math.abs(dist) < 150) {
                    const objW = sprite.type === 'barrier' ? 0.5 : 0.2;
                    const playerW = 0.15;
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
                    const playerW = 0.2;
                    if (this.overlap(this.playerX, playerW, coin.offset, coinW)) {
                        coin.collected = true;
                        this.coinsCollected++;
                        this.addScore(CONFIG.COIN_SCORE);
                        this._showScoreFloat(`+${CONFIG.COIN_SCORE}`, true);
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

        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            for (let j = 0; j < segment.cars.length; j++) {
                const car = segment.cars[j];
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
                    const carW = 0.45, playerW = 0.15;
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

            Utils.project(segment.p1, (this.playerX * CONFIG.ROAD_WIDTH) - x, playerY + CONFIG.CAMERA_HEIGHT, this.position - loopOffset, CONFIG.CAMERA_DEPTH, this.width, this.height, CONFIG.ROAD_WIDTH);
            Utils.project(segment.p2, (this.playerX * CONFIG.ROAD_WIDTH) - x - dx, playerY + CONFIG.CAMERA_HEIGHT, this.position - loopOffset, CONFIG.CAMERA_DEPTH, this.width, this.height, CONFIG.ROAD_WIDTH);

            if (segment.p1.camera.z <= CONFIG.CAMERA_DEPTH || segment.p2.screen.y >= maxY || segment.p2.screen.y >= segment.p1.screen.y) continue;

            this.renderSegment(segment);
            maxY = segment.p1.screen.y;
            segment.clipY = maxY;
        }

        // Back-to-front: sprites, cars, coins
        for (let n = CONFIG.DRAW_DISTANCE - 1; n > 0; n--) {
            if (n < 3) continue;
            const segment = this.segments[(baseSegment.index + n) % this.segments.length];

            for (const car of segment.cars) {
                const scale = segment.p1.screen.w;
                if (scale > 5) this.renderCar(segment.p1.screen.x + scale * car.offset, segment.p1.screen.y, scale, car);
            }

            for (const sprite of segment.sprites) {
                const scale = segment.p1.screen.w;
                if (scale > 5) this.renderSprite(segment.p1.screen.x + scale * sprite.offset, segment.p1.screen.y, scale, sprite.type);
            }

            for (const coin of segment.coins) {
                if (coin.collected) continue;
                const scale = segment.p1.screen.w;
                if (scale > 5) this.renderCoin(segment.p1.screen.x + scale * coin.offset, segment.p1.screen.y, scale);
            }
        }

        this.particles.updateAndDraw(this.speed / CONFIG.MAX_SPEED);
        this.renderCockpit();

        // Red flash overlay on hit
        if (Date.now() < this.hitFlashUntil) {
            const alpha = (this.hitFlashUntil - Date.now()) / CONFIG.HIT_FLASH_MS * 0.45;
            this.ctx.fillStyle = `rgba(255,0,0,${alpha})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    renderBackground() {
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, CONFIG.COLORS.SKY_TOP);
        grad.addColorStop(1, CONFIG.COLORS.SKY_BOTTOM);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = 'rgba(255,200,100,0.2)';
        this.ctx.beginPath();
        this.ctx.arc(this.width * 0.8, this.height * 0.2, 80, 0, Math.PI * 2);
        this.ctx.fill();

        // Mountains — pre-generated points (no per-frame RNG → no flicker)
        this.ctx.fillStyle = '#051020';
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height / 2 + 50);
        for (const pt of this.mountainPoints) this.ctx.lineTo(pt.x, pt.y);
        this.ctx.lineTo(this.width, this.height / 2 + 50);
        this.ctx.fill();
    }

    renderSegment(segment) {
        const x1 = segment.p1.screen.x, y1 = segment.p1.screen.y, w1 = segment.p1.screen.w;
        const x2 = segment.p2.screen.x, y2 = segment.p2.screen.y, w2 = segment.p2.screen.w;

        this.ctx.fillStyle = (Math.floor(segment.index / 3) % 2) ? CONFIG.COLORS.GRASS_DARK : CONFIG.COLORS.GRASS_LIGHT;
        this.ctx.fillRect(0, y2, this.width, y1 - y2);

        this.ctx.fillStyle = segment.color;
        this.ctx.beginPath();
        this.ctx.moveTo(x1 - w1, y1); this.ctx.lineTo(x2 - w2, y2);
        this.ctx.lineTo(x2 + w2, y2); this.ctx.lineTo(x1 + w1, y1);
        this.ctx.fill();

        const r1 = w1 / Math.max(6, 2 * CONFIG.LANES);
        const r2 = w2 / Math.max(6, 2 * CONFIG.LANES);
        this.ctx.fillStyle = (Math.floor(segment.index / 2) % 2) ? '#fff' : CONFIG.COLORS.RUMBLE;
        this.ctx.beginPath(); this.ctx.moveTo(x1 - w1 - r1, y1); this.ctx.lineTo(x1 - w1, y1); this.ctx.lineTo(x2 - w2, y2); this.ctx.lineTo(x2 - w2 - r2, y2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.moveTo(x1 + w1 + r1, y1); this.ctx.lineTo(x1 + w1, y1); this.ctx.lineTo(x2 + w2, y2); this.ctx.lineTo(x2 + w2 + r2, y2); this.ctx.fill();

        if (Math.floor(segment.index / 2) % 2) {
            const l1 = w1 / 40, l2 = w2 / 40;
            this.ctx.fillStyle = CONFIG.COLORS.LANE_MARKER;
            let lx1 = x1 - w1 * 0.33, lx2 = x2 - w2 * 0.33;
            this.ctx.beginPath(); this.ctx.moveTo(lx1 - l1, y1); this.ctx.lineTo(lx1 + l1, y1); this.ctx.lineTo(lx2 + l2, y2); this.ctx.lineTo(lx2 - l2, y2); this.ctx.fill();
            lx1 = x1 + w1 * 0.33; lx2 = x2 + w2 * 0.33;
            this.ctx.beginPath(); this.ctx.moveTo(lx1 - l1, y1); this.ctx.lineTo(lx1 + l1, y1); this.ctx.lineTo(lx2 + l2, y2); this.ctx.lineTo(lx2 - l2, y2); this.ctx.fill();
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

    renderCockpit() {
        const cx = this.width / 2, cy = this.height;
        const shakeX = (Math.random() - 0.5) * (this.speed / CONFIG.MAX_SPEED) * 5;
        const shakeY = (Math.random() - 0.5) * (this.speed / CONFIG.MAX_SPEED) * 5;
        const lean = this.input.gesture.active
            ? this.input.gesture.tilt * 100
            : (this.input.keys['ArrowLeft'] ? -50 : (this.input.keys['ArrowRight'] ? 50 : 0));

        this.ctx.save();
        this.ctx.translate(cx + shakeX + lean, cy + shakeY);
        this.ctx.rotate(lean * 0.002);

        this.ctx.beginPath();
        this.ctx.fillStyle = 'rgba(0,50,50,0.2)';
        this.ctx.arc(0, 0, 400, Math.PI, 0);
        this.ctx.fill();

        this.ctx.fillStyle = '#111';
        this.ctx.beginPath(); this.ctx.arc(0, 0, 150, Math.PI, 0);
        this.ctx.fill();
        this.ctx.strokeStyle = '#333'; this.ctx.lineWidth = 5; this.ctx.stroke();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('KM/H', 0, -50);

        this.ctx.font = 'bold 40px monospace';
        this.ctx.fillStyle = this.speed > CONFIG.MAX_SPEED * 0.9 ? '#ff0055' : '#00ff88';
        this.ctx.fillText(Math.floor(this.speed / 100), 0, -90);

        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 20;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath(); this.ctx.moveTo(-100, -20); this.ctx.quadraticCurveTo(-200, -50, -400, 100); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(100, -20); this.ctx.quadraticCurveTo(200, -50, 400, 100); this.ctx.stroke();
        this.ctx.lineWidth = 25; this.ctx.strokeStyle = '#000';
        this.ctx.beginPath(); this.ctx.moveTo(-350, 60); this.ctx.lineTo(-400, 100); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(350, 60); this.ctx.lineTo(400, 100); this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * The one and only RAF callback. dt clamped to 0.05 s.
     */
    step(now) {
        requestAnimationFrame(this.step);
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;
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

    // --- Subject picker ---
    let selectedSubject = 'python';
    const subjectBtns = document.querySelectorAll('.subject-btn');
    subjectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            subjectBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedSubject = btn.getAttribute('data-subject') || 'python';
        });
    });

    const getPlayerName = () => {
        const raw = (nameInput && nameInput.value) ? nameInput.value.trim() : '';
        if (!raw) return 'Rider';
        return raw.slice(0, 12);
    };

    const startGame = (name, subject) => {
        if (game.gameState !== STATE.MENU) return;
        overlay.classList.add('hidden');
        game.start(name, subject);
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

    startBtn.addEventListener('click', () => startGame(getPlayerName(), selectedSubject));
    if (quickStartBtn) {
        quickStartBtn.addEventListener('click', () => startGame('Rider', 'python'));
    }
};
