'use strict';

require('dotenv').config();

const { db } = require('./src/models/index.js');
const server = require('./src/server.js');

const PORT = process.env.PORT || 3001

async function startServer() {
  try {
    await db.sync();
    server.start(PORT);
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exitCode = 1;
  }
};

startServer();
