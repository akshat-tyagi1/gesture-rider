#!/usr/bin/env node

/**
 * tools/test-quiz.js — Test suite for Quiz module
 *
 * Covers:
 * 1. Missing bank & invalid inputs error handling (empty, invalid list, missing banks)
 * 2. Legacy string input and multi-subject array initialization (run.subjects)
 * 3. Correct tier per checkpoint (and nearest-tier fallback)
 * 4. Mixed runs, round-robin use of subjects, no same subject twice in a row
 * 5. No repeats within a run & exhausting bank with real bank size
 * 6. Shuffled answerIndex always points to the right text
 * 7. timeLimit for maths (25s) vs others (15s) per question in single & mixed runs
 * 8. Stats calculation, including early game over (2 answered)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const baseDir = path.resolve(__dirname, '..');
const dataDir = path.join(baseDir, 'data');
const SUBJECTS = ['python', 'html', 'css', 'maths'];

/**
 * Sets up a clean VM context loading the question files and quiz.js
 */
function createQuizContext() {
  const sandbox = {
    window: {},
    console: console
  };
  vm.createContext(sandbox);

  for (const subject of SUBJECTS) {
    const filePath = path.join(dataDir, `questions-${subject}.js`);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, sandbox);
  }

  const quizPath = path.join(baseDir, 'quiz.js');
  const quizCode = fs.readFileSync(quizPath, 'utf8');
  vm.runInContext(quizCode, sandbox);

  return {
    sandbox,
    Quiz: sandbox.window.Quiz || sandbox.Quiz,
    QUESTION_BANKS: sandbox.window.QUESTION_BANKS
  };
}

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

function assertStatsEqual(actual, expected) {
  assert.strictEqual(actual.answered, expected.answered, `answered expected ${expected.answered}, got ${actual.answered}`);
  assert.strictEqual(actual.correct, expected.correct, `correct expected ${expected.correct}, got ${actual.correct}`);
  assert.strictEqual(actual.wrong, expected.wrong, `wrong expected ${expected.wrong}, got ${actual.wrong}`);
  assert.strictEqual(actual.timeouts, expected.timeouts, `timeouts expected ${expected.timeouts}, got ${actual.timeouts}`);
  assert.strictEqual(actual.accuracyPct, expected.accuracyPct, `accuracyPct expected ${expected.accuracyPct}, got ${actual.accuracyPct}`);
}

console.log('====================================================');
console.log('            GESTURE RIDER QUIZ TEST SUITE           ');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. Missing bank & invalid inputs error handling
// ----------------------------------------------------
console.log('[Suite 1: Missing Bank & Invalid Input Errors]');
test('throws clear error when subject does not exist in QUESTION_BANKS', () => {
  const { Quiz } = createQuizContext();
  assert.throws(
    () => Quiz.startRun('nonexistent_subject'),
    /Question bank for subject "nonexistent_subject" is missing/
  );
});

test('throws clear error when subject is null or empty', () => {
  const { Quiz } = createQuizContext();
  assert.throws(
    () => Quiz.startRun(''),
    /Subject must be a non-empty string/
  );
  assert.throws(
    () => Quiz.startRun(null),
    /Subject must be a non-empty string/
  );
});

test('throws clear error when QUESTION_BANKS is undefined on window', () => {
  const emptySandbox = { window: {} };
  vm.createContext(emptySandbox);
  const quizPath = path.join(baseDir, 'quiz.js');
  vm.runInContext(fs.readFileSync(quizPath, 'utf8'), emptySandbox);
  const Quiz = emptySandbox.window.Quiz;

  assert.throws(
    () => Quiz.startRun('python'),
    /window\.QUESTION_BANKS is missing/
  );
});

test('throws clear error for invalid lists: empty, >4, duplicates, invalid subjects, non-strings', () => {
  const { Quiz } = createQuizContext();

  // Empty list
  assert.throws(() => Quiz.startRun([]), /Subjects list cannot be empty/);

  // >4 subjects
  assert.throws(
    () => Quiz.startRun(['python', 'html', 'css', 'maths', 'python']),
    /more than 4 subjects/
  );

  // Duplicates in list
  assert.throws(
    () => Quiz.startRun(['python', 'python']),
    /Duplicate subject in list/
  );

  // Invalid subject name in list
  assert.throws(
    () => Quiz.startRun(['python', 'ruby']),
    /Invalid subject: "ruby"/
  );

  // Non-string in list
  assert.throws(
    () => Quiz.startRun(['python', 123]),
    /Invalid subject in list/
  );

  // Non-string, non-array inputs
  assert.throws(
    () => Quiz.startRun(123),
    /Subject must be a non-empty string or an array/
  );
  assert.throws(
    () => Quiz.startRun({ subject: 'python' }),
    /Subject must be a non-empty string or an array/
  );
});

