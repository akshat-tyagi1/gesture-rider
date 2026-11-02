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
  const VALID_SUBJECTS = ['python', 'html', 'css', 'maths'];

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
   * QuizRun represents an active quiz run for one or more subjects.
   */
  class QuizRun {
    constructor(subjects, banksMap) {
      this.subjects = [...subjects];
      this.subject = subjects[0];
      this._banks = banksMap;
      this._bank = banksMap[subjects[0]];
      this._usedIds = new Set();
      this._availableSubjects = [];
      this._lastSubject = null;
      this._answered = 0;
      this._correct = 0;
      this._wrong = 0;
      this._timeouts = 0;
    }

    /**
     * Pick a question for checkpoint (1-4).
     * First picks a subject from selected ones: uses each selected subject once
     * (in random order) before any repeats, and when there is more than one subject
     * never picks the same subject as the previous checkpoint.
     * Tier mapping: 1, 2 = easy; 3 = easy-medium; 4 = medium.
     * Falls back to the nearest tier if a tier runs out.
     */
    nextQuestion(checkpoint) {
      const cpNum = Number(checkpoint);
      if (!CHECKPOINT_TIERS[cpNum]) {
        throw new Error(`Invalid checkpoint: ${checkpoint}. Expected 1, 2, 3, or 4.`);
      }

      // 1. Pick a subject from selected ones
      if (this._availableSubjects.length === 0) {
        this._availableSubjects = [...this.subjects];
      }

      let pool = this._availableSubjects;
      if (this.subjects.length > 1 && this._lastSubject !== null) {
        const filtered = pool.filter(s => s !== this._lastSubject);
        if (filtered.length > 0) {
          pool = filtered;
        }
      }

      const pickedSubject = pool[Math.floor(Math.random() * pool.length)];
      const idx = this._availableSubjects.indexOf(pickedSubject);
      this._availableSubjects.splice(idx, 1);
      this._lastSubject = pickedSubject;

      // 2. Pick question by tier from that subject's bank
      const bank = this._banks[pickedSubject];
      const targetTier = CHECKPOINT_TIERS[cpNum];
      const unusedQuestions = bank.filter(q => !this._usedIds.has(q.id));

      if (unusedQuestions.length === 0) {
        throw new Error(`No available questions remaining in question bank for subject "${pickedSubject}".`);
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

      // Time limit: 25 seconds for maths, 15 seconds for others (per question)
      const isMaths = String(pickedSubject).toLowerCase() === 'maths';
      const timeLimit = isMaths ? 25 : 15;

      return {
        id: picked.id,
        subject: pickedSubject,
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
     * Start a new quiz run for the given subject(s).
     * Accepts a string (old behaviour) or an array of 1-4 distinct valid subjects (python, html, css, maths).
     * Throws a clear error for an empty or invalid list or a missing bank.
     */
    startRun(subjectsInput) {
      const win = getWindow();
      const banks = win.QUESTION_BANKS;
      if (!banks || typeof banks !== 'object') {
        throw new Error('window.QUESTION_BANKS is missing or undefined.');
      }

      let selectedSubjects = [];

      if (typeof subjectsInput === 'string') {
        const trimmed = subjectsInput.trim();
        if (!trimmed) {
          throw new Error('Subject must be a non-empty string.');
        }
        const bank = banks[trimmed];
        if (!bank || !Array.isArray(bank)) {
          throw new Error(`Question bank for subject "${trimmed}" is missing or not an array.`);
        }
        if (bank.length === 0) {
          throw new Error(`Question bank for subject "${trimmed}" is empty.`);
        }
        selectedSubjects = [trimmed];
      } else if (Array.isArray(subjectsInput)) {
        if (subjectsInput.length === 0) {
          throw new Error('Subjects list cannot be empty.');
        }
        if (subjectsInput.length > 4) {
          throw new Error('Subjects list cannot contain more than 4 subjects.');
        }
        const seen = new Set();
        for (const s of subjectsInput) {
          if (typeof s !== 'string') {
            throw new Error(`Invalid subject in list: ${s}. Expected a string.`);
          }
          const lower = s.trim().toLowerCase();
          if (!VALID_SUBJECTS.includes(lower)) {
            throw new Error(`Invalid subject: "${s}". Allowed subjects are: ${VALID_SUBJECTS.join(', ')}.`);
          }
          if (seen.has(lower)) {
            throw new Error(`Duplicate subject in list: "${s}". Subjects must be distinct.`);
          }
          seen.add(lower);
          const bank = banks[lower];
          if (!bank || !Array.isArray(bank)) {
            throw new Error(`Question bank for subject "${lower}" is missing or not an array.`);
          }
          if (bank.length === 0) {
            throw new Error(`Question bank for subject "${lower}" is empty.`);
          }
        }
        selectedSubjects = Array.from(seen);
      } else {
        throw new Error(`Subject must be a non-empty string or an array of 1-4 distinct subjects. Received: ${subjectsInput}`);
      }

      const banksMap = {};
      for (const s of selectedSubjects) {
        banksMap[s] = banks[s];
      }

      return new QuizRun(selectedSubjects, banksMap);
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
