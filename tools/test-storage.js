/**
 * tools/test-storage.js
 * Unit test suite for storage.js (runs in Node.js with a mock localStorage)
 */

'use strict';

// 1. Mock LocalStorage Implementation
class FakeLocalStorage {
  constructor() {
    this.store = {};
    this.shouldThrow = false;
  }

  getItem(key) {
    if (this.shouldThrow) {
      throw new Error('SecurityError: localStorage is unavailable');
    }
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key, value) {
    if (this.shouldThrow) {
      throw new Error('QuotaExceededError: localStorage write failed');
    }
    this.store[key] = String(value);
  }

  removeItem(key) {
    if (this.shouldThrow) {
      throw new Error('SecurityError: localStorage is unavailable');
    }
    delete this.store[key];
  }

  clear() {
    if (this.shouldThrow) {
      throw new Error('SecurityError: localStorage is unavailable');
    }
    this.store = {};
  }
}

const fakeStorage = new FakeLocalStorage();
global.localStorage = fakeStorage;

// 2. Import Store under test
const Store = require('../storage.js');

// 3. Test Assertion Framework
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  assert(actualStr === expectedStr, `${message} (expected: ${expectedStr}, got: ${actualStr})`);
}

function runTest(name, fn) {
  console.log(`\n• Test: ${name}`);
  fakeStorage.shouldThrow = false;
  fakeStorage.clear();
  Store.reset();
  try {
    fn();
    console.log(`  PASS: ${name}`);
  } catch (err) {
    console.error(`  ERROR in "${name}":`, err.message);
  }
}

// 4. Test Suites

// Suite 1: Sorting by score desc
runTest('Sorting leaderboard by score descending', () => {
  Store.submit({ runId: 'r1', name: 'Rider1', score: 100, coins: 5 });
  Store.submit({ runId: 'r2', name: 'Rider2', score: 300, coins: 2 });
  Store.submit({ runId: 'r3', name: 'Rider3', score: 200, coins: 10 });

  const board = Store.load();
  assertEqual(board.length, 3, 'Board should contain 3 entries');
  assertEqual(board[0].name, 'Rider2', 'First should be Rider2 (score 300)');
  assertEqual(board[0].score, 300, 'First score should be 300');
  assertEqual(board[1].name, 'Rider3', 'Second should be Rider3 (score 200)');
  assertEqual(board[1].score, 200, 'Second score should be 200');
  assertEqual(board[2].name, 'Rider1', 'Third should be Rider1 (score 100)');
  assertEqual(board[2].score, 100, 'Third score should be 100');
});

// Suite 2: Tie-break by coins desc
runTest('Tie-break by coins when scores are equal', () => {
  const res1 = Store.submit({ runId: 'c1', name: 'LowCoin', score: 250, coins: 5, subject: 'python' });
  const res2 = Store.submit({ runId: 'c2', name: 'HighCoin', score: 250, coins: 20, subject: 'python' });
  const res3 = Store.submit({ runId: 'c3', name: 'MidCoin', score: 250, coins: 12, subject: 'python' });

  assertEqual(res1.rank, 1, 'First entry at 250 was temporarily rank 1');
  assertEqual(res2.rank, 1, 'HighCoin (20 coins) takes rank 1');
  assertEqual(res3.rank, 2, 'MidCoin (12 coins) takes rank 2');

  const board = Store.load();
  assertEqual(board.length, 3, 'Board has 3 entries');
  assertEqual(board[0].name, 'HighCoin', 'Rank 1 has highest coins (20)');
  assertEqual(board[0].coins, 20, '20 coins');
  assertEqual(board[1].name, 'MidCoin', 'Rank 2 has middle coins (12)');
  assertEqual(board[1].coins, 12, '12 coins');
  assertEqual(board[2].name, 'LowCoin', 'Rank 3 has lowest coins (5)');
  assertEqual(board[2].coins, 5, '5 coins');
});

