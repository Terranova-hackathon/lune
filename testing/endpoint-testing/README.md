# Testing Lune

All testing documentation for the project lives here.

| Tool                        | Use it to                                                            | Where                                                                        |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Scalar API reference**    | Read the API docs and send single requests by hand from the browser  | `http://localhost:3001/docs`                                                 |
| **Bruno**                   | Run the automated end-to-end API test suite (79 requests with tests) | [`endpoint-testing/lune-reference-api`](endpoint-testing/lune-reference-api) |
| **Vitest** (via `npm test`) | Run the frontend unit tests                                          | `frontend/`                                                                  |

Scalar is for exploring one endpoint at a time. Bruno is for checking that the whole API still works after a change.

[Bruno](https://docs.usebruno.com/) stores collections as plain files in the open OpenCollection YAML format (`opencollection.yml` at the collection root), so they live in Git with the code and can be imported into other tools such as Postman.

**Quick start:** [start the backend](#start-the-backend), then [run the test suite](#run-everything).

## Contents

1. [Setup](#1-setup)
   - [Required](#required) · [Optional](#optional) · [Start the backend](#start-the-backend)
2. [Exploring the API with Scalar](#2-exploring-the-api-with-scalar)
   - [Finding your way around](#finding-your-way-around) · [Sending requests](#sending-requests) · [Signing in from Scalar](#signing-in-from-scalar) · [Other useful URLs](#other-useful-urls)
3. [Running the test suite with Bruno](#3-running-the-test-suite-with-bruno)
   - [Run everything](#run-everything) · [Reading the report](#reading-the-report) · [What the suite does](#what-the-suite-does) · [How sign-in works in the tests](#how-sign-in-works-in-the-tests)
   - [Environment variables](#environment-variables) · [Running single requests](#running-single-requests) · [Not covered](#not-covered)
4. [Troubleshooting](#4-troubleshooting)
5. [Maintaining the tests](#5-maintaining-the-tests)
   - [Updating tests for new endpoints](#updating-tests-for-new-endpoints)
6. [Frontend unit tests](#6-frontend-unit-tests)

---

## 1. Setup

### Required

| Tool                                  | Why                                                                                                                                 | Install                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Docker Engine + Docker Compose plugin | Runs SQL Server and the backend                                                                                                     | [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) |
| Node.js v22.22.3 or newer             | Runs the Bruno CLI, the test runner script and the frontend tests (the Bruno CLI alone needs v20+, the Angular CLI needs v22.22.3+) | [nodejs.org](https://nodejs.org/) or your distro's package manager        |
| Bruno CLI                             | Runs the test collection from the terminal                                                                                          | `npm install -g @usebruno/cli`                                            |

Check the installs:

``` bash
docker compose version
node --version        # v20 or newer
bru --version
```

### Optional

| Tool                    | Why                                                                                       | Install                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Bruno desktop app       | Browse, edit and run single requests with a UI                                            | [usebruno.com/downloads](https://www.usebruno.com/downloads) |
| Bruno VS Code extension | The same inside VS Code                                                                   | Extension ID `bruno-api-client.bruno`                        |
| Python 3 + PyYAML       | Only to regenerate the collection (see [Maintaining the tests](#5-maintaining-the-tests)) | `pip install pyyaml`                                         |

### Start the backend

From the repository root:

``` bash
cp .env.example .env      # first time only; fill in the keys
docker compose up -d
```

The backend needs these values in `.env`: `SA_PASSWORD`, `JWT_SECRET`, `IGDB_CLIENT_ID`, `IGDB_API_SECRET` and `GGDEALS_API_KEY`. Without the IGDB keys, every game endpoint returns `503`.

Wait until the backend is ready:

``` bash
curl http://localhost:3001/health          # ok
curl http://localhost:3001/health/ready    # {"status":"Healthy",...}
```

`/health` only means the process is running. `/health/ready` also checks the database, so wait for that one before testing.

---

## 2. Exploring the API with Scalar

Open **http://localhost:3001/docs** in a browser. The reference is only served in the Development environment, which is what Docker Compose uses.

<!-- Screenshot: Scalar overview, with the intro and the sidebar sections visible -->

### Finding your way around

- **Introduction** (top of the page): what the API does, how sign-in works, and the conventions every endpoint follows: game IDs, paging, error format and what `503` means. Read this first.
- **Sidebar**: endpoints grouped by section (**Games**, **Auth**, **Favorites**, **Prices**, **Health**). Each section starts with a short description.
- **Endpoint page**: the method and route, a description of the behavior (including edge cases such as "safe to repeat"), the parameters with their limits, the request body, and every possible response with its schema.
- **Models** (at the bottom of the sidebar): the shape of every request and response object.

<!-- Screenshot: one endpoint page, e.g. GET /api/games, showing parameters and responses -->

### Sending requests

Every endpoint has a **Test Request** button that opens a request client in the page. Fill in the parameters or body and send it. The response, status and headers appear next to it. Code samples for C# and other languages are shown on each endpoint too.

<!-- Screenshot: the request client with a filled-in search and its response -->

### Signing in from Scalar

Protected endpoints (Favorites, and `/api/auth/me`, `/profile`, `/delete-account`) need the auth cookie. Because Scalar is served by the backend itself, the browser handles the cookie for you:

1. Open **Auth → Register** (or **Login**) and send a request with a valid body, for example:
``` json
{
  "email": "you@example.com",
  "password": "Password1!",
  "displayName": "you",
  "acceptedPrivacyPolicy": true
}
```
2. The response sets the `Lune_auth` cookie in your browser.
3. Protected endpoints now work from the same browser tab. Try **Auth → Get Current User**.
4. **Auth → Logout** ends the session.

Accounts you create this way are real rows in your local database. Delete them with **Auth → Delete Account** when you're done.

### Other useful URLs

| URL                                     | What it is                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `http://localhost:3001/`                | Developer landing page: every route with its access level, plus quick register/login/logout/delete buttons |
| `http://localhost:3001/openapi/v1.json` | The raw OpenAPI document that Scalar renders. A copy lives in [`docs/openapi.json`](../docs/openapi.json). |

---

## 3. Running the test suite with Bruno

### Run everything

``` bash
cd testing/endpoint-testing/lune-reference-api
node run-tests.mjs
```

This runs all 79 requests in order against the **Development** environment and writes two reports:

- `reports/results-<date-time>.html`: open in a browser to see every request and test
- `reports/results-<date-time>.xml`: JUnit format, for CI

The command exits with a non-zero code if any test fails.

<!-- Screenshot: terminal output with the execution summary table -->

Other options:

``` bash
node run-tests.mjs --dry-run     # list the run order without sending anything
node run-tests.mjs --no-report   # skip the report files
node run-tests.mjs -- --bail     # anything after -- is passed to bru (here: stop at the first failure)
```

**Use the script, not the "Run" button in the app or the VS Code extension.** The tests depend on running in a fixed order (Auth creates the users that Favorites and Teardown use), and the extension's runner doesn't follow the collection's order. The script reads the order from the `seq` fields and runs everything in one `bru run`, so values set by earlier requests (test users, auth token) are available to later ones.

### Reading the report

Open the HTML report in a browser.

- The **summary** at the top shows how many requests and tests passed or failed.
- Use the **failed only** filter to hide passing requests.
- Expand a request to see the URL that was actually sent, the request and response headers and bodies, and each test with its error message.

<!-- Screenshot: HTML report summary -->

<!-- Screenshot: an expanded failing request, showing the test error and the response body -->

When a test fails, check the **Request URL** and **Response Body** first. They usually show whether the request was wrong or the API was.

### What the suite does

The folders run in this order:

| #   | Folder        | What it covers                                                                                                                                                                                                                                                                                        |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Health**    | Liveness and readiness checks                                                                                                                                                                                                                                                                         |
| 2   | **Games**     | Search (by name, filters, paging limits), every `400` validation rule, filter options, company search, game by ID (including `404`), featured games                                                                                                                                                   |
| 3   | **Prices**    | Price comparison for a Steam game (`200`) and a non-Steam game (`404`)                                                                                                                                                                                                                                |
| 4   | **Auth**      | Signed-out access (`401`); registration rules (privacy consent, password rules, email, display name length and uniqueness, users without a display name); login (wrong password and unknown email give the same `401`); profile updates (trimming, unchanged name, taken name, length limits); logout |
| 5   | **Favorites** | Every endpoint signed out (`401`); add (repeat-safe), list (newest first, paging), IDs, unknown and invalid IDs (`404`), remove (repeat-safe)                                                                                                                                                         |
| 6   | **Teardown**  | Deletes every account the run created, and checks that the deleted session and login stop working                                                                                                                                                                                                     |

Each run creates **three test users** with unique emails (`lune.<random>@test.com`), so the suite can be run again and again. The Teardown folder deletes them at the end.

### How sign-in works in the tests

Login and Register responses set the `Lune_auth` cookie. An after-response script copies its value into the `{{token}}` runtime variable, and protected requests send it as a `Cookie: Lune_auth={{token}}` header. This works the same in the CLI and the app.

### Environment variables

Defined in [`environments/Development.yml`](endpoint-testing/lune-reference-api/environments/Development.yml):

| Variable         | Default                 | Used for                                                                                                                              |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`        | `http://localhost:3001` | Every request                                                                                                                         |
| `password`       | `Password1!`            | All test users; must meet the password rules                                                                                          |
| `gameId`         | `1020`                  | Game database (IGDB) ID of a game that is also sold on Steam (Grand Theft Auto V): game by ID, prices, favorites. Not a Steam app ID. |
| `nonSteamGameId` | `7346`                  | Game database (IGDB) ID of a game that isn't on Steam (Zelda: Breath of the Wild): prices `404`, second favorite                      |
| `unknownGameId`  | `999999999`             | A game database ID that doesn't exist: `404` tests                                                                                    |
| `developer`      | `Nintendo`              | Company search term                                                                                                                   |

All game IDs in the API (`/api/games/{id}`, `/api/favorites/{id}`, `/api/prices/{id}`) are game database IDs. The backend looks up the Steam app ID itself when it needs prices, so the tests never send one.

Values such as `runEmail`, `runName`, `token`, `genreSlug` and `developerSlug` are set while the suite runs. They aren't in the environment file.

### Running single requests

Open the collection folder `testing/endpoint-testing/lune-reference-api` in the Bruno desktop app, or in VS Code with the Bruno extension (`bruno-api-client.bruno`). Select the **Development** environment, then open any request and send it on its own. The response and the results of its tests appear next to it.

<!-- Screenshot: Bruno sidebar with the six folders and the environment selector -->

![A single request and its results in Bruno](../docs/images/bruno_request_results.png)

- **Health, Games and Prices** work on their own (except **Search Games - Filtered** and **By Developer**, which use values saved by **Get Filter Options** and **Search Companies**; send those first).
- **Auth, Favorites and Teardown** depend on earlier requests. To try one by hand, first send **Auth → Sign Out (setup)** (creates the test user names), then **Auth → Register**.

### Not covered

These are hard to trigger from a test and are checked by hand or in code review:

- `503` responses (need IGDB, Steam or GG.deals to be down)
- the `409` favorites limit (would need 1,000 favorites)
- free games on Steam currently return `503` instead of `404` (known bug)
- whether deleting an account also removes its favorites rows (not visible through the API)

---

## 4. Troubleshooting

| Symptom                                             | Likely cause                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every request fails with `ECONNREFUSED`             | The backend isn't running. Run `docker compose up -d` and wait for `/health/ready`.                                                                    |
| Games and Prices tests get `503`                    | IGDB keys missing or wrong in `.env`, or IGDB is unreachable.                                                                                          |
| Price test gets only a Steam price                  | `GGDEALS_API_KEY` is missing; the endpoint still returns `200` with the stores that answered.                                                          |
| Many Auth, Favorites or Teardown tests fail at once | An early Auth request failed (often **Register**). Fix the first failure; later ones usually follow from it.                                           |
| A run stopped halfway                               | Its test users weren't deleted. They are harmless, but `docker compose down -v` resets the whole local database. Careful: this deletes all local data. |
| `bru: command not found`                            | Install the CLI: `npm install -g @usebruno/cli`.                                                                                                       |
| `/docs` returns 404                                 | The backend isn't running in Development. Check `ASPNETCORE_ENVIRONMENT` in `docker-compose.yml`.                                                      |

---

## 5. Maintaining the tests

The maintenance scripts live in [`endpoint-testing/tools/`](endpoint-testing/tools) and are run from the repository root.

- **Adding a test:** add a request in the Bruno app (it keeps the URL and the query parameters in sync), put it in the right folder, and set its `seq` so it runs at the right point. Check the order with `node run-tests.mjs --dry-run`.
- **Query parameters must be in the URL.** The Bruno CLI only sends what's in the request's `url` field. If you edit `.yml` files by hand or import requests from the OpenAPI document, run:
``` bash
python3 testing/endpoint-testing/tools/fix_query_params.py testing/endpoint-testing/lune-reference-api
```
- **Regenerating the collection** from the reference requests (after a big API change):
``` bash
python3 testing/endpoint-testing/tools/build.py path/to/lune-reference-api    # run on a copy; overwrites files
python3 testing/endpoint-testing/tools/check.py path/to/lune-reference-api    # YAML, JSON bodies, variables, script syntax
```
- Add `reports/` to `.gitignore` so test reports aren't committed.

### Updating tests for new endpoints

When the API changes, start from the OpenAPI document the backend generates.

1. **Export the OpenAPI document.** With the project running, from the repository root:
``` bash
curl -s http://localhost:3001/openapi/v1.json -o docs/openapi.json
```
   This also keeps the copy in `docs/` up to date.

2. **Generate a fresh reference collection into a separate folder.** Don't import into `lune-reference-api`: that would overwrite the test suite.
``` bash
bru import openapi -s docs/openapi.json -o /tmp/lune-openapi-import \
  -n "Lune Reference API" --collection-format=opencollection
```
   (Requires the Bruno CLI from [Setup](#1-setup).)

3. **Copy the new or changed requests** from `/tmp/lune-openapi-import` into the matching folder of `lune-reference-api`. Give each one a `seq` that puts it at the right point in the run, and add its tests in the Bruno app.

4. **Fix the URLs and check the order:**
``` bash
python3 testing/endpoint-testing/tools/fix_query_params.py testing/endpoint-testing/lune-reference-api
cd testing/endpoint-testing/lune-reference-api && node run-tests.mjs --dry-run
```

5. **Run the suite** (`node run-tests.mjs`) and check the report.

---

## 6. Frontend unit tests

The Angular frontend has its own unit tests. `npm test` runs `ng test`, which uses Vitest.

**Requires** Node.js v22.22.3 or newer (or v24.15.0+ or v26.0.0+), the minimum the Angular CLI supports.

``` bash
cd frontend
npm install    # first time, or after package.json changes
npm test
```

These tests don't need the backend or Docker.

> **To do:** run the frontend unit tests and the Bruno suite in a CI/CD pipeline, so changes that break them are caught before merging.
