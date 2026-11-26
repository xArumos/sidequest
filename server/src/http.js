// Thrown by route handlers; app.js turns it into `{ error: { code, message } }`.
// `fields` optionally maps each invalid input name to its problem and is sent as
// `error.fields`, so a client can show every field error at once.
class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

const badQuery = message => new HttpError(400, 'INVALID_QUERY', message);

// Express parses repeated keys (?genre=a&genre=b) into arrays; accept only one string.
function textParam(query, name, { max = 100 } = {}) {
  const value = query[name];
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) {
    throw badQuery(`${name} must be a single value of at most ${max} characters.`);
  }
  return value.trim();
}

function intParam(query, name, { fallback, min, max }) {
  const value = query[name];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value) || Number(value) < min || Number(value) > max) {
    throw badQuery(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return Number(value);
}

function objectIdParam(value, label = 'id') {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new HttpError(400, 'INVALID_ID', `That ${label} is not valid.`);
  return value;
}

module.exports = { HttpError, textParam, intParam, objectIdParam };
