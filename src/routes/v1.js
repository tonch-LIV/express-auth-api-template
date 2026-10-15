'use strict';

const express = require('express');
const selectModel = require('./model.js');
const handlers = require('./handlers.js');

const router = express.Router();

router.param('model', selectModel);
router.param('id', handlers.validateId);

router.get('/:model', handlers.getAll);
router.get('/:model/:id', handlers.getOne);
router.post('/:model', handlers.create);
router.put('/:model/:id', handlers.update);
router.delete('/:model/:id', handlers.remove);

module.exports = router;