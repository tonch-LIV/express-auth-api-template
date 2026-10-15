# Express Auth API Template

A reusable Express API starter with Basic authentication, JWT bearer authentication, role-based permissions, Sequelize models, PostgreSQL development storage, and isolated SQLite tests.

Includes food and clothes example collections, unauthenticated V1 routes, and protected V2 routes.

This is a course-derived development baseline. V1 routes allow unauthenticated writes, and signup accepts a supplied role for demonstrations. Review those behaviors before using this starter in a public application.

## Starting a New Project

After creating a repository from this template:

1. Clone your new repository and enter its directory.
2. Change the project name in `package.json` and the two root metadata entries in `package-lock.json`.
3. Create a separate PostgreSQL database for the new project.
4. Configure `.env` with that database URL and a newly generated signing secret.
5. Install dependencies and run the tests.
6. Replace the example models and update their API tests as your project develops.

## Customizing the API

- Define resource schemas; `src/models/`.
- Register models on the shared connection and export collections; `src/models/index.js`.
- Add supported API collection names; `src/routes/model.js`.
- Adjust role capabilities; `src/auth/models/users.js`.
- Adjust route permissions; `src/routes/v2.js`.
- Update resource fixtures and behavior checks; `__tests__/server.test.js`.

## Setup

The project requires Node.js, npm, and PostgreSQL.  
Local development was verified using Node.js 20.20.2.

From the project directory, install the dependencies recorded in the lockfile:
 
```bash
npm ci
```

On Ubuntu, start PostgreSQL and create the project database if it does not already exist:

```bash
sudo service postgresql start
sudo -u postgres createdb my_api
```

Create the local environment file if it does not already exist:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/my_api
SECRET=YOUR_GENERATED_SECRET
```

Use your existing PostgreSQL credentials.  
URL-encode special characters in the password portion of `DATABASE_URL`.

Generate a signing secret:

```bash
openssl rand -hex 32
```

Copy the generated value into `SECRET`. Keep `.env` private; it is excluded from Git.

Start the application:

```bash
npm start
```

Startup loads environment configuration, synchronizes the registered database models, and then starts listening.  
Normal startup requires `DATABASE_URL` and `SECRET`.

The default local address is `http://localhost:3001`.

## API Reference

### Authentication

| Method | Route | Requirement | Successful response |
|---|---|---|---|
| POST | `/signup` | JSON username and password; optional lab role | 201; `{ user, token }` |
| POST | `/signin` | Basic authentication credentials | 200; `{ user, token }` |
| GET | `/secret` | Valid bearer token | 200; welcome message |
| GET | `/users` | Valid bearer token and delete capability | 200; username array |

User responses include the *ID*, *username*, *role*, and *capabilities*.  
**Password hashes remain internal**.

For this course lab, signup accepts a role so each permission level can be demonstrated.  
Public production signup would require controlled role assignment.

### Collections

The supported collection names are `food` and `clothes`.  
Other names, including `users` and `db`, are rejected by the API collection selector.

Replace `:version` with `v1` or `v2`,  
`:model` with a collection name, and `:id` with a positive record ID.

| Method | Route | V2 requirement | Successful response |
|---|---|---|---|
| GET | `/api/:version/:model` | Bearer token | 200; record array |
| GET | `/api/:version/:model/:id` | Bearer token | 200; record object |
| POST | `/api/:version/:model` | Bearer token and create capability | 201; created record |
| PUT | `/api/:version/:model/:id` | Bearer token and update capability | 200; updated record |
| DELETE | `/api/:version/:model/:id` | Bearer token and delete capability | 200; `{}` |

V1 requires no authentication.  
Both versions use the same database records and CRUD handlers.

Food fields:

```json
{
  "name": "apple",
  "calories": 95,
  "type": "fruit"
}
```

Food type is defined as `fruit`, `vegetable`, or `protein`.

Clothes fields:

```json
{
  "name": "shirt",
  "color": "blue",
  "size": "M"
}
```

All listed fields are required when creating a record.

## Permissions

| Role | Read | Create | Update | Delete |
|---|---|---|---|---|
| user | Yes | No | No | No |
| writer | Yes | Yes | No | No |
| editor | Yes | Yes | Yes | No |
| admin | Yes | Yes | Yes | Yes |

V2 GET routes require authentication only. Every defined role has read capability.

### Example Authentication Flow

Implies two terminal/shells;  
One to run the server, the other to run the `curl` commands.  

- Create a writer account:

```bash
curl -i -H 'Content-Type: application/json' \
  -d '{"username":"example-writer","password":"example-password","role":"writer"}' \
  http://localhost:3001/signup
```

- Sign in:

```bash
curl -i -u example-writer:example-password \
  -X POST http://localhost:3001/signin
```

- Copy the returned token into a temporary shell variable:

```bash
LAB_TOKEN='paste-returned-token-here'
```

