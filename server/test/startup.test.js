const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function freePort() {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function launch(t, port, uri) {
  const child = spawn(process.execPath, [path.join(__dirname, '../src/index.js')], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      FRONTEND_ORIGIN: 'http://localhost:5173',
      MONGODB_URI: uri,
      MONGODB_DB_NAME: 'sidequest_test',
      GOOGLE_CLIENT_ID: '123-example.apps.googleusercontent.com',
      SESSION_SECRET: 'test-secret-with-at-least-32-bytes',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exit = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await exit;
    }
  });
  return { child, exit, output: () => output };
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`starts with MongoDB and shuts down cleanly on ${signal}`, { timeout: 20000 }, async (t) => {
    const port = await freePort();
    const processInfo = launch(t, port, process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/sidequest_test');
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(processInfo.child.exitCode, null, processInfo.output());
      try {
        const response = await fetch(`${base}/api/ready`, { signal: AbortSignal.timeout(2000) });
        if (response.status === 200) {
          assert.deepEqual(await response.json(), { status: 'ready' });
          ready = true;
          break;
        }
      } catch {
        // Wait until the child has connected and begun listening.
      }
      await delay(100);
    }
    assert.ok(ready, processInfo.output());
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    processInfo.child.kill(signal);
    const [code, exitSignal] = await processInfo.exit;
    assert.equal(code, 0, processInfo.output());
    assert.equal(exitSignal, null);
    assert.match(processInfo.output(), /Shutdown complete/);
  });
}

test('unreachable MongoDB prevents HTTP startup and exits with failure', { timeout: 15000 }, async (t) => {
  // Reserve a port with a TCP server that immediately closes connections.
  const unavailable = net.createServer((socket) => socket.destroy()).listen(0, '127.0.0.1');
  await once(unavailable, 'listening');
  t.after(() => new Promise((resolve) => unavailable.close(resolve)));
  const port = await freePort();
  const processInfo = launch(t, port, `mongodb://127.0.0.1:${unavailable.address().port}/sidequest_test`);
  const [code] = await processInfo.exit;
  assert.equal(code, 1, processInfo.output());
  assert.match(processInfo.output(), /Server startup failed/);
  assert.doesNotMatch(processInfo.output(), /API listening/);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));
});
