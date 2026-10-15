'use strict';

/*
  directly exporting an anonymous function

  NOTE: this one has 4 parameters, which means Express knows intrinsically that it is for handling server errors

  Because we'll be building out an API that works with JSON, let's format
  our response as a JSON object
*/

module.exports = function (error, req, res, next) {
  console.error(error);

  // Sometimes, errors come in as an object, others as a string
  const validationError = [
    'SequelizeValidationError',
    'SequelizeUniqueConstraintError',
  ].includes(error.name);
  
  const status = error.status || (validationError ? 400 : 500);

  res.status(status).json({
    status,
    message: error.message || String(error)
  });
};
