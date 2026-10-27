const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummyHash = `scrypt$v1$32768$8$3$${'00'.repeat(16)}$${'00'.repeat(64)}`;

function validPassword(password) {
  return typeof password === 'string' && [...password].length >= 15 && [...password].length <= 128;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, options);
  return `scrypt$v1$32768$8$3$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, hash = dummyHash) {
  const match = /^scrypt\$v1\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
  if (!match) return false;
  const key = await derive(password, Buffer.from(match[1], 'hex'), 64, options);
  return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}

module.exports = { hashPassword, verifyPassword, validPassword };
