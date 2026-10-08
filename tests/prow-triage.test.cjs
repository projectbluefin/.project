const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isTriager } = require('../scripts/prow-triage.cjs');

const roster = {
  maintainers: [{
    project_id: 'bluefin',
    org: 'projectbluefin',
    teams: [
      { name: 'project-maintainers', members: ['maintainer'] },
      { name: 'triage', members: ['ximian', 'Raindrac', 'repires', 'jumpyvi'] },
      { name: 'reviewers', members: ['reviewer'] },
      { name: 'hplip-printer-app-triage', members: ['jfmongrain'] },
    ],
  }],
};
const comment = (login, type = 'User') => ({ comment: { user: { login, type } } });

test('triage members and maintainers can change restricted labels', () => {
  for (const login of ['ximian', 'Raindrac', 'repires', 'jumpyvi', 'maintainer']) {
    assert.equal(isTriager(comment(login), roster), true, login);
  }
});

test('GitHub handles are matched case-insensitively', () => {
  assert.equal(isTriager(comment('RAINDRAC'), roster), true);
});

test('nonmembers and unrelated roles cannot change restricted labels', () => {
  for (const login of ['contributor', 'reviewer']) {
    assert.equal(isTriager(comment(login), roster), false);
  }
});

test('authorization uses the comment author, not the sender or claimed text', () => {
  const event = comment('contributor');
  event.sender = { login: 'maintainer', type: 'User' };
  event.comment.body = '@maintainer /triage accepted';
  assert.equal(isTriager(event, roster), false);
});

test('bots cannot inherit a human roster entry', () => {
  assert.equal(isTriager(comment('maintainer', 'Bot'), roster), false);
});

test('a different organization or project cannot grant access', () => {
  for (const override of [{ org: 'elsewhere' }, { project_id: 'elsewhere' }]) {
    const foreign = { maintainers: [{ ...roster.maintainers[0], ...override }] };
    assert.throws(() => isTriager(comment('ximian'), foreign));
  }
});

test('missing or malformed required teams fail closed', () => {
  for (const malformed of [
    {},
    { maintainers: [] },
    { maintainers: [{ ...roster.maintainers[0], teams: [] }] },
    { maintainers: [{ ...roster.maintainers[0], teams: [
      roster.maintainers[0].teams[0], { name: 'triage', members: 'everyone' },
    ] }] },
    { maintainers: [{ ...roster.maintainers[0], teams: [
      roster.maintainers[0].teams[0], { name: 'triage', members: [42] },
    ] }] },
  ]) {
    assert.throws(() => isTriager(comment('ximian'), malformed));
  }
});

test('HPLIP triagers can act only in the HPLIP repository', () => {
  const event = comment('jfmongrain');
  event.repository = { full_name: 'projectbluefin/hplip-printer-app' };
  assert.equal(isTriager(event, roster), true);
  for (const full_name of ['projectbluefin/common', 'another-org/hplip-printer-app']) {
    event.repository.full_name = full_name;
    assert.equal(isTriager(event, roster), false, full_name);
  }
  delete event.repository;
  assert.equal(isTriager(event, roster), false);
});

test('a scoped team does not replace organization-wide triagers', () => {
  const event = comment('ximian');
  event.repository = { full_name: 'projectbluefin/hplip-printer-app' };
  assert.equal(isTriager(event, roster), true);
});

test('malformed scoped rosters fail validation even without a repository event', () => {
  const invalid = structuredClone(roster);
  invalid.maintainers[0].teams.find((team) => team.name === 'hplip-printer-app-triage').members = [42];
  assert.throws(() => isTriager(comment('maintainer'), invalid));
});
