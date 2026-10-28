/**
 * storage.js — Local leaderboard and personal best storage for Gesture Rider
 */
(function (global) {
  'use strict';

  const LEADERBOARD_KEY = 'gestureRider.v1.leaderboard';
  const PB_KEY = 'gestureRider.v1.pb';
  const RUNS_KEY = 'gestureRider.v1.runs';

  const ALLOWED_SUBJECTS = ['python', 'html', 'css', 'maths'];
  const inMemoryRuns = new Set();

  function getStorage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        return localStorage;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        return globalThis.localStorage;
      }
    } catch (e) {
      // Storage unavailable or permission denied
    }
    return null;
  }

  function safeGetItem(key) {
    try {
      const storage = getStorage();
      if (!storage) return null;
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSetItem(key, value) {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function safeRemoveItem(key) {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sanitizeName(name) {
    if (typeof name !== 'string') return 'Rider';
    const trimmed = name.trim();
    if (!trimmed) return 'Rider';
    return trimmed.slice(0, 12);
  }

  function sanitizeNonNegativeInt(val, defaultVal = 0) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Math.max(0, Math.floor(val));
    }
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }
    return defaultVal;
  }

  function sanitizeSubject(sub) {
    if (typeof sub === 'string') {
      const lower = sub.trim().toLowerCase();
      if (ALLOWED_SUBJECTS.includes(lower)) {
        return lower;
      }
    }
    return 'python';
  }

  function isValidLeaderboardEntry(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    if (typeof item.name !== 'string') return false;
    const trimmedName = item.name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 12) return false;

    if (typeof item.score !== 'number' || !Number.isInteger(item.score) || item.score < 0) return false;
    if (typeof item.coins !== 'number' || !Number.isInteger(item.coins) || item.coins < 0) return false;

    if (typeof item.subject !== 'string') return false;
    if (!ALLOWED_SUBJECTS.includes(item.subject.trim().toLowerCase())) return false;

    if (typeof item.answered !== 'number' || !Number.isInteger(item.answered) || item.answered < 0) return false;
    if (typeof item.correct !== 'number' || !Number.isInteger(item.correct) || item.correct < 0) return false;
    if (typeof item.timeouts !== 'number' || !Number.isInteger(item.timeouts) || item.timeouts < 0) return false;

    if (typeof item.finished !== 'boolean') return false;

    if (typeof item.date !== 'string' || item.date.trim().length === 0) return false;

    return true;
  }

  function getSubmittedRunIds() {
    const runs = new Set(inMemoryRuns);
    try {
      const raw = safeGetItem(RUNS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (id !== null && id !== undefined) {
              runs.add(String(id));
            }
          }
        }
      }
    } catch (e) {
      // ignore corrupt runs json
    }
    return runs;
  }

  function recordSubmittedRun(runId) {
    const idStr = String(runId);
    inMemoryRuns.add(idStr);
    try {
      const allRuns = Array.from(getSubmittedRunIds());
      if (!allRuns.includes(idStr)) {
        allRuns.push(idStr);
      }
      safeSetItem(RUNS_KEY, JSON.stringify(allRuns));
    } catch (e) {
      // ignore
    }
  }

  function loadPbMap() {
    try {
      const raw = safeGetItem(PB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return {};
  }

  function savePbMap(map) {
    try {
      safeSetItem(PB_KEY, JSON.stringify(map));
    } catch (e) {
      // ignore
    }
  }

  function sortEntries(entries) {
    return entries.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.coins - a.coins;
    });
  }

  const Store = {
    /**
     * Returns the validated leaderboard array (top 10, sorted by score desc then coins desc).
     * Drops invalid entries instead of throwing.
     * Survives missing, corrupt or non-array JSON and unavailable localStorage.
     */
    load() {
      try {
        const raw = safeGetItem(LEADERBOARD_KEY);
        if (!raw) return [];

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          return [];
        }

        if (!Array.isArray(parsed)) return [];

        const validEntries = [];
        for (const item of parsed) {
          if (isValidLeaderboardEntry(item)) {
            validEntries.push({
              name: item.name.trim(),
              score: item.score,
              coins: item.coins,
              subject: item.subject.trim().toLowerCase(),
              answered: item.answered,
              correct: item.correct,
              timeouts: item.timeouts,
              finished: Boolean(item.finished),
              date: item.date.trim()
            });
          }
        }

        sortEntries(validEntries);
        return validEntries.slice(0, 10);
      } catch (e) {
        return [];
      }
    },

    /**
     * Submits a run result to the leaderboard and personal best storage.
     * Sanitizes inputs, prevents duplicate runId submission, updates PB, and updates top 10.
     * @param {Object} entry { runId, name, score, coins, subject, answered, correct, timeouts, finished }
     * @returns {Object} { rank (1-10 or null), isPersonalBest, personalBest }
     */
    submit(entry) {
      try {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return { rank: null, isPersonalBest: false, personalBest: 0 };
        }

        const name = sanitizeName(entry.name);
        const score = sanitizeNonNegativeInt(entry.score);
        const coins = sanitizeNonNegativeInt(entry.coins);
        const subject = sanitizeSubject(entry.subject);
        const answered = sanitizeNonNegativeInt(entry.answered);
        const correct = sanitizeNonNegativeInt(entry.correct);
        const timeouts = sanitizeNonNegativeInt(entry.timeouts);
        const finished = Boolean(entry.finished);
        const date = (typeof entry.date === 'string' && entry.date.trim().length > 0)
          ? entry.date.trim()
          : new Date().toISOString();

        const previousPB = Store.personalBest(name);

        // Check duplicate runId
        if (entry.runId !== undefined && entry.runId !== null) {
          const runIdStr = String(entry.runId).trim();
          if (runIdStr.length > 0) {
            const submittedRuns = getSubmittedRunIds();
            if (submittedRuns.has(runIdStr)) {
              return {
                rank: null,
                isPersonalBest: false,
                personalBest: previousPB
              };
            }
            recordSubmittedRun(runIdStr);
          }
        }

        // Determine personal best
        const isPersonalBest = score > previousPB;
        const personalBest = isPersonalBest ? score : previousPB;

        if (isPersonalBest) {
          const pbMap = loadPbMap();
          pbMap[name.toLowerCase()] = score;
          savePbMap(pbMap);
        } else {
          // Ensure name exists in pbMap
          const pbMap = loadPbMap();
          const lowerName = name.toLowerCase();
          if (typeof pbMap[lowerName] !== 'number') {
            pbMap[lowerName] = personalBest;
            savePbMap(pbMap);
          }
        }

        const newEntry = {
          name,
          score,
          coins,
          subject,
          answered,
          correct,
          timeouts,
          finished,
          date
        };

        const currentLeaderboard = Store.load();
        currentLeaderboard.push(newEntry);
        sortEntries(currentLeaderboard);

        const index = currentLeaderboard.indexOf(newEntry);
        const rank = (index >= 0 && index < 10) ? index + 1 : null;

        const top10 = currentLeaderboard.slice(0, 10);
        safeSetItem(LEADERBOARD_KEY, JSON.stringify(top10));

        return {
          rank,
          isPersonalBest,
          personalBest
        };
      } catch (e) {
        return { rank: null, isPersonalBest: false, personalBest: 0 };
      }
    },

    /**
     * Returns personal best score for the given name (case-insensitive).
     * Returns 0 if none found.
     * @param {string} name
     * @returns {number}
     */
    personalBest(name) {
      try {
        if (typeof name !== 'string') return 0;
        const key = name.trim().toLowerCase();
        if (!key) return 0;

        const pbMap = loadPbMap();
        if (typeof pbMap[key] === 'number' && Number.isFinite(pbMap[key]) && pbMap[key] >= 0) {
          return Math.floor(pbMap[key]);
        }

        // Fallback: check leaderboard
        const board = Store.load();
        let maxScore = 0;
        for (const entry of board) {
          if (entry.name.toLowerCase() === key && entry.score > maxScore) {
            maxScore = entry.score;
          }
        }
        return maxScore;
      } catch (e) {
        return 0;
      }
    },

    /**
     * Clears all leaderboard, personal best, and duplicate run data.
     */
    reset() {
      try {
        inMemoryRuns.clear();
        safeRemoveItem(LEADERBOARD_KEY);
        safeRemoveItem(PB_KEY);
        safeRemoveItem(RUNS_KEY);
      } catch (e) {
        // ignore
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Store;
  }
  global.Store = Store;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
