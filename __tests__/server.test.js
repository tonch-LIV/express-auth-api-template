'use strict';

process.env.NODE_ENV = 'test';
process.env.SECRET = 'automated-test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { server } = require('../src/server.js');
const { db, users, food, clothes } = require('../src/models/index.js');

const api = request(server);
const password = 'lab-test-password';
const roles = ['user', 'writer', 'editor', 'admin'];

const capabilities = {
  user: ['read'],
  writer: ['read', 'create'],
  editor: ['read', 'create', 'update'],
  admin: ['read', 'create', 'update', 'delete'],
};

const fixtures = [
  {
    model: 'food',
    collection: food,
    data: { name: 'apple', calories: 95, type: 'fruit' },
    change: { calories: 100 },
  },
  {
    model: 'clothes',
    collection: clothes,
    data: { name: 'shirt', color: 'blue', size: 'M' },
    change: { color: 'green' },
  },
];

let tokens;

beforeEach(async () => {
  await db.sync({ force: true });
  tokens = {};

  for (const role of roles) {
    const user = await users.create({
      username: role,
      password,
      role,
    });

    tokens[role] = user.token;
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await db.close();
});

describe('authentication', () => {
  test('signup returns a safe user and valid token', async () => {
    const response = await api.post('/signup').send({
      username: 'new-user',
      password,
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      username: 'new-user',
      role: 'user',
      capabilities: ['read'],
    });
    expect(response.body.user).not.toHaveProperty('password');
    expect(jwt.verify(response.body.token, process.env.SECRET))
      .toMatchObject({ username: 'new-user' });

    const stored = await users.findOne({
      where: { username: 'new-user' },
    });

    expect(stored.password).not.toBe(password);
  });

  test('signin returns a safe user and token', async () => {
    const response = await api.post('/signin').auth('user', password);

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe('user');
    expect(response.body.user).not.toHaveProperty('password');
    expect(typeof response.body.token).toBe('string');

    await api.get('/secret')
      .set('Authorization', `Bearer ${response.body.token}`)
      .expect(200);
  });

  test.each([
    [undefined],
    ['Bearer wrong-scheme'],
    ['Basic !!!'],
    [`Basic ${Buffer.from('no-colon').toString('base64')}`],
    [`Basic ${Buffer.from('missing:password').toString('base64')}`],
    [`Basic ${Buffer.from('user:wrong-password').toString('base64')}`],
  ])('rejects invalid basic credentials: %s', async (header) => {
    const call = api.post('/signin');

    if (header !== undefined) {
      call.set('Authorization', header);
    }

    const response = await call;
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid Login');
  });

  test('rejects duplicate and incomplete signups', async () => {
    await api.post('/signup')
      .send({ username: 'user', password })
      .expect(400);

    await api.post('/signup')
      .send({ username: 'incomplete' })
      .expect(400);
  });

  test.each([
    [undefined],
    ['Basic wrong-scheme'],
    ['Bearer invalid-token'],
  ])('rejects invalid bearer headers: %s', async (header) => {
    const call = api.get('/secret');

    if (header !== undefined) {
      call.set('Authorization', header);
    }

    await call.expect(401);
  });

  test('rejects expired tokens and deleted users', async () => {
    const expired = jwt.sign(
      { username: 'user' },
      process.env.SECRET,
      { expiresIn: -1 }
    );

    await api.get('/secret')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    await users.destroy({ where: { username: 'user' } });

    await api.get('/secret')
      .set('Authorization', `Bearer ${tokens.user}`)
      .expect(401);
  });

  test.each(roles)('%s has the assigned capabilities', async (role) => {
    const response = await api.post('/signin').auth(role, password);

    expect(response.status).toBe(200);
    expect(response.body.user.capabilities).toEqual(capabilities[role]);
  });

  test.each(roles)('/users permits only admin: %s', async (role) => {
    const response = await api.get('/users')
      .set('Authorization', `Bearer ${tokens[role]}`);

    expect(response.status).toBe(role === 'admin' ? 200 : 403);

    if (role === 'admin') {
      expect(response.body.sort()).toEqual([...roles].sort());
    }
  });
});

describe.each(fixtures)('$model CRUD', (fixture) => {
  test.each(['v1', 'v2'])('%s completes the CRUD lifecycle', async (version) => {
    const base = `/api/${version}/${fixture.model}`;

    function call(method, path, body) {
      const operation = api[method](path);

      if (version === 'v2') {
        operation.set('Authorization', `Bearer ${tokens.admin}`);
      }

      return body === undefined ? operation : operation.send(body);
    }

    const created = await call('post', base, fixture.data);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(fixture.data);

    const itemPath = `${base}/${created.body.id}`;

    const list = await call('get', base);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: created.body.id, ...fixture.data }),
    ]);

    const item = await call('get', itemPath);
    expect(item.status).toBe(200);
    expect(item.body).toMatchObject(fixture.data);

    const updated = await call('put', itemPath, fixture.change);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject(fixture.change);

    const deleted = await call('delete', itemPath);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({});

    expect((await call('get', itemPath)).status).toBe(404);
  });

  test.each(roles)('V2 enforces permissions for %s', async (role) => {
    const seed = await fixture.collection.create(fixture.data);
    const base = `/api/v2/${fixture.model}`;
    const itemPath = `${base}/${seed.id}`;
    const header = `Bearer ${tokens[role]}`;

    await api.get(base).set('Authorization', header).expect(200);
    await api.get(itemPath).set('Authorization', header).expect(200);

    const operations = [
      ['post', base, fixture.data, 'create', 201],
      ['put', itemPath, fixture.change, 'update', 200],
      ['delete', itemPath, undefined, 'delete', 200],
    ];

    for (const [method, path, body, capability, success] of operations) {
      const call = api[method](path).set('Authorization', header);

      if (body !== undefined) {
        call.send(body);
      }

      const allowed = capabilities[role].includes(capability);
      await call.expect(allowed ? success : 403);
    }

    const stored = await fixture.collection.get(seed.id);

    if (role === 'admin') {
      expect(stored).toBeNull();
    } else {
      expect(stored.toJSON()).toMatchObject(
        role === 'editor'
          ? { ...fixture.data, ...fixture.change }
          : fixture.data
      );
    }

    const records = await fixture.collection.get();
    expect(records).toHaveLength(
      role === 'user' || role === 'admin' ? 1 : 2
    );
  });

  test.each([
    ['get', ''],
    ['get', '/1'],
    ['post', ''],
    ['put', '/1'],
    ['delete', '/1'],
  ])('V2 rejects unauthenticated %s requests', async (method, suffix) => {
    await api[method](`/api/v2/${fixture.model}${suffix}`).expect(401);
  });

  test('V1 handles invalid IDs, missing records, and invalid data', async () => {
    const base = `/api/v1/${fixture.model}`;

    await api.get(`${base}/invalid`).expect(400);
    await api.get(`${base}/999`).expect(404);
    await api.put(`${base}/999`).send(fixture.change).expect(404);
    await api.delete(`${base}/999`).expect(404);
    await api.post(base).send({}).expect(400);
  });
});