// ----------------------------------------------------
// 2. Legacy string input & multi-subject initialization
// ----------------------------------------------------
console.log('\n[Suite 2: Legacy String Input & run.subjects]');
test('accepts legacy string input and initializes run.subjects', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun('python');
  assert.ok(Array.isArray(run.subjects), 'run.subjects should be an array');
  assert.deepStrictEqual(Array.from(run.subjects), ['python']);
  assert.strictEqual(run.subject, 'python');
});

test('accepts array of 1-4 distinct valid subjects and initializes run.subjects', () => {
  const { Quiz } = createQuizContext();
  const run1 = Quiz.startRun(['html']);
  assert.deepStrictEqual(Array.from(run1.subjects), ['html']);

  const run2 = Quiz.startRun(['python', 'maths']);
  assert.deepStrictEqual(Array.from(run2.subjects), ['python', 'maths']);

  const run4 = Quiz.startRun(['python', 'html', 'css', 'maths']);
  assert.deepStrictEqual(Array.from(run4.subjects), ['python', 'html', 'css', 'maths']);
});

// ----------------------------------------------------
// 3. Correct tier per checkpoint & tier fallback
// ----------------------------------------------------
console.log('\n[Suite 3: Correct Tier Per Checkpoint]');
test('CP1 and CP2 return easy, CP3 returns easy-medium, CP4 returns medium across subjects', () => {
  const { Quiz } = createQuizContext();

  const expectedTiers = {
    1: 'easy',
    2: 'easy',
    3: 'easy-medium',
    4: 'medium'
  };

  for (const subject of SUBJECTS) {
    for (let runIdx = 0; runIdx < 10; runIdx++) {
      const run = Quiz.startRun(subject);
      for (let cp = 1; cp <= 4; cp++) {
        const q = run.nextQuestion(cp);
        assert.strictEqual(
          q.tier,
          expectedTiers[cp],
          `Subject ${subject} CP${cp} expected tier ${expectedTiers[cp]}, got ${q.tier}`
        );
      }
    }
  }
});

test('falls back to nearest tier when target tier is exhausted', () => {
  const { sandbox, Quiz } = createQuizContext();

  // Custom bank with only 1 easy question, 2 easy-medium, 1 medium
  sandbox.window.QUESTION_BANKS.test_fallback = [
    { id: 't-e-1', subject: 'test_fallback', tier: 'easy', q: 'E1', options: ['1','2','3','4'], answer: 0, explain: 'Exp' },
    { id: 't-em-1', subject: 'test_fallback', tier: 'easy-medium', q: 'EM1', options: ['1','2','3','4'], answer: 0, explain: 'Exp' },
    { id: 't-em-2', subject: 'test_fallback', tier: 'easy-medium', q: 'EM2', options: ['1','2','3','4'], answer: 0, explain: 'Exp' },
    { id: 't-m-1', subject: 'test_fallback', tier: 'medium', q: 'M1', options: ['1','2','3','4'], answer: 0, explain: 'Exp' }
  ];

  const run = Quiz.startRun('test_fallback');
  const q1 = run.nextQuestion(1); // CP1: easy (uses t-e-1)
  assert.strictEqual(q1.tier, 'easy');
  assert.strictEqual(q1.id, 't-e-1');

  // Easy tier is now empty! CP2 (targets easy) must fall back to nearest tier: easy-medium
  const q2 = run.nextQuestion(2);
  assert.strictEqual(q2.tier, 'easy-medium', 'CP2 must fall back to nearest tier easy-medium');

  // CP4 (targets medium) gets medium
  const q4 = run.nextQuestion(4);
  assert.strictEqual(q4.tier, 'medium');
  assert.strictEqual(q4.id, 't-m-1');
});

// ----------------------------------------------------
// 4. Mixed runs, round-robin subjects, no same subject twice in a row
// ----------------------------------------------------
console.log('\n[Suite 4: Mixed Runs, Round-Robin & No Repeated Subject In A Row]');
test('4-subject run uses each subject once across 4 checkpoints and includes subject in result', () => {
  const { Quiz } = createQuizContext();

  for (let runIdx = 0; runIdx < 20; runIdx++) {
    const run = Quiz.startRun(['python', 'html', 'css', 'maths']);
    const pickedSubjects = [];

    for (let cp = 1; cp <= 4; cp++) {
      const q = run.nextQuestion(cp);
      assert.ok(q.subject, 'Returned question must include subject property');
      assert.ok(['python', 'html', 'css', 'maths'].includes(q.subject));
      pickedSubjects.push(q.subject);
    }

    // In a 4-checkpoint run with 4 subjects, each subject must be picked exactly once
    assert.strictEqual(pickedSubjects.length, 4);
    const unique = new Set(pickedSubjects);
    assert.strictEqual(unique.size, 4, `All 4 subjects must be used once before repeating. Got: ${pickedSubjects.join(', ')}`);
  }
});