// Suite 3: Top-10 cap
runTest('Top-10 cap and rank assignment', () => {
  // Submit 12 entries with scores 10, 20, ..., 120
  for (let i = 1; i <= 12; i++) {
    const res = Store.submit({
      runId: `run-${i}`,
      name: `Player${i}`,
      score: i * 10,
      coins: i,
      subject: 'python'
    });
    assertEqual(res.rank, 1, `Player${i} submitted with highest score so far, so rank is 1`);
  }

  const board = Store.load();
  assertEqual(board.length, 10, 'Leaderboard must be capped at 10 items');
  assertEqual(board[0].score, 120, 'Rank 1 score is 120');
  assertEqual(board[9].score, 30, 'Rank 10 score is 30');

  // Submit an 11th-place score (score 15, below 10th place score 30)
  const lowRes = Store.submit({
    runId: 'low-run',
    name: 'Underdog',
    score: 15,
    coins: 0,
    subject: 'maths'
  });
  assertEqual(lowRes.rank, null, 'Score lower than 10th place gets rank null');

  const boardAfterLow = Store.load();
  assertEqual(boardAfterLow.length, 10, 'Board remains capped at 10 items');
  assert(!boardAfterLow.some(e => e.name === 'Underdog'), 'Underdog is not on the board');

  // Submit a score that displaces the 10th place
  const displaceRes = Store.submit({
    runId: 'mid-run',
    name: 'Contender',
    score: 55,
    coins: 0,
    subject: 'css'
  });
  assertEqual(displaceRes.rank, 8, 'Score 55 should enter at rank 8');

  const boardAfterDisplace = Store.load();
  assertEqual(boardAfterDisplace.length, 10, 'Board still capped at 10 items');
  assertEqual(boardAfterDisplace[7].name, 'Contender', 'Contender is at index 7 (rank 8)');
  assertEqual(boardAfterDisplace[9].score, 40, 'Previous rank 10 (score 30) was pushed off, new rank 10 is 40');
});