- Create food through the protected API:

```bash
curl -i \
  -H "Authorization: Bearer $LAB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"apple","calories":95,"type":"fruit"}' \
  http://localhost:3001/api/v2/food
```

### Error Responses

Errors use JSON with `status` and `message` fields:

```json
{
  "status": 403,
  "message": "Access Denied"
}
```

| Status | Meaning |
|---|---|
| 400 | Invalid record ID, missing required fields, or duplicate username |
| 401 | Missing or invalid authentication |
| 403 | Authenticated user lacks the required capability |
| 404 | Unknown route, unsupported collection, or missing record |
| 500 | Unexpected server or database failure |

## Testing

- Run the suite with coverage:

```bash
npm test -- --runInBand
```

- Run tests in watch mode:

```bash
npm run test:watch
```

Tests set their own signing secret and use an isolated in-memory SQLite database.  
Each test starts with fresh tables and accounts; PostgreSQL configuration is not required for the automated suite.

The suite covers signup/signin, safe user responses, authentication failures, all four roles, both collections, V1/V2 CRUD, denied writes, missing records, database failures, and server startup behavior.

Inherited baseline results from the source project; rerun after customization:

- 64 tests passed.
- Statement coverage: 100%.
- Branch coverage: 100%.
- Function coverage: 100%.
- Line coverage: 100%.

Coverage includes all JavaScript files under `src/`.  
Root `index.js` is outside that coverage scope.

## Architecture and Diagrams

The application separates startup, request handling, authentication, and database operations:

- `index.js`; loads configuration, synchronizes models, and starts the server.
- `src/server.js`; creates the Express application and registers middleware and routers.
- `src/auth/`; authenticates users and checks capabilities.
- `src/routes/`; selects supported collections and handles V1/V2 CRUD requests.
- `src/models/`; registers models on one connection and performs database operations.
- `src/error-handlers/`; formats error responses.

### Authentication and API Structure

```mermaid
classDiagram
    class ExpressApplication {
        authenticationRoutes
        v1Router
        v2Router
    }

    class UserModel {
        username
        passwordHash
        role
        token
        capabilities
        authenticateBasic()
        authenticateToken()
        toJSON()
    }

    class AuthenticationMiddleware {
        basic()
        bearer()
    }

    class AccessControl {
        checkCapability()
    }

    class CRUDHandlers {
        getAll()
        getOne()
        create()
        update()
        remove()
    }

    class DataCollection {
        model
        get()
        create()
        update()
        delete()
    }

    class SharedDatabase {
        Users
        Food
        Clothes
    }

    ExpressApplication --> AuthenticationMiddleware
    AuthenticationMiddleware --> UserModel
    ExpressApplication --> AccessControl
    AccessControl --> UserModel : reads capabilities
    ExpressApplication --> CRUDHandlers
    CRUDHandlers --> DataCollection
    DataCollection --> SharedDatabase
    UserModel --> SharedDatabase
```

### Web Request/Response Cycle

Example: creating a food record through V2.

```mermaid
sequenceDiagram
    participant Client
    participant API as Express API
    participant Auth as Bearer Middleware
    participant ACL as Access Control
    participant Handler as CRUD Handler
    participant Collection as Data Collection
    participant DB as Database
    participant Error as Error Handler

    Client->>API: POST /api/v2/food with bearer token and JSON
    API->>Auth: Validate authentication
    Auth->>DB: Find user after verifying JWT
    DB-->>Auth: User or no matching user

    alt Authentication fails
        Auth->>Error: Authentication error
        Error-->>Client: 401 JSON response
    else Authentication succeeds
        Auth->>ACL: Request with authenticated user
        alt User lacks create capability
            ACL->>Error: Access denied
            Error-->>Client: 403 JSON response
        else User has create capability
            ACL->>Handler: Continue request
            Handler->>Collection: create(request body)
            Collection->>DB: Insert food record
            alt Insert succeeds
                DB-->>Collection: Created record
                Collection-->>Handler: Created record
                Handler-->>Client: 201 JSON response
            else Insert fails
                DB-->>Collection: Database error
                Collection-->>Handler: Rejected operation
                Handler->>Error: Forward error
                Error-->>Client: 400 validation or 500 unexpected error
            end
        end
    end
```

Record lookup, update, and deletion return 404 when the requested record does not exist.

## Origin and AI Assistance

Derived from [authAPI](https://github.com/tonch-LIV/authAPI), a completed course project combining the class starter code with earlier API and authentication labs.

Codex supplied implementation guidance, test code, documentation, and diagram drafts. Changes were entered manually and verified locally. The source repository preserves the assignment documentation and contribution history.

## Changelog

- initialized reusable baseline from the completed authAPI project; source, tests, lockfile, and environment example.
- generalized project metadata and setup instructions; `package.json`, `package-lock.json`, `.env.example`, `README.md`.