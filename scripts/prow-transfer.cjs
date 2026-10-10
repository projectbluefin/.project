const { readFileSync } = require('node:fs');

const COMMAND = /^\/transfer(?:-issue)?(?:\s+(\S+))?\s*$/;

// Returns the target repository name for a `/transfer <repo>` comment, or null when the
// comment holds no transfer command. Throws on a command that cannot be honored.
function transferTarget(event) {
  const lines = String(event.comment?.body ?? '').split(/\r?\n/);
  const match = lines.map((line) => line.trim().match(COMMAND)).find(Boolean);
  if (!match) return null;
  if (event.issue?.pull_request) throw new Error('pull requests cannot be transferred');
  const [owner, name, extra] = (match[1] ?? '').split('/').reverse().reverse();
  const repo = extra === undefined && name !== undefined ? name : owner;
  if (!match[1] || extra !== undefined || (name !== undefined && owner.toLowerCase() !== 'projectbluefin')) {
    throw new Error('usage: /transfer <repository> (a projectbluefin repository)');
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(repo) || /^\.+$/.test(repo)) {
    throw new Error(`invalid repository name: ${repo}`);
  }
  if (repo.toLowerCase() === String(event.repository?.name).toLowerCase()) {
    throw new Error('the issue is already in this repository');
  }
  return repo;
}

module.exports = { transferTarget };

if (require.main === module) {
  const event = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  try {
    console.log(`target=${transferTarget(event) ?? ''}`);
  } catch (error) {
    console.log(`error=${error.message}`);
    process.exit(1);
  }
}