test('never picks the same subject as the previous checkpoint when > 1 subject', () => {
  const { Quiz } = createQuizContext();

  // Test across multiple subject counts (2, 3, 4 subjects) over 8 checkpoints
  const configs = [
    ['python', 'maths'],
    ['python', 'html', 'css'],
    ['python', 'html', 'css', 'maths']
  ];

  for (const subjects of configs) {
    for (let r = 0; r < 20; r++) {
      const run = Quiz.startRun(subjects);
      let prevSubject = null;

      for (let i = 0; i < 8; i++) {
        const cp = (i % 4) + 1;
        const q = run.nextQuestion(cp);
        if (prevSubject !== null) {
          assert.notStrictEqual(
            q.subject,
            prevSubject,
            `Subject "${q.subject}" repeated consecutive at step ${i} for subjects [${subjects.join(', ')}]`
          );
        }
        prevSubject = q.subject;
      }
    }
  }
});

test('uses each selected subject once before any repeats across cycles', () => {
  const { Quiz } = createQuizContext();

  // 2 subjects over 8 questions -> cycle length 2
  for (let r = 0; r < 10; r++) {
    const run = Quiz.startRun(['html', 'css']);
    const questions = [];
    for (let i = 0; i < 8; i++) {
      questions.push(run.nextQuestion((i % 4) + 1));
    }

    for (let cycle = 0; cycle < 4; cycle++) {
      const c1 = questions[cycle * 2].subject;
      const c2 = questions[cycle * 2 + 1].subject;
      assert.notStrictEqual(c1, c2, `Cycle ${cycle} must contain both subjects once`);
      const set = new Set([c1, c2]);
      assert.ok(set.has('html') && set.has('css'));
    }
  }
});

// ----------------------------------------------------
// 5. No repeats in a run & bank exhaustion with real size
// ----------------------------------------------------
console.log('\n[Suite 5: No Repeats in a Run]');
test('a 4-checkpoint run never picks the same question twice', () => {
  const { Quiz } = createQuizContext();

  for (const subject of SUBJECTS) {
    for (let i = 0; i < 20; i++) {
      const run = Quiz.startRun(subject);
      const seenIds = new Set();
      for (let cp = 1; cp <= 4; cp++) {
        const q = run.nextQuestion(cp);
        assert.ok(!seenIds.has(q.id), `Duplicate question ${q.id} seen in ${subject} run`);
        seenIds.add(q.id);
      }
      assert.strictEqual(seenIds.size, 4);
    }
  }
});

test('exhausting all questions in a subject yields unique questions using real bank size', () => {
  const { Quiz, QUESTION_BANKS } = createQuizContext();
  const bankSize = QUESTION_BANKS.python.length;
  assert.ok(bankSize >= 20, `Real bank size must be at least 20, found ${bankSize}`);

  const run = Quiz.startRun('python');
  const seenIds = new Set();

  for (let i = 0; i < bankSize; i++) {
    const cp = (i % 4) + 1;
    const q = run.nextQuestion(cp);
    assert.ok(!seenIds.has(q.id), `Duplicate question ${q.id} picked at step ${i}`);
    seenIds.add(q.id);
  }
  assert.strictEqual(seenIds.size, bankSize, `Expected ${bankSize} unique questions`);

  // Next question must throw since all questions in the bank are used
  assert.throws(
    () => run.nextQuestion(1),
    /No available questions remaining/
  );

  // New run starts fresh with all questions available
  const freshRun = Quiz.startRun('python');
  assert.doesNotThrow(() => freshRun.nextQuestion(1));
});

