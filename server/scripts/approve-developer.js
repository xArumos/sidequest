const { parseArgs } = require('node:util');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
require('sidequest-database/models/Game');
require('sidequest-database/models/User');
const { decideDeveloperRequest } = require('../src/developers');

const USAGE = `Usage:
  npm run approve:developer -- --list               List pending developer requests
  npm run approve:developer -- --id <requestId>     Approve a request
  npm run approve:developer -- --id <requestId> --reject`;

// Decide developer access requests from the command line (PBI-32). Admins can also
// use the admin page; both record the decision the same way.
async function main() {
  const { values } = parseArgs({
    options: { id: { type: 'string' }, reject: { type: 'boolean', default: false }, list: { type: 'boolean', default: false } },
  });
  if (values.list === Boolean(values.id)) throw new Error(`Pass either --list or --id.\n${USAGE}`);
  if (values.id && !/^[a-f\d]{24}$/i.test(values.id)) throw new Error('--id must be a developer request id.');

  await connectDatabase();
  if (values.list) {
    const requests = await GameDeveloper.find({ status: 'pending' }).sort({ requestedAt: 1, _id: 1 })
      .populate('user', 'displayName username email').populate('game', 'title').lean();
    if (!requests.length) console.log('No pending developer requests.');
    for (const request of requests) {
      const who = request.user ? `${request.user.displayName} <${request.user.email}>` : 'deleted user';
      console.log(`${request._id}  ${request.game?.title ?? 'deleted game'}  ${who}  ${request.requestedAt.toISOString()}`);
      if (request.justification) console.log(`    ${request.justification}`);
    }
    return;
  }

  const status = values.reject ? 'rejected' : 'approved';
  const request = await decideDeveloperRequest(values.id, status);
  if (!request) throw new Error(`No developer request with id ${values.id}.`);
  console.log(`Developer request ${values.id} is now ${status}.`);
}

main()
  .catch(error => {
    console.error('Developer approval failed:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
