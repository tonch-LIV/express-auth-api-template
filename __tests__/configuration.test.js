'use strict';

describe('configuration and error formatting', () => {
  let originalEnvironment;

  beforeEach(() => {
    originalEnvironment = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      SECRET: process.env.SECRET,
    };

    process.env.NODE_ENV = 'test';
    process.env.SECRET = 'configuration-test-secret';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    jest.restoreAllMocks();
    jest.dontMock('sequelize');
  });

  test('rejects a missing signing secret', () => {
    delete process.env.SECRET;

    expect(() => {
      jest.isolateModules(() => {
        require('../src/auth/models/users.js');
      });
    }).toThrow('Missing SECRET environment variable');
  });

  test('rejects a missing database URL outside tests', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;

    expect(() => {
      jest.isolateModules(() => {
        require('../src/models/index.js');
      });
    }).toThrow('Missing DATABASE_URL environment variable');
  });

  test('uses the configured database URL outside tests', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL =
      'postgres://example:example@localhost:5432/example';

    const fakeModel = {
      beforeCreate: jest.fn(),
      prototype: {},
    };

    const fakeDatabase = {
      define: jest.fn(() => fakeModel),
    };

    const Sequelize = jest.fn(() => fakeDatabase);

    jest.doMock('sequelize', () => ({
      Sequelize,
      DataTypes: {
        STRING: 'STRING',
        INTEGER: 'INTEGER',
        VIRTUAL: 'VIRTUAL',
        ENUM: jest.fn(),
      },
    }));

    jest.isolateModules(() => {
      const { db } = require('../src/models/index.js');

      expect(db).toBe(fakeDatabase);
    });

    expect(Sequelize).toHaveBeenCalledWith(
      process.env.DATABASE_URL,
      { logging: false }
    );
  });

  test('formats errors supplied as strings', () => {
    const errorHandler = require('../src/error-handlers/500.js');

    jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler('Unexpected failure', {}, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      status: 500,
      message: 'Unexpected failure',
    });
  });
});