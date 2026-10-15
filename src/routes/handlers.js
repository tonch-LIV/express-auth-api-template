'use strict';

function notFound() {
  const error = new Error('Record Not Found');
  error.status = 404;
  return error;
}

function validateId(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    const error = new Error('Invalid record ID');
    error.status = 400;
    return next(error);
  }

  return next();
}

async function getAll(req, res, next) {
  try {
    const records = await req.model.get();
    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const record = await req.model.get(req.params.id);

    if (!record) {
      throw notFound();
    }

    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const record = await req.model.create(req.body);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const record = await req.model.update(req.params.id, req.body);

    if (!record) {
      throw notFound();
    }

    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await req.model.delete(req.params.id);

    if (result === null) {
      throw notFound();
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateId,
  getAll,
  getOne,
  create,
  update,
  remove,
};