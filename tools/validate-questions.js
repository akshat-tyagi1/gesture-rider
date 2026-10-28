#!/usr/bin/env node

/**
 * Question Bank Validator for Gesture Rider
 * Validates question schema, tier counts, length limits, option uniqueness,
 * question/id uniqueness, and answer distribution.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SUBJECTS = ['python', 'html', 'css', 'maths'];

const EXPECTED_TIER_COUNTS = {
  easy: 8,
  'easy-medium': 6,
  medium: 6
};

const MAX_QUESTION_LENGTH = 140;
const MAX_OPTION_LENGTH = 50;
const MAX_EXPLAIN_LENGTH = 120;
const MAX_ANSWER_SHARE = 0.40; // 40%

const FORBIDDEN_OPTION_PATTERNS = [
  /all\s+of\s+the\s+above/i,
  /none\s+of\s+the\s+above/i,
  /all\s+above/i,
  /none\s+above/i,
  /both\s+[a-d]\s+and\s+[a-d]/i,
  /all\s+of\s+these/i,
  /none\s+of\s+these/i
];

function isSingleSentence(text) {
  const trimmed = text.trim();
  if (!trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?')) {
    return false;
  }
  // Remove the trailing punctuation mark
  const body = trimmed.slice(0, -1);
  // Check for interior sentence terminators followed by a space and capital letter or word
  // e.g. "Sentence one. Sentence two."
  if (/[.!?]\s+[A-Z0-9]/.test(body)) {
    return false;
  }
  if (trimmed.includes('\n')) {
    return false;
  }
  return true;
}

function runValidation() {
  const baseDir = path.resolve(__dirname, '..');
  const dataDir = path.join(baseDir, 'data');

  let hasErrors = false;
  const errors = [];
  const warnings = [];

  const seenIds = new Map();
  const seenQuestions = new Map();

  const report = {};

  for (const subject of SUBJECTS) {
    const filePath = path.join(dataDir, `questions-${subject}.js`);
    report[subject] = {
      file: `data/questions-${subject}.js`,
      exists: false,
      total: 0,
      tierCounts: { easy: 0, 'easy-medium': 0, medium: 0 },
      answerCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
      answerShares: {},
      errors: []
    };

    if (!fs.existsSync(filePath)) {
      errors.push(`File missing: ${path.relative(baseDir, filePath)}`);
      report[subject].errors.push('File does not exist');
      hasErrors = true;
      continue;
    }

    report[subject].exists = true;

    let code;
    try {
      code = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      errors.push(`Failed to read file ${filePath}: ${err.message}`);
      report[subject].errors.push(`Read error: ${err.message}`);
      hasErrors = true;
      continue;
    }

    const sandbox = {
      window: {}
    };
    try {
      vm.createContext(sandbox);
      vm.runInContext(code, sandbox);
    } catch (err) {
      errors.push(`Syntax/Execution error in ${path.relative(baseDir, filePath)}: ${err.message}`);
      report[subject].errors.push(`Execution error: ${err.message}`);
      hasErrors = true;
      continue;
    }

    const bank = sandbox.window.QUESTION_BANKS && sandbox.window.QUESTION_BANKS[subject];
    if (!Array.isArray(bank)) {
      errors.push(`window.QUESTION_BANKS.${subject} is not an array in ${path.relative(baseDir, filePath)}`);
      report[subject].errors.push(`QUESTION_BANKS.${subject} is not an array`);
      hasErrors = true;
      continue;
    }

    report[subject].total = bank.length;

    bank.forEach((item, index) => {
      const qNum = index + 1;
      const qContext = `${subject} #${qNum} (${item && item.id ? item.id : 'unknown-id'})`;

      if (typeof item !== 'object' || item === null) {
        errors.push(`${qContext}: Item is not an object`);
        return;
      }

      // Check id
      if (typeof item.id !== 'string' || !item.id.trim()) {
        errors.push(`${qContext}: Missing or invalid 'id'`);
      } else {
        if (seenIds.has(item.id)) {
          errors.push(`${qContext}: Duplicate id '${item.id}' (previously seen at ${seenIds.get(item.id)})`);
        } else {
          seenIds.set(item.id, qContext);
        }
      }

      // Check subject
      if (item.subject !== subject) {
        errors.push(`${qContext}: 'subject' field must be '${subject}', found '${item.subject}'`);
      }

      // Check tier
      if (!EXPECTED_TIER_COUNTS[item.tier]) {
        errors.push(`${qContext}: Invalid tier '${item.tier}'`);
      } else {
        report[subject].tierCounts[item.tier] = (report[subject].tierCounts[item.tier] || 0) + 1;
      }

      // Check q
      if (typeof item.q !== 'string' || !item.q.trim()) {
        errors.push(`${qContext}: Missing or empty 'q'`);
      } else {
        if (item.q.length > MAX_QUESTION_LENGTH) {
          errors.push(`${qContext}: 'q' length ${item.q.length} exceeds max ${MAX_QUESTION_LENGTH} chars`);
        }
        const normalizedQ = item.q.trim().toLowerCase();
        if (seenQuestions.has(normalizedQ)) {
          errors.push(`${qContext}: Duplicate question text (previously seen at ${seenQuestions.get(normalizedQ)})`);
        } else {
          seenQuestions.set(normalizedQ, qContext);
        }
      }

      // Check options
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        errors.push(`${qContext}: 'options' must be an array of exactly 4 strings`);
      } else {
        const optionSet = new Set();
        item.options.forEach((opt, optIdx) => {
          if (typeof opt !== 'string' || !opt.trim()) {
            errors.push(`${qContext}: Option ${optIdx} is not a non-empty string`);
          } else {
            if (opt.length > MAX_OPTION_LENGTH) {
              errors.push(`${qContext}: Option ${optIdx} length ${opt.length} exceeds max ${MAX_OPTION_LENGTH} chars`);
            }
            const normalizedOpt = opt.trim().toLowerCase();
            if (optionSet.has(normalizedOpt)) {
              errors.push(`${qContext}: Duplicate option text '${opt}' at index ${optIdx}`);
            }
            optionSet.add(normalizedOpt);

            FORBIDDEN_OPTION_PATTERNS.forEach((pattern) => {
              if (pattern.test(opt)) {
                errors.push(`${qContext}: Option '${opt}' violates rule against all/none of the above`);
              }
            });
          }
        });
      }

      // Check answer
      if (typeof item.answer !== 'number' || !Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) {
        errors.push(`${qContext}: 'answer' must be an integer between 0 and 3, found ${item.answer}`);
      } else {
        report[subject].answerCounts[item.answer] = (report[subject].answerCounts[item.answer] || 0) + 1;
      }

      // Check explain
      if (typeof item.explain !== 'string' || !item.explain.trim()) {
        errors.push(`${qContext}: Missing or empty 'explain'`);
      } else {
        if (item.explain.length > MAX_EXPLAIN_LENGTH) {
          errors.push(`${qContext}: 'explain' length ${item.explain.length} exceeds max ${MAX_EXPLAIN_LENGTH} chars`);
        }
        if (!isSingleSentence(item.explain)) {
          errors.push(`${qContext}: 'explain' must be a single sentence ending with punctuation`);
        }
      }
    });

    // Check tier counts
    for (const [tier, expected] of Object.entries(EXPECTED_TIER_COUNTS)) {
      const actual = report[subject].tierCounts[tier] || 0;
      if (actual !== expected) {
        errors.push(`Subject '${subject}': Expected ${expected} '${tier}' questions, found ${actual}`);
      }
    }

    // Check answer distribution
    const totalQ = report[subject].total;
    if (totalQ > 0) {
      for (let ansIdx = 0; ansIdx < 4; ansIdx++) {
        const count = report[subject].answerCounts[ansIdx] || 0;
        const share = count / totalQ;
        report[subject].answerShares[ansIdx] = (share * 100).toFixed(1) + '%';
        if (share > MAX_ANSWER_SHARE) {
          errors.push(`Subject '${subject}': Answer index ${ansIdx} occurs ${count}/${totalQ} times (${(share * 100).toFixed(1)}%), exceeding max 40%`);
        }
      }
    }
  }

  // Print results
  console.log('====================================================');
  console.log('       GESTURE RIDER QUESTION BANK VALIDATOR        ');
  console.log('====================================================\n');

  SUBJECTS.forEach((subject) => {
    const r = report[subject];
    console.log(`[Subject: ${subject.toUpperCase()}] (${r.file})`);
    console.log(`  Total Questions: ${r.total}`);
    console.log(`  Tier Counts: easy=${r.tierCounts.easy || 0}/8, easy-medium=${r.tierCounts['easy-medium'] || 0}/6, medium=${r.tierCounts.medium || 0}/6`);
    console.log(`  Answer Distribution: [0]: ${r.answerCounts[0] || 0} (${r.answerShares[0] || '0%'}), [1]: ${r.answerCounts[1] || 0} (${r.answerShares[1] || '0%'}), [2]: ${r.answerCounts[2] || 0} (${r.answerShares[2] || '0%'}), [3]: ${r.answerCounts[3] || 0} (${r.answerShares[3] || '0%'})`);
    console.log('');
  });

  console.log(`Total questions across all banks: ${seenIds.size}`);
  console.log('----------------------------------------------------');

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  }

  if (errors.length > 0) {
    console.log(`\nVALIDATION FAILED (${errors.length} errors):`);
    errors.forEach((e) => console.log(`  - ${e}`));
    console.log('\nResult: FAIL');
    process.exit(1);
  } else {
    console.log('\nAll checks PASSED! Schema, counts, lengths, and distributions are valid.');
    console.log('Result: PASS');
    process.exit(0);
  }
}

runValidation();
