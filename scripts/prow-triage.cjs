const { readFileSync } = require('node:fs');

function isTriager(event, roster) {
  if (!Array.isArray(roster.maintainers)) {
    throw new Error('maintainers must be a list');
  }
  const projects = roster.maintainers.filter(
    (project) => project.org === 'projectbluefin' && project.project_id === 'bluefin',
  );
  if (projects.length !== 1 || !Array.isArray(projects[0].teams)) {
    throw new Error('expected one Project Bluefin roster with teams');
  }
  const fullName = event.repository?.full_name;
  const repositoryName = typeof fullName === 'string'
    ? fullName.match(/^projectbluefin\/([a-z0-9_.-]+)$/i)?.[1].toLowerCase()
    : undefined;
  const globalTeams = ['project-maintainers', 'triage'];
  const scopedTeams = projects[0].teams
    .filter((team) => typeof team.name === 'string' && team.name.endsWith('-triage'))
    .map((team) => team.name);
  const members = new Set();
  // Validate every scoped team, even when CI validates the roster without an event.
  for (const name of [...globalTeams, ...scopedTeams]) {
    const teams = projects[0].teams.filter((team) => team.name === name);
    if (teams.length !== 1 || !Array.isArray(teams[0].members) ||
        teams[0].members.length === 0) {
      throw new Error(`expected one nonempty ${name} team`);
    }
    for (const member of teams[0].members) {
      if (typeof member !== 'string' || !member.trim()) {
        throw new Error(`${name} members must be GitHub usernames`);
      }
      if (globalTeams.includes(name) || (repositoryName && name === `${repositoryName}-triage`)) {
        members.add(member.toLowerCase());
      }
    }
  }
  const user = event.comment?.user;
  return user?.type === 'User' && typeof user.login === 'string' &&
    members.has(user.login.toLowerCase());
}

module.exports = { isTriager };

if (require.main === module) {
  const event = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const roster = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  console.log(`triage=${isTriager(event, roster)}`);
}