// ----------------------------------------------------
// 6. Shuffled answerIndex always points to the right text
// ----------------------------------------------------
console.log('\n[Suite 6: Shuffled answerIndex]');
test('shuffled answerIndex always points to the exact correct answer text', () => {
  const { Quiz, QUESTION_BANKS } = createQuizContext();

  const answerIndexCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let totalSampled = 0;

  for (const subject of SUBJECTS) {
    const bank = QUESTION_BANKS[subject];
    for (let r = 0; r < 25; r++) {
      const run = Quiz.startRun(subject);
      for (let cp = 1; cp <= 4; cp++) {
        const q = run.nextQuestion(cp);
        const original = bank.find(item => item.id === q.id);
        assert.ok(original, `Original question ${q.id} not found in bank`);

        const expectedText = original.options[original.answer];
        const actualText = q.options[q.answerIndex];

        assert.strictEqual(
          actualText,
          expectedText,
          `Question ${q.id}: options[answerIndex] ('${actualText}') must equal original answer ('${expectedText}')`
        );

        // Options must be a complete permutation of the 4 original options
        assert.strictEqual(q.options.length, 4);
        for (const opt of original.options) {
          assert.ok(q.options.includes(opt), `Missing original option '${opt}' in shuffled options`);
        }

        answerIndexCounts[q.answerIndex]++;
        totalSampled++;
      }
    }
  }

  // Ensure answerIndex is actually shuffled and covers all 4 positions
  for (let i = 0; i < 4; i++) {
    assert.ok(
      answerIndexCounts[i] > 0,
      `answerIndex ${i} was never produced across ${totalSampled} samples`
    );
  }
});

// ----------------------------------------------------
// 7. TimeLimit for maths (25s) vs others (15s) per question
// ----------------------------------------------------
console.log('\n[Suite 7: timeLimit Maths vs Others Per Question]');
test('timeLimit is 25 for maths and 15 for python, html, css in single subject runs', () => {
  const { Quiz } = createQuizContext();

  for (const subject of SUBJECTS) {
    const run = Quiz.startRun(subject);
    for (let cp = 1; cp <= 4; cp++) {
      const q = run.nextQuestion(cp);
      const expectedTimeLimit = subject === 'maths' ? 25 : 15;
      assert.strictEqual(
        q.timeLimit,
        expectedTimeLimit,
        `Expected timeLimit ${expectedTimeLimit} for subject '${subject}', got ${q.timeLimit}`
      );
    }
  }
});

test('timeLimit is 25 for maths and 15 for others in the SAME mixed run', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun(['python', 'maths']);

  for (let i = 1; i <= 6; i++) {
    const q = run.nextQuestion((i % 4) || 4);
    if (q.subject === 'maths') {
      assert.strictEqual(q.timeLimit, 25, 'Maths question must have timeLimit 25');
    } else {
      assert.strictEqual(q.timeLimit, 15, 'Non-maths question must have timeLimit 15');
    }
  }
});

// ----------------------------------------------------
// 8. Stats calculations & early game over
// ----------------------------------------------------
console.log('\n[Suite 8: Stats After Early Game Over & Calculations]');
test('stats after early game over with 1 correct and 1 wrong (2 answered)', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun('python');

  // Checkpoint 1: correct
  run.nextQuestion(1);
  run.record('correct');

  // Checkpoint 2: wrong
  run.nextQuestion(2);
  run.record('wrong');

  // Player crashes and gets WASTED; checkpoints 3 and 4 never reached
  const stats = run.stats();
  assertStatsEqual(stats, {
    answered: 2,
    correct: 1,
    wrong: 1,
    timeouts: 0,
    accuracyPct: 50
  });
});

test('stats after early game over with 1 correct and 1 timeout (2 answered)', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun('html');

  run.nextQuestion(1);
  run.record('correct');

  run.nextQuestion(2);
  run.record('timeout');

  const stats = run.stats();
  assertStatsEqual(stats, {
    answered: 2,
    correct: 1,
    wrong: 0,
    timeouts: 1,
    accuracyPct: 50
  });
});

test('stats with 0 answered returns accuracyPct = 0 without error', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun('css');

  const stats = run.stats();
  assertStatsEqual(stats, {
    answered: 0,
    correct: 0,
    wrong: 0,
    timeouts: 0,
    accuracyPct: 0
  });
});

test('stats for full 4-checkpoint run (3 correct, 1 wrong = 75%)', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun('maths');

  run.record('correct');
  run.record('correct');
  run.record('wrong');
  run.record('correct');

  const stats = run.stats();
  assertStatsEqual(stats, {
    answered: 4,
    correct: 3,
    wrong: 1,
    timeouts: 0,
    accuracyPct: 75
  });
});

test('rejects invalid record results', () => {
  const { Quiz } = createQuizContext();
  const run = Quiz.startRun('python');

  assert.throws(
    () => run.record('invalid_result'),
    /Invalid quiz result/
  );
});

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log('\n----------------------------------------------------');
console.log(`Summary: ${passed}/${total} tests passed.`);
console.log('Result: PASS');
console.log('====================================================');
