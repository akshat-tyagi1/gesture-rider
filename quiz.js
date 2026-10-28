/**
 * quiz.js — Quiz logic and session management for Gesture Rider
 * Implements sections 2, 5, and 8 of PLAN.md:
 * - Exposes global Quiz
 * - Quiz.startRun(subject): returns a run session object for the given subject
 * - run.nextQuestion(checkpoint): returns random unused question for checkpoint 1-4 with tier fallback
 * - run.record(result): records 'correct', 'wrong', or 'timeout'
 * - run.stats(): returns { answered, correct, wrong, timeouts, accuracyPct }
 */

(function (global) {
  'use strict';

  const CHECKPOINT_TIERS = {
    1: 'easy',
    2: 'easy',
    3: 'easy-medium',
    4: 'medium'
  };

  const TIER_ORDER = ['easy', 'easy-medium', 'medium'];

  /**
   * Helper to resolve the global window object across browser and node/vm contexts.
   */
  function getWindow() {
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
    if (typeof globalThis !== 'undefined') return globalThis;
    return global;
  }

  /**
   * Shuffles options using Fisher-Yates while tracking the correct answer index.
   */
  function shuffleOptions(originalOptions, originalAnswerIndex) {
    const items = originalOptions.map((opt, idx) => ({
      text: opt,
      isCorrect: idx === originalAnswerIndex
    }));

    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }

    const shuffledOptions = items.map(item => item.text);
    const answerIndex = items.findIndex(item => item.isCorrect);

    return {
      options: shuffledOptions,
      answerIndex: answerIndex
    };
  }

  /**
   * QuizRun represents an active quiz run for a subject.
   */
  class QuizRun {
    constructor(subject, bank) {
      this.subject = subject;
      this._bank = bank;
      this._usedIds = new Set();
      this._answered = 0;
      this._correct = 0;
      this._wrong = 0;
      this._timeouts = 0;
    }

    /**
     * Pick a question for checkpoint (1-4).
     * Tier mapping: 1, 2 = easy; 3 = easy-medium; 4 = medium.
     * Falls back to the nearest tier if a tier runs out.
     */
    nextQuestion(checkpoint) {
      const cpNum = Number(checkpoint);
      if (!CHECKPOINT_TIERS[cpNum]) {
        throw new Error(`Invalid checkpoint: ${checkpoint}. Expected 1, 2, 3, or 4.`);
      }

      const targetTier = CHECKPOINT_TIERS[cpNum];
      const unusedQuestions = this._bank.filter(q => !this._usedIds.has(q.id));

      if (unusedQuestions.length === 0) {
        throw new Error(`No available questions remaining in question bank for subject "${this.subject}".`);
      }

      const targetIndex = TIER_ORDER.indexOf(targetTier);

      // Find minimum tier distance among unused questions
      let minDistance = Infinity;
      for (const q of unusedQuestions) {
        const qIndex = TIER_ORDER.indexOf(q.tier);
        const dist = qIndex === -1 ? 99 : Math.abs(qIndex - targetIndex);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      // Collect all unused questions at this nearest distance
      const candidates = unusedQuestions.filter(q => {
        const qIndex = TIER_ORDER.indexOf(q.tier);
        const dist = qIndex === -1 ? 99 : Math.abs(qIndex - targetIndex);
        return dist === minDistance;
      });

      // Pick a random question from candidate pool
      const pickedIndex = Math.floor(Math.random() * candidates.length);
      const picked = candidates[pickedIndex];

      // Mark question as used in this run
      this._usedIds.add(picked.id);

      // Shuffle options and map answerIndex
      const { options, answerIndex } = shuffleOptions(picked.options, picked.answer);

      // Time limit: 25 seconds for maths, 15 seconds for others
      const isMaths = String(this.subject).toLowerCase() === 'maths' ||
                      (picked.subject && String(picked.subject).toLowerCase() === 'maths');
      const timeLimit = isMaths ? 25 : 15;

      return {
        id: picked.id,
        q: picked.q,
        options: options,
        answerIndex: answerIndex,
        explain: picked.explain,
        timeLimit: timeLimit,
        tier: picked.tier
      };
    }

    /**
     * Record the result of answering a question.
     * @param {'correct' | 'wrong' | 'timeout'} result
     */
    record(result) {
      if (result === 'correct') {
        this._correct++;
        this._answered++;
      } else if (result === 'wrong') {
        this._wrong++;
        this._answered++;
      } else if (result === 'timeout') {
        this._timeouts++;
        this._answered++;
      } else {
        throw new Error(`Invalid quiz result: "${result}". Expected 'correct', 'wrong', or 'timeout'.`);
      }
      return this;
    }

    /**
     * Returns stats for the run.
     * Checkpoints never reached count as nothing.
     */
    stats() {
      const accuracyPct = this._answered === 0
        ? 0
        : Math.round((this._correct / this._answered) * 100);

      return {
        answered: this._answered,
        correct: this._correct,
        wrong: this._wrong,
        timeouts: this._timeouts,
        accuracyPct: accuracyPct
      };
    }
  }

  const Quiz = {
    CHECKPOINT_TIERS,
    TIER_ORDER,

    /**
     * Start a new quiz run for the given subject.
     * Uses window.QUESTION_BANKS[subject].
     * Throws a clear error if the bank is missing.
     */
    startRun(subject) {
      if (!subject || typeof subject !== 'string') {
        throw new Error(`Subject must be a non-empty string. Received: ${subject}`);
      }

      const win = getWindow();
      const banks = win.QUESTION_BANKS;
      if (!banks || typeof banks !== 'object') {
        throw new Error(`window.QUESTION_BANKS is missing or undefined.`);
      }

      const bank = banks[subject];
      if (!bank || !Array.isArray(bank)) {
        throw new Error(`Question bank for subject "${subject}" is missing or not an array.`);
      }

      if (bank.length === 0) {
        throw new Error(`Question bank for subject "${subject}" is empty.`);
      }

      return new QuizRun(subject, bank);
    }
  };

  // Expose global Quiz
  if (typeof window !== 'undefined') {
    window.Quiz = Quiz;
  }
  if (typeof global !== 'undefined') {
    global.Quiz = Quiz;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.Quiz = Quiz;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Quiz;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
