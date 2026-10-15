'use strict';

const express = require('express');
const selectModel = require('./model.js');
const handlers = require('./handlers.js');
const bearerAuth = require('../auth/middleware/bearer.js');
const permissions = require('../auth/middleware/acl.js');

const router = express.Router();

router.use(bearerAuth);

router.param('model', selectModel);
router.param('id', handlers.validateId);

router.get('/:model', handlers.getAll);
router.get('/:model/:id', handlers.getOne);
router.post('/:model', permissions('create'), handlers.create);
router.put('/:model/:id', permissions('update'), handlers.update);
router.delete('/:model/:id', permissions('delete'), handlers.remove);

module.exports = router;