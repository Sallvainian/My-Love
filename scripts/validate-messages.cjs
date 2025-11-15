/**
 * Message Library Validation Script
 * Validates 365-message library for:
 * - Total count (365 messages)
 * - Category distribution (73 per category)
 * - No duplicate messages
 * - Valid category values
 */

const fs = require('fs');
const path = require('path');

// Read the defaultMessages.ts file
const messagesPath = path.join(__dirname, '../src/data/defaultMessages.ts');
const fileContent = fs.readFileSync(messagesPath, 'utf8');

// Extract message objects using regex
// Match { text: "...", category: '...', isFavorite: false }
const messageRegex =
  /\{\s*text:\s*"([^"]+)"\s*,\s*category:\s*'(\w+)'\s*,\s*isFavorite:\s*(true|false)\s*\}/g;
const messages = [];
let match;

while ((match = messageRegex.exec(fileContent)) !== null) {
  messages.push({
    text: match[1],
    category: match[2],
    isFavorite: match[3] === 'true',
  });
}

console.log('='.repeat(60));
console.log('MESSAGE LIBRARY VALIDATION');
console.log('='.repeat(60));
console.log();

// 1. Total Count Check
console.log('1. TOTAL COUNT');
console.log(`   Expected: 365 messages`);
console.log(`   Found: ${messages.length} messages`);
if (messages.length === 365) {
  console.log('   ✅ PASS: Exactly 365 messages');
} else {
  console.log(`   ❌ FAIL: Expected 365, got ${messages.length} (diff: ${messages.length - 365})`);
}
console.log();

// 2. Category Distribution Check
console.log('2. CATEGORY DISTRIBUTION');
const categoryCount = messages.reduce((acc, msg) => {
  acc[msg.category] = (acc[msg.category] || 0) + 1;
  return acc;
}, {});

const expectedPerCategory = 73;
let categoryPass = true;

Object.entries(categoryCount).forEach(([cat, count]) => {
  const percentage = ((count / messages.length) * 100).toFixed(1);
  const status = count === expectedPerCategory ? '✅' : '❌';
  console.log(`   ${status} ${cat}: ${count} (${percentage}%) - Expected: ${expectedPerCategory}`);
  if (count !== expectedPerCategory) categoryPass = false;
});

if (categoryPass) {
  console.log('   ✅ PASS: All categories have exactly 73 messages');
} else {
  console.log('   ❌ FAIL: Category distribution imbalanced');
}
console.log();

// 3. Valid Categories Check
console.log('3. VALID CATEGORIES');
const validCategories = ['reason', 'memory', 'affirmation', 'future', 'custom'];
const invalidCategories = Object.keys(categoryCount).filter(
  (cat) => !validCategories.includes(cat)
);

if (invalidCategories.length === 0) {
  console.log(`   ✅ PASS: All categories are valid`);
  console.log(`   Valid categories: ${validCategories.join(', ')}`);
} else {
  console.log(`   ❌ FAIL: Invalid categories found: ${invalidCategories.join(', ')}`);
}
console.log();

// 4. Duplicate Detection
console.log('4. DUPLICATE DETECTION');
const textMap = new Map();
const duplicates = [];

messages.forEach((msg, index) => {
  const normalizedText = msg.text.toLowerCase().trim();
  if (textMap.has(normalizedText)) {
    duplicates.push({
      text: msg.text,
      firstIndex: textMap.get(normalizedText),
      duplicateIndex: index,
    });
  } else {
    textMap.set(normalizedText, index);
  }
});

if (duplicates.length === 0) {
  console.log('   ✅ PASS: No duplicate messages found');
} else {
  console.log(`   ❌ FAIL: ${duplicates.length} duplicate(s) found:`);
  duplicates.forEach((dup) => {
    console.log(`      - "${dup.text.substring(0, 50)}..."`);
    console.log(`        First at index ${dup.firstIndex}, duplicate at ${dup.duplicateIndex}`);
  });
}
console.log();

// 5. Message Length Distribution
console.log('5. MESSAGE LENGTH DISTRIBUTION');
const lengths = {
  short: 0, // 50-150 chars
  medium: 0, // 150-250 chars
  long: 0, // 250+ chars
};

messages.forEach((msg) => {
  const len = msg.text.length;
  if (len >= 50 && len <= 150) lengths.short++;
  else if (len > 150 && len <= 250) lengths.medium++;
  else if (len > 250) lengths.long++;
});

const shortPct = ((lengths.short / messages.length) * 100).toFixed(1);
const mediumPct = ((lengths.medium / messages.length) * 100).toFixed(1);
const longPct = ((lengths.long / messages.length) * 100).toFixed(1);

console.log(`   Short (50-150 chars): ${lengths.short} (${shortPct}%) - Target: 80%`);
console.log(`   Medium (150-250 chars): ${lengths.medium} (${mediumPct}%) - Target: 15%`);
console.log(`   Long (250+ chars): ${lengths.long} (${longPct}%) - Target: 5%`);

const lengthPass = shortPct >= 70 && mediumPct >= 10 && longPct >= 3;
if (lengthPass) {
  console.log('   ✅ PASS: Length distribution roughly matches targets');
} else {
  console.log('   ⚠️  WARNING: Length distribution may be off-target');
}
console.log();

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

const allPassed =
  messages.length === 365 &&
  categoryPass &&
  invalidCategories.length === 0 &&
  duplicates.length === 0;

if (allPassed) {
  console.log('✅ ALL VALIDATIONS PASSED');
  console.log('');
  console.log('The message library is ready for deployment!');
  process.exit(0);
} else {
  console.log('❌ SOME VALIDATIONS FAILED');
  console.log('');
  console.log('Please review and fix the issues above.');
  process.exit(1);
}
