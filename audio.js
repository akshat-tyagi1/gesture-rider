/**
 * audio.js — Sound effects and audio synthesis for Gesture Rider
 * Web Audio API synthesizer for engine, wind, and all game SFX.
 * Zero external audio files or dependencies.
 *
 * Implements section 9 of PLAN.md:
 * Exposes global Sfx with methods:
 *   init(), engineUpdate(speedRatio), engineStop(), coin(), crash(),
 *   quizOpen(), correct(), wrong(), tick(), go(), wasted()
 * All methods are safe to call before init() (no throw).
 */

(function (window) {
    'use strict';

    const Sfx = {
        ctx: null,
        initialized: false,
        engineOsc: null,
        engineFilter: null,
        engineGain: null,
        windNode: null,
        windFilter: null,
        windGain: null,
        masterGain: null,
        noiseBuffer: null,

        /**
         * Initialize the AudioContext and persistent engine/wind audio graph.
         * Must be triggered by a user gesture (click/keydown/touch).
         */
        init() {
            if (this.initialized && this.ctx) {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }
                return;
            }

            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) {
                    console.warn('Web Audio API not supported in this browser.');
                    return;
                }

                this.ctx = new AudioContextClass();
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                // Master gain
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);

                // Shared 2-second white noise buffer (for wind, crash, wasted)
                const bufferSize = 2 * this.ctx.sampleRate;
                this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const output = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }

                // -------------------------------------------------------------
                // Engine Sound (Ported from AudioController in game.js)
                // Sawtooth oscillator for low bike growl
                // -------------------------------------------------------------
                this.engineOsc = this.ctx.createOscillator();
                this.engineOsc.type = 'sawtooth';
                this.engineOsc.frequency.setValueAtTime(100, this.ctx.currentTime);

                // Engine Filter (Lowpass to muffle raw sawtooth)
                this.engineFilter = this.ctx.createBiquadFilter();
                this.engineFilter.type = 'lowpass';
                this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

                this.engineGain = this.ctx.createGain();
                this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

                this.engineOsc.connect(this.engineFilter);
                this.engineFilter.connect(this.engineGain);
                this.engineGain.connect(this.masterGain);
                this.engineOsc.start();

                // -------------------------------------------------------------
                // Wind Noise (Ported from AudioController in game.js)
                // Filtered looping white noise buffer
                // -------------------------------------------------------------
                this.windNode = this.ctx.createBufferSource();
                this.windNode.buffer = this.noiseBuffer;
                this.windNode.loop = true;

                this.windFilter = this.ctx.createBiquadFilter();
                this.windFilter.type = 'highpass';
                this.windFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

                this.windGain = this.ctx.createGain();
                this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

                this.windNode.connect(this.windFilter);
                this.windFilter.connect(this.windGain);
                this.windGain.connect(this.masterGain);
                this.windNode.start();

                this.initialized = true;
            } catch (err) {
                // Safe fail - never throw
                console.warn('Sfx.init() failed:', err);
            }
        },

        /**
         * Update engine RPM pitch and wind volume based on motorcycle speed.
         * Ported from AudioController.update() in game.js.
         * @param {number} speedRatio Normalized speed 0.0 to 1.0
         */
        engineUpdate(speedRatio) {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const r = Math.max(0, Math.min(1, Number(speedRatio) || 0));
                const t = this.ctx.currentTime;

                // Engine Pitch: 80Hz idle -> 300Hz max
                const targetFreq = 80 + (r * 220);
                this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);

                // Engine Filter opens up with speed: 400Hz -> 1400Hz
                this.engineFilter.frequency.setTargetAtTime(400 + (r * 1000), t, 0.1);

                // Engine Volume: Idle is quiet, mid is loud, high speed slightly quieter (wind takes over)
                const engVol = 0.1 + (r * 0.2);
                this.engineGain.gain.setTargetAtTime(engVol, t, 0.1);

                // Wind Volume: Starts at 50% speed
                let windVol = 0;
                if (r > 0.5) {
                    windVol = (r - 0.5) * 2 * 0.3; // max 0.3 vol
                }
                this.windGain.gain.setTargetAtTime(windVol, t, 0.1);
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Stop/mute engine and wind sounds (e.g. paused, checkpoint quiz, game over).
         */
        engineStop() {
            if (!this.initialized || !this.ctx) return;
            try {
                const t = this.ctx.currentTime;
                if (this.engineGain) {
                    this.engineGain.gain.cancelScheduledValues(t);
                    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
                    this.engineGain.gain.linearRampToValueAtTime(0, t + 0.06);
                }
                if (this.windGain) {
                    this.windGain.gain.cancelScheduledValues(t);
                    this.windGain.gain.setValueAtTime(this.windGain.gain.value, t);
                    this.windGain.gain.linearRampToValueAtTime(0, t + 0.06);
                }
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Coin pickup sound (+5 score).
         * Bright dual-tone arcade chime (B5 -> E6).
         */
        coin() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;
                const gain = this.ctx.createGain();
                gain.connect(this.masterGain);

                // First note: B5 (987.77 Hz)
                const osc1 = this.ctx.createOscillator();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(987.77, t);
                osc1.connect(gain);

                // Quick envelope for note 1
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.setValueAtTime(0.3, t + 0.07);

                // Second note: E6 (1318.51 Hz)
                const osc2 = this.ctx.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.51, t + 0.08);
                osc2.connect(gain);

                // Envelope for note 2 with ringing exponential tail
                gain.gain.setValueAtTime(0.35, t + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

                osc1.start(t);
                osc1.stop(t + 0.08);

                osc2.start(t + 0.08);
                osc2.stop(t + 0.4);
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Crash / impact sound (traffic or obstacle collision, -1 life).
         * Ported & enhanced from AudioController.playCrash() in game.js:
         * Explosive swept lowpass white noise + low frequency punch + engine mute.
         */
        crash() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;

                // 1. Swept lowpass white noise burst (AudioController)
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;

                const noiseFilter = this.ctx.createBiquadFilter();
                noiseFilter.type = 'lowpass';
                noiseFilter.frequency.setValueAtTime(1100, t);
                noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 1.0);

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.9, t);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.masterGain);
                noise.start(t);
                noise.stop(t + 1.3);

                // 2. Heavy low punch/crunch (160 Hz -> 35 Hz)
                const punchOsc = this.ctx.createOscillator();
                punchOsc.type = 'triangle';
                punchOsc.frequency.setValueAtTime(160, t);
                punchOsc.frequency.exponentialRampToValueAtTime(35, t + 0.35);

                const punchGain = this.ctx.createGain();
                punchGain.gain.setValueAtTime(0.7, t);
                punchGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

                punchOsc.connect(punchGain);
                punchGain.connect(this.masterGain);
                punchOsc.start(t);
                punchOsc.stop(t + 0.45);

                // 3. Fade out engine & wind immediately (AudioController)
                if (this.engineGain) {
                    this.engineGain.gain.cancelScheduledValues(t);
                    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
                    this.engineGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                }
                if (this.windGain) {
                    this.windGain.gain.cancelScheduledValues(t);
                    this.windGain.gain.setValueAtTime(this.windGain.gain.value, t);
                    this.windGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                }
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Quiz prompt / checkpoint open sound.
         * Ascending electronic high-tech notification chime (G4 -> C5 -> G5).
         */
        quizOpen() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;
                const notes = [
                    { f: 392.00, start: 0, dur: 0.08 },       // G4
                    { f: 523.25, start: 0.08, dur: 0.08 },    // C5
                    { f: 783.99, start: 0.16, dur: 0.22 }     // G5
                ];

                notes.forEach(note => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(note.f, t + note.start);

                    gain.gain.setValueAtTime(0.25, t + note.start);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + note.start + note.dur);

                    osc.connect(gain);
                    gain.connect(this.masterGain);

                    osc.start(t + note.start);
                    osc.stop(t + note.start + note.dur);
                });
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Correct answer sound (+100 score).
         * Bright, triumphant ascending major chord arpeggio (E5 -> G#5 -> B5 -> E6).
         */
        correct() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;
                const arpeggio = [
                    { f: 659.25, start: 0, dur: 0.09 },       // E5
                    { f: 830.61, start: 0.08, dur: 0.09 },    // G#5
                    { f: 987.77, start: 0.16, dur: 0.12 },    // B5
                    { f: 1318.51, start: 0.24, dur: 0.35 }    // E6
                ];

                arpeggio.forEach(note => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(note.f, t + note.start);

                    gain.gain.setValueAtTime(0.3, t + note.start);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + note.start + note.dur);

                    osc.connect(gain);
                    gain.connect(this.masterGain);

                    osc.start(t + note.start);
                    osc.stop(t + note.start + note.dur + 0.02);
                });
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Wrong answer / timeout sound (-20 score).
         * Dissonant low frequency buzz with downward bend.
         */
        wrong() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;
                const duration = 0.32;

                // Two detuned low sawtooth oscillators for dissonant buzzer effect
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                osc1.type = 'sawtooth';
                osc2.type = 'sawtooth';

                osc1.frequency.setValueAtTime(140, t);
                osc1.frequency.linearRampToValueAtTime(90, t + duration);

                osc2.frequency.setValueAtTime(148, t);
                osc2.frequency.linearRampToValueAtTime(95, t + duration);

                // Lowpass filter to keep it gritty rather than piercing
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(650, t);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.35, t);
                gain.gain.setValueAtTime(0.35, t + duration - 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

                osc1.connect(filter);
                osc2.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);

                osc1.start(t);
                osc2.start(t);
                osc1.stop(t + duration);
                osc2.stop(t + duration);
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Countdown tick sound (for 3, 2, 1 and quiz timer seconds).
         * Crisp, snappy woodblock-style click.
         */
        tick() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, t); // A5
                osc.frequency.exponentialRampToValueAtTime(440, t + 0.035);

                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(t);
                osc.stop(t + 0.045);
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * Countdown "GO!" sound.
         * Bright, energetic launch tone (upward slide + higher octave chime).
         */
        go() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;
                const duration = 0.35;

                // Main upward slide oscillator
                const osc = this.ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(987.77, t); // B5
                osc.frequency.exponentialRampToValueAtTime(1567.98, t + 0.12); // G6

                // Harmonic shimmer
                const oscHigh = this.ctx.createOscillator();
                oscHigh.type = 'sine';
                oscHigh.frequency.setValueAtTime(1567.98, t);
                oscHigh.frequency.setValueAtTime(1567.98, t + 0.1);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.4, t);
                gain.gain.setValueAtTime(0.4, t + 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

                osc.connect(gain);
                oscHigh.connect(gain);
                gain.connect(this.masterGain);

                osc.start(t);
                oscHigh.start(t);
                osc.stop(t + duration);
                oscHigh.stop(t + duration);
            } catch (err) {
                // Safe fail
            }
        },

        /**
         * "WASTED" game over sound (lives = 0).
         * GTA-inspired dramatic bass drop, dissonant minor drone, and low rumble.
         */
        wasted() {
            if (!this.initialized || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }

                const t = this.ctx.currentTime;

                // 1. Sub-bass drop (110 Hz down to 25 Hz)
                const subOsc = this.ctx.createOscillator();
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(110, t);
                subOsc.frequency.exponentialRampToValueAtTime(28, t + 2.5);

                const subGain = this.ctx.createGain();
                subGain.gain.setValueAtTime(0.9, t);
                subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);

                subOsc.connect(subGain);
                subGain.connect(this.masterGain);
                subOsc.start(t);
                subOsc.stop(t + 2.9);

                // 2. Dissonant minor second drone (D2 + Eb2)
                const drone1 = this.ctx.createOscillator();
                const drone2 = this.ctx.createOscillator();
                drone1.type = 'sawtooth';
                drone2.type = 'sawtooth';

                drone1.frequency.setValueAtTime(73.4, t); // D2
                drone2.frequency.setValueAtTime(77.8, t); // Eb2

                const droneFilter = this.ctx.createBiquadFilter();
                droneFilter.type = 'lowpass';
                droneFilter.frequency.setValueAtTime(260, t);
                droneFilter.frequency.exponentialRampToValueAtTime(50, t + 2.5);

                const droneGain = this.ctx.createGain();
                droneGain.gain.setValueAtTime(0.45, t);
                droneGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

                drone1.connect(droneFilter);
                drone2.connect(droneFilter);
                droneFilter.connect(droneGain);
                droneGain.connect(this.masterGain);

                drone1.start(t);
                drone2.start(t);
                drone1.stop(t + 2.6);
                drone2.stop(t + 2.6);

                // 3. Low noise rumble
                if (this.noiseBuffer) {
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = this.noiseBuffer;

                    const noiseFilter = this.ctx.createBiquadFilter();
                    noiseFilter.type = 'lowpass';
                    noiseFilter.frequency.setValueAtTime(250, t);
                    noiseFilter.frequency.exponentialRampToValueAtTime(40, t + 1.8);

                    const noiseGain = this.ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.5, t);
                    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

                    noise.connect(noiseFilter);
                    noiseFilter.connect(noiseGain);
                    noiseGain.connect(this.masterGain);
                    noise.start(t);
                    noise.stop(t + 1.9);
                }

                // 4. Mute engine and wind
                this.engineStop();
            } catch (err) {
                // Safe fail
            }
        }
    };

    // Expose global Sfx
    if (typeof window !== 'undefined') {
        window.Sfx = Sfx;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Sfx;
    }
})(typeof window !== 'undefined' ? window : globalThis);
