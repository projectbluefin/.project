const assert = require('node:assert/strict');
const { test } = require('node:test');
const { transferTarget } = require('../scripts/prow-transfer.cjs');

const comment = (body, repo = 'dakota', isPr = false) => ({
  repository: { name: repo, full_name: `projectbluefin/${repo}` },
  comment: { body },
  issue: isPr ? { pull_request: {} } : {},
});

test('parses plain repository name', () => {
  assert.equal(transferTarget(comment('/transfer dakota-iso')), 'dakota-iso');
});

test('parses projectbluefin-qualified repository name', () => {
  assert.equal(transferTarget(comment('/transfer projectbluefin/dakota-iso')), 'dakota-iso');
  assert.equal(transferTarget(comment('/transfer ProjectBluefin/dakota-iso')), 'dakota-iso');
});

test('accepts the Prow /transfer-issue alias', () => {
  assert.equal(transferTarget(comment('/transfer-issue dakota-iso')), 'dakota-iso');
});

test('ignores comments without a transfer command', () => {
  assert.equal(transferTarget(comment('please transfer this to dakota-iso')), null);
  assert.equal(transferTarget(comment('/kind bug')), null);
});

test('finds command surrounded by other text on separate lines', () => {
  const body = 'Moving this to the right repo.\n\n/transfer dakota-iso\n\nThanks!';
  assert.equal(transferTarget(comment(body)), 'dakota-iso');
});

test('rejects missing argument', () => {
  assert.throws(() => transferTarget(comment('/transfer')), /usage: \/transfer <repository>/);
  assert.throws(() => transferTarget(comment('/transfer   ')), /usage: \/transfer <repository>/);
});

test('rejects cross-organization transfer targets', () => {
  assert.throws(
    () => transferTarget(comment('/transfer ublue-os/main')),
    /usage: \/transfer <repository> \(a projectbluefin repository\)/,
  );
});

test('rejects transferring to the current repository', () => {
  assert.throws(
    () => transferTarget(comment('/transfer dakota', 'dakota')),
    /the issue is already in this repository/,
  );
  assert.throws(
    () => transferTarget(comment('/transfer DAKOTA', 'dakota')),
    /the issue is already in this repository/,
  );
});

test('rejects pull requests', () => {
  assert.throws(
    () => transferTarget(comment('/transfer dakota-iso', 'dakota', true)),
    /pull requests cannot be transferred/,
  );
});

test('rejects invalid repository characters', () => {
  assert.throws(() => transferTarget(comment('/transfer dakota;rm')), /invalid repository name/);
  assert.throws(() => transferTarget(comment('/transfer ..')), /invalid repository name/);
});
