const branch = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
const environment = String(process.env.VERCEL_ENV || '').trim();

const shouldIgnore =
  environment === 'preview' &&
  branch.startsWith('dependabot/');

if (shouldIgnore) {
  console.log(`Ignoring preview build for branch: ${branch}`);
  process.exit(0);
}

console.log(`Continuing build for env=${environment || 'unknown'} branch=${branch || 'unknown'}`);
process.exit(1);
