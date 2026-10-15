'use strict';

const { food, clothes } = require('../models/index.js');

const collections = { food, clothes };

module.exports = (req, res, next, modelName) => {
  if (!Object.hasOwn(collections, modelName)) {
    const error = new Error('Invalid Model');
    error.status = 404;
    return next(error);
  }

  req.model = collections[modelName];
  return next();
};