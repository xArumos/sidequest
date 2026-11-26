const { parseArgs } = require('node:util');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const User = require('sidequest-database/models/User');

const USAGE = `Usage:
  npm run set:admin -- --user <username, email, or user id>
  npm run set:admin -- --user <username, email, or user id> --revoke`;

// The only way to grant or revoke the admin flag (issue #93); no API route changes it.
async function main() {
  const { values } = parseArgs({
    options: { user: { type: 'string' }, revoke: { type: 'boolean', default: false } },
  });
  const identifier = values.user?.trim().toLowerCase();
  if (!identifier) throw new Error(`Pass --user.\n${USAGE}`);

  await connectDatabase();
  const filter = /^[a-f\d]{24}$/.test(identifier) ? { _id: identifier }
    : identifier.includes('@') ? { email: identifier } : { username: identifier };
  const users = await User.find(filter, 'displayName email').limit(2).lean();
  if (!users.length) throw new Error(`No user matches ${values.user}.`);
  // Google and password accounts may share an email address; refuse to guess.
  if (users.length > 1) throw new Error(`More than one user matches ${values.user}; use the user id instead.`);

  const admin = !values.revoke;
  await User.updateOne({ _id: users[0]._id }, { $set: { admin } });
  console.log(`${users[0].displayName} <${users[0].email}> is ${admin ? 'now' : 'no longer'} an admin.`);
}

main()
  .catch(error => {
    console.error('Setting admin failed:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