// Suite 4: Corrupt data handling
runTest('Survive missing, corrupt or non-array JSON and drop invalid entries', () => {
  // Test 1: Empty / missing storage
  fakeStorage.clear();
  assertEqual(Store.load().length, 0, 'Missing key returns empty array');

  // Test 2: Corrupt JSON syntax
  fakeStorage.setItem('gestureRider.v1.leaderboard', '{not valid json syntax');
  assertEqual(Store.load().length, 0, 'Corrupt JSON returns empty array without throwing');

  // Test 3: Non-array JSON
  fakeStorage.setItem('gestureRider.v1.leaderboard', '{"score": 100}');
  assertEqual(Store.load().length, 0, 'Object JSON returns empty array');

  fakeStorage.setItem('gestureRider.v1.leaderboard', '"a string"');
  assertEqual(Store.load().length, 0, 'String JSON returns empty array');

  fakeStorage.setItem('gestureRider.v1.leaderboard', '12345');
  assertEqual(Store.load().length, 0, 'Number JSON returns empty array');

  // Test 4: Array with invalid entries dropped, valid entries kept
  const mixedEntries = [
    null,
    'not-an-object',
    { name: '', score: 100, coins: 5, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // empty name
    { name: 'WayTooLongNameHere', score: 100, coins: 5, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // name > 12 chars
    { name: 'GoodGuy', score: -10, coins: 5, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // negative score
    { name: 'GoodGuy', score: 10.5, coins: 5, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // float score
    { name: 'GoodGuy', score: 100, coins: -1, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // negative coins
    { name: 'GoodGuy', score: 100, coins: 5, subject: 'cplusplus', answered: 4, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // invalid subject
    { name: 'GoodGuy', score: 100, coins: 5, subject: 'python', answered: -1, correct: 4, timeouts: 0, finished: true, date: '2026-10-29' }, // negative answered
    { name: 'GoodGuy', score: 100, coins: 5, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: 'yes', date: '2026-10-29' }, // non-boolean finished
    { name: 'GoodGuy', score: 100, coins: 5, subject: 'python', answered: 4, correct: 4, timeouts: 0, finished: true, date: '' }, // empty date
    // Valid entry 1
    { name: 'ValidOne', score: 150, coins: 10, subject: 'python', answered: 4, correct: 3, timeouts: 1, finished: true, date: '2026-10-29T00:00:00Z' },
    // Valid entry 2
    { name: 'ValidTwo', score: 200, coins: 5, subject: 'css', answered: 4, correct: 4, timeouts: 0, finished: false, date: '2026-10-29T00:00:00Z' }
  ];

  fakeStorage.setItem('gestureRider.v1.leaderboard', JSON.stringify(mixedEntries));
  const cleaned = Store.load();
  assertEqual(cleaned.length, 2, 'Only 2 valid entries should survive');
  assertEqual(cleaned[0].name, 'ValidTwo', 'ValidTwo is first with score 200');
  assertEqual(cleaned[1].name, 'ValidOne', 'ValidOne is second with score 150');
});

// Suite 5: Unavailable localStorage
runTest('Graceful handling of unavailable localStorage (e.g. SecurityError)', () => {
  fakeStorage.shouldThrow = true;

  // load() should return []
  const loaded = Store.load();
  assertEqual(Array.isArray(loaded), true, 'load() returns array when storage throws');
  assertEqual(loaded.length, 0, 'load() returns empty array when storage throws');

  // submit() should return object without throwing
  const sub = Store.submit({ runId: 'err-1', name: 'Rider', score: 50, coins: 2 });
  assertEqual(typeof sub, 'object', 'submit returns object');
  assertEqual(sub.rank, 1, 'submit computed rank in-memory');

  // personalBest() should return 0 without throwing
  const pb = Store.personalBest('Rider');
  assertEqual(pb, 0, 'personalBest returns 0 when storage throws');

  // reset() should not throw
  Store.reset();
  assert(true, 'reset() survived unavailable storage');
});

// Suite 6: Duplicate runId prevention
runTest('Prevent duplicate submit per runId', () => {
  const run1 = Store.submit({
    runId: 'match-101',
    name: 'RacerA',
    score: 100,
    coins: 5,
    subject: 'html'
  });
  assertEqual(run1.rank, 1, 'First submission of runId succeeds with rank 1');
  assertEqual(run1.isPersonalBest, true, 'First submission sets isPersonalBest: true');
  assertEqual(run1.personalBest, 100, 'Personal best is 100');

  // Submit identical runId with higher score
  const dupRun = Store.submit({
    runId: 'match-101',
    name: 'RacerA',
    score: 999,
    coins: 50,
    subject: 'html'
  });
  assertEqual(dupRun.rank, null, 'Duplicate runId returns rank null');
  assertEqual(dupRun.isPersonalBest, false, 'Duplicate runId isPersonalBest is false');
  assertEqual(dupRun.personalBest, 100, 'Duplicate runId personalBest remains previous (100)');

  // Verify leaderboard was not modified by duplicate
  const board = Store.load();
  assertEqual(board.length, 1, 'Board still only has 1 entry');
  assertEqual(board[0].score, 100, 'Score is still 100, not 999');
  assertEqual(Store.personalBest('RacerA'), 100, 'Personal best is still 100');

  // New runId should succeed
  const run2 = Store.submit({
    runId: 'match-102',
    name: 'RacerA',
    score: 200,
    coins: 10,
    subject: 'html'
  });
  assertEqual(run2.rank, 1, 'New runId succeeds with rank 1');
  assertEqual(run2.isPersonalBest, true, 'New runId sets new personal best');
  assertEqual(run2.personalBest, 200, 'Personal best is now 200');
});

// Suite 7: Personal Best tracking and case-insensitivity
runTest('Personal best tracking, case-insensitivity, and persistence', () => {
  // Non-existent player returns 0
  assertEqual(Store.personalBest('Ghost'), 0, 'Non-existent player PB is 0');
  assertEqual(Store.personalBest(''), 0, 'Empty name PB is 0');
  assertEqual(Store.personalBest(null), 0, 'Null name PB is 0');

  // First run: Alice scores 80
  const a1 = Store.submit({ runId: 'a1', name: 'Alice', score: 80, coins: 2 });
  assertEqual(a1.isPersonalBest, true, '80 is personal best');
  assertEqual(a1.personalBest, 80, 'PB is 80');

  // Case-insensitive query
  assertEqual(Store.personalBest('Alice'), 80, 'Query "Alice"');
  assertEqual(Store.personalBest('alice'), 80, 'Query "alice"');
  assertEqual(Store.personalBest('ALICE'), 80, 'Query "ALICE"');
  assertEqual(Store.personalBest('  aLiCe  '), 80, 'Query "  aLiCe  "');

  // Second run: Alice scores 60 (lower)
  const a2 = Store.submit({ runId: 'a2', name: 'alice', score: 60, coins: 5 });
  assertEqual(a2.isPersonalBest, false, 'Lower score is not personal best');
  assertEqual(a2.personalBest, 80, 'PB remains 80');

  // Third run: Alice scores 80 (equal)
  const a3 = Store.submit({ runId: 'a3', name: 'ALICE', score: 80, coins: 10 });
  assertEqual(a3.isPersonalBest, false, 'Equal score is not personal best');
  assertEqual(a3.personalBest, 80, 'PB remains 80');

  // Fourth run: Alice scores 140 (higher)
  const a4 = Store.submit({ runId: 'a4', name: 'Alice', score: 140, coins: 4 });
  assertEqual(a4.isPersonalBest, true, 'Higher score is personal best');
  assertEqual(a4.personalBest, 140, 'PB updated to 140');
  assertEqual(Store.personalBest('alice'), 140, 'Stored PB is 140');

  // Verify corrupt gestureRider.v1.pb falls back gracefully
  fakeStorage.setItem('gestureRider.v1.pb', 'corrupt-pb-json{');
  assertEqual(Store.personalBest('Alice'), 140, 'Falls back to leaderboard score when pb json is corrupt');
});

// Suite 8: Organizer Reset
runTest('Reset clears all leaderboard, personal bests, and runId tracking', () => {
  Store.submit({ runId: 'reset-1', name: 'Player1', score: 100, coins: 5 });
  Store.submit({ runId: 'reset-2', name: 'Player2', score: 200, coins: 10 });

  assertEqual(Store.load().length, 2, 'Leaderboard has 2 entries before reset');
  assertEqual(Store.personalBest('Player1'), 100, 'Player1 PB exists before reset');

  // Perform reset
  Store.reset();

  assertEqual(Store.load().length, 0, 'Leaderboard is empty after reset');
  assertEqual(Store.personalBest('Player1'), 0, 'Player1 PB is 0 after reset');
  assertEqual(Store.personalBest('Player2'), 0, 'Player2 PB is 0 after reset');

  // Verify previously used runId can be submitted again after reset
  const resubmit = Store.submit({ runId: 'reset-1', name: 'Player1', score: 300, coins: 8 });
  assertEqual(resubmit.rank, 1, 'Previously submitted runId works after reset');
  assertEqual(resubmit.personalBest, 300, 'New personal best registered');
  assertEqual(Store.load().length, 1, 'Leaderboard has 1 entry');
});

// Suite 9: Input sanitization
runTest('Input sanitization during submit', () => {
  // 1. Name trimming and truncation (max 12 chars)
  const s1 = Store.submit({
    runId: 's1',
    name: '  LongName1234567890  ',
    score: 50,
    coins: 2,
    subject: 'python'
  });
  const board1 = Store.load();
  assertEqual(board1[0].name, 'LongName1234', 'Name trimmed and capped at 12 characters');

  // 2. Default name "Rider" when empty, whitespace, or missing
  Store.submit({ runId: 's2', name: '   ', score: 40, coins: 1, subject: 'html' });
  Store.submit({ runId: 's3', name: null, score: 30, coins: 1, subject: 'css' });
  const board2 = Store.load();
  assertEqual(board2[1].name, 'Rider', 'Whitespace name defaults to "Rider"');
  assertEqual(board2[2].name, 'Rider', 'Null name defaults to "Rider"');

  // 3. Negative and float numbers sanitized to finite integers >= 0
  Store.submit({
    runId: 's4',
    name: 'MathCheck',
    score: 25.9,
    coins: -5,
    answered: 3.7,
    correct: -2,
    timeouts: '1',
    finished: true,
    subject: 'maths'
  });
  const mathEntry = Store.load().find(e => e.name === 'MathCheck');
  assert(!!mathEntry, 'MathCheck entry found');
  assertEqual(mathEntry.score, 25, 'Score floored to 25');
  assertEqual(mathEntry.coins, 0, 'Negative coins clamped to 0');
  assertEqual(mathEntry.answered, 3, 'Answered floored to 3');
  assertEqual(mathEntry.correct, 0, 'Negative correct clamped to 0');
  assertEqual(mathEntry.timeouts, 1, 'Parsed string timeouts to 1');

  // 4. Subject sanitized to allowed values or defaults to python
  Store.submit({ runId: 's5', name: 'SubjCheck1', score: 10, coins: 0, subject: 'HTML' });
  Store.submit({ runId: 's6', name: 'SubjCheck2', score: 5, coins: 0, subject: 'invalid_subj' });
  const subj1 = Store.load().find(e => e.name === 'SubjCheck1');
  const subj2 = Store.load().find(e => e.name === 'SubjCheck2');
  assertEqual(subj1.subject, 'html', 'Subject normalized to lowercase');
  assertEqual(subj2.subject, 'python', 'Invalid subject defaulted to python');

  // 5. Finished boolean conversion
  assertEqual(subj1.finished, false, 'Missing finished defaults to false');

  // 6. Date is added
  assert(typeof subj1.date === 'string' && subj1.date.length > 0, 'ISO date automatically added');
});

// Suite 10: Correct localStorage keys used
runTest('Correct localStorage keys used', () => {
  Store.submit({ runId: 'k1', name: 'KeyTest', score: 100, coins: 5 });

  const rawBoard = fakeStorage.getItem('gestureRider.v1.leaderboard');
  const rawPB = fakeStorage.getItem('gestureRider.v1.pb');

  assert(rawBoard !== null, 'gestureRider.v1.leaderboard key was written');
  assert(rawPB !== null, 'gestureRider.v1.pb key was written');

  const parsedBoard = JSON.parse(rawBoard);
  assert(Array.isArray(parsedBoard), 'Leaderboard value is a JSON array');
  assertEqual(parsedBoard[0].name, 'KeyTest', 'Leaderboard contains submitted name');

  const parsedPB = JSON.parse(rawPB);
  assertEqual(parsedPB['keytest'], 100, 'PB object contains lowercase key with score');
});

// Final Summary
console.log('\n========================================');
console.log(`Test Results: ${passedTests} passed, ${failedTests} failed (${totalTests} total assertions)`);
console.log('========================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED!\n');
  process.exit(0);
}
