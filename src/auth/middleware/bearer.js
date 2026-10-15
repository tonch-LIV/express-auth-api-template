'use strict';

const { users } = require('../models/index.js');

module.exports = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token, extra] = authorization.trim().split(/\s+/);

    if (
      scheme.toLowerCase() !== 'bearer' ||
      !token ||
      extra
    ) {
      throw new Error('Invalid Login')
    }

    // attaches authen user
    req.user = await users.authenticateToken(token);
    req.token = token; // token supplied by client
  } catch (error) {
    console.error(error);

    const authError = new Error('Invalid Login');
    authError.status = 401;
    return next(authError);
  }

  return next();
}
