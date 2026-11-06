// Checks that a pull request which changes the app also changes its version number.
// The phone only fetches fresh copies of the app's files when the version changes,
// so forgetting it would leave the old app on the home screen.
// Run by the automated checks on every pull request: node tests/check-version.js origin/main
const { execSync } = require('child_process');

const base = process.argv[2] || 'origin/main';
const git = (command) => execSync(`git ${command}`, { encoding: 'utf8' });

// The files the phone loads: changing any of these needs a new version
const appFiles = (file) => file === 'index.html' || /^[^/]+\.js$/.test(file) && file !== 'playwright.config.js'
  || file.startsWith('assets/');

const changed = git(`diff --name-only ${base}...HEAD`).split('\n').filter(Boolean).filter(appFiles);
if (changed.length === 0) {
  console.log('The app itself has not changed, so the version can stay the same.');
  process.exit(0);
}

const versionIn = (html) => (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
const before = versionIn(git(`show ${base}:index.html`));
const after = versionIn(git('show HEAD:index.html'));

if (!after) {
  console.error('index.html has no <meta name="app-version" content="..."> line.');
  process.exit(1);
}
if (after === before) {
  console.error(`These app files changed: ${changed.join(', ')}`);
  console.error(`but the version is still ${after}. Change app-version and every ?v= in index.html,`);
  console.error('so the phone loads the new files instead of its old copies.');
  process.exit(1);
}
console.log(`Version changed from ${before} to ${after}.`);
