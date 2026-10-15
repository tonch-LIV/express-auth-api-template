'use strict';

module.exports = (capability) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        const error = new Error('Invalid Login');
        error.status = 401;
        throw error;
      }

      if (!req.user.capabilities.includes(capability)) {

        const error = new Error('Access Denied');
        error.status = 403;
        throw error;
      }
    } catch (error) {
      return next(error);
    }
    return next();
  };
};
