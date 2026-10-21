const { OAuth2Client } = require('google-auth-library');

function createGoogleVerifier(clientId, client = new OAuth2Client()) {
  return async credential => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    return ticket.getPayload();
  };
}

module.exports = { createGoogleVerifier };