describe('routing and error handling', () => {
  test.each(['users', 'db', 'unknown', 'toString'])(
    'V1 rejects non-collection model %s',
    async (model) => {
      await api.get(`/api/v1/${model}`).expect(404);
    }
  );

  test('V2 rejects unknown models for authenticated users', async () => {
    await api.get('/api/v2/unknown')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(404);
  });

  test('unknown routes return JSON with status 404', async () => {
    const response = await api.get('/not-a-route');

    expect(response.status).toBe(404);
    expect(response.body.status).toBe(404);
  });

  test('database errors reach the JSON error handler', async () => {
    jest.spyOn(food, 'get').mockRejectedValueOnce(
      new Error('Simulated database failure')
    );

    const response = await api.get('/api/v1/food');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 500,
      message: 'Simulated database failure',
    });
  });

  test('user-list database failures return a JSON error', async () => {
    const originalFindAll = users.findAll;

    const lookup = jest.spyOn(users, 'findAll')
      .mockImplementation(function (options) {
        if (options?.plain === true) {
          return originalFindAll.call(this, options);
        }

        return Promise.reject(new Error('User lookup failed'));
      });

    const response = await api.get('/users')
      .set('Authorization', `Bearer ${tokens.admin}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User lookup failed');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['create', 'post', '/api/v1/food', fixtures[0].data],
    ['update', 'put', '/api/v1/food/1', fixtures[0].change],
    ['delete', 'delete', '/api/v1/food/1', undefined],
  ])('%s database failures return a JSON error', async (
    operation,
    method,
    path,
    body
  ) => {
    jest.spyOn(food, operation).mockRejectedValueOnce(
      new Error('Database operation failed')
    );

    const call = api[method](path);

    if (body !== undefined) {
      call.send(body);
    }

    const response = await call;

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database operation failed');
  });

  test('rejects signed tokens with an invalid username payload', async () => {
    const token = jwt.sign(
      { username: 123 },
      process.env.SECRET
    );

    await api.get('/secret')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  test('ACL rejects a request without an authenticated user', () => {
    const permissions = require('../src/auth/middleware/acl.js');
    const next = jest.fn();

    permissions('create')({}, {}, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(401);
    expect(error.message).toBe('Invalid Login');
  });

  test('startup rejects a missing port', () => {
    const { start } = require('../src/server.js');

    expect(() => start()).toThrow('Missing Port');
  });

  test('startup returns its listener and registers the callback', () => {
    const { start } = require('../src/server.js');
    const listener = {};
    const listen = jest.spyOn(server, 'listen').mockReturnValue(listener);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(start(3001)).toBe(listener);
    expect(listen).toHaveBeenCalledWith(3001, expect.any(Function));

    const callback = listen.mock.calls[0][1];
    callback();

    expect(log).toHaveBeenCalledWith('Listening on 3001');
  });
});