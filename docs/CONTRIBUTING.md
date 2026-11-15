# Contributor guide

Everything needed to develop Lune (the internal name for LunaNova) day to day. To just run the app, the [Quick start in the README](./README.md#quick-start) is enough.

## Contents

1. [First-time setup](#first-time-setup)
2. [How the Docker setup works](#how-the-docker-setup-works)
3. [Everyday commands](#everyday-commands)
4. [Editor support](#editor-support)
5. [Running parts outside Docker](#running-parts-outside-docker)
6. [Project layout](#project-layout)
7. [Conventions](#conventions)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## First-time setup

Follow the [Quick start](./README.md#quick-start): create `.env` from `.env.example`, fill in the required values, run `docker compose up --build`.

Once it's running:

| What                                                 | Where                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Frontend (Angular dev server)                        | [http://localhost:8080](http://localhost:8080)                                      |
| Backend API, with a landing page listing every route | [http://localhost:3001](http://localhost:3001)                                      |
| API reference (Scalar)                               | [http://localhost:3001/docs](http://localhost:3001/docs)                            |
| OpenAPI document                                     | [http://localhost:3001/openapi/v1.json](http://localhost:3001/openapi/v1.json)      |
| SQL Server                                           | `localhost,1433`, user `sa`, password from `.env`; reachable from this machine only |

> **Upgrading an existing setup:** `.env` now sets `COMPOSE_PROJECT_NAME=lune`. Compose names containers, networks and volumes after the project, and before this change the project was named `terranova` (after the folder). If your old stack is still running, the new one fails with `Bind for 0.0.0.0:1433 failed: port is already allocated`. Stop the old stack once:
>
> ``` bash
> docker compose -p terranova down
> docker compose up -d
> ```
>
> Don't add `-v` unless you want to delete the old database. The new stack starts with a new, empty database volume (`lune_sqlserver-data`); migrations recreate the schema at startup. Your old data stays in `terranova_sqlserver-data` (see `docker volume ls`) until you remove it with `docker volume rm terranova_sqlserver-data`.

---

## How the Docker setup works

The configuration is split into two Compose files:

| File                          | Contains                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`          | What every environment shares: the three services, their network, the database volume, and the secrets from `.env`. |
| `docker-compose.override.yml` | Development only: published ports, bind-mounted source code, hot reload, health checks and startup order.           |

`docker compose up` loads both automatically. A production file can be added later next to them without changing the development setup.

The development containers:

| Service     | Image                                           | What it runs                                                                                                                              |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlserver` | SQL Server 2022                                 | The database. Data is kept in the `sqlserver-data` volume, so it survives restarts.                                                       |
| `backend`   | .NET 10 SDK (`backend/Dockerfile`, stage `dev`) | `dotnet watch` on `backend/src`, mounted from your machine. Saving a `.cs` file rebuilds and reloads. Database migrations run at startup. |
| `frontend`  | Node 22 (`frontend/Dockerfile`, stage `dev`)    | `ng serve` on `frontend/`, mounted from your machine. Saving a file reloads the browser. `/api` requests are proxied to the backend.      |

Things to know:

- **Your code lives on your machine.** The containers run it through bind mounts, so you edit with your normal tools.
- **Build output and packages stay inside the containers.** The backend's `bin/` and `obj/` folders and the frontend's `node_modules` are container-only volumes, so builds on your machine and in the containers never mix.
- **The environment is Development**, set by `ASPNETCORE_ENVIRONMENT` in `.env`. That's what turns on `/docs` and the OpenAPI document. The backend container ignores `launchSettings.json` (`--no-launch-profile`), so the value from `.env` is the one used.
- **Startup order:** SQL Server first, then the backend once the database answers, then the frontend once the backend's `/health/ready` reports healthy.

---

## Everyday commands

| Task                                            | Command                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| First start, or after changing a Dockerfile     | `docker compose up --build`                                                                                                       |
| Normal start                                    | `docker compose up` (add `-d` to run in the background)                                                                           |
| Edit backend or frontend code                   | Just save. `dotnet watch` / `ng serve` pick it up.                                                                                |
| After changing `package.json` (new npm package) | `docker compose up --build -V` (`-V` recreates `node_modules`)                                                                    |
| Add a NuGet package                             | `docker compose exec backend dotnet add src/Lune.Api package <Name>`. It edits the `.csproj` on your machine, and watch restarts. |
| Watch one service's logs                        | `docker compose logs -f backend`                                                                                                  |
| Run a command inside a container                | `docker compose exec backend <command>`                                                                                           |
| Restart one service                             | `docker compose restart backend`                                                                                                  |
| Check the merged Compose configuration          | `docker compose config`                                                                                                           |
| Stop everything                                 | `docker compose down`                                                                                                             |
| Stop and **delete the database**                | `docker compose down -v`. Careful: `-v` deletes all local data.                                                                   |

Rebuild (`--build`) only when a Dockerfile changes. Code changes never need a rebuild.

---

## Editor support

Running the app only needs Docker, but your editor needs the SDKs and packages locally to give you autocomplete and error checking. Without them, VS Code shows errors like `Cannot find module '@angular/core'`, because `node_modules` only exists inside the container.

| Area     | Install locally                                                                         | Then run                                    |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| Backend  | .NET 10 SDK: `sudo apt-get update && sudo apt-get install -y dotnet-sdk-10.0`           | `cd backend/src/Lune.Api && dotnet restore` |
| Frontend | Node.js v22.22.3 or newer (the Angular CLI's minimum; v24.15.0+ and v26.0.0+ also work) | `cd frontend && npm install`                |

`dotnet restore` installs every NuGet package the backend uses, including Scalar. `npm install` installs the Angular CLI and every frontend package. Nothing else needs to be installed separately.

**VS Code extensions:** C# Dev Kit, Angular Language Service (recommended in `frontend/.vscode/extensions.json`), and Bruno (`bruno-api-client.bruno`) for the API tests.

---

## Running parts outside Docker

Useful for debugging the backend in your IDE. Keep SQL Server in Docker and run the rest on your machine. This needs the [editor support](#editor-support) installs.

1. **Stop the containerized backend and frontend**, so their ports are free, and keep only the database:
``` bash
docker compose stop backend frontend
docker compose up -d sqlserver
```

2. **Run the backend** with the settings it would get from Compose, pointing at `localhost` instead of the `sqlserver` container:
``` bash
cd backend/src/Lune.Api
export ConnectionStrings__Default="Server=localhost,1433;Database=Lune;User Id=sa;Password=<SA_PASSWORD>;TrustServerCertificate=True"
export Jwt__Secret="<JWT_SECRET>"
export Igdb__ClientId="<IGDB_CLIENT_ID>"
export Igdb__ApiSecret="<IGDB_API_SECRET>"
export GgDeals__ApiKey="<GGDEALS_API_KEY>"
dotnet watch run
```
   Use the values from your `.env`. Outside Docker the backend uses `Properties/launchSettings.json`: Development, on [http://localhost:3001](http://localhost:3001). In an IDE, set the same variables in its run configuration.

3. **Run the frontend:**
``` bash
cd frontend
npm start
```
   It serves on [http://localhost:4200](http://localhost:4200) and proxies `/api` to `http://localhost:3001` (see `frontend/proxy.conf.js`).

---

## Project layout

| Path                         | What it is                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/Lune.Api`       | The host: `Program.cs` loads the modules, configures OpenAPI/Scalar and the health checks, and serves the landing page.                                                                                          |
| `backend/src/Lune.Auth`      | Accounts: registration, login, profile, account deletion. ASP.NET Core Identity, schema `auth`.                                                                                                                  |
| `backend/src/Lune.Games`     | Game search, details, filters, companies, featured games. Talks to IGDB; no database.                                                                                                                            |
| `backend/src/Lune.Favorites` | Saved games per user, schema `favorites`.                                                                                                                                                                        |
| `backend/src/Lune.Prices`    | Price comparison across Steam and GG.deals; no database.                                                                                                                                                         |
| `backend/src/Lune.Shared`    | Shared contracts and interfaces: `IModule`, `IGameCatalog`, `IUserDataCleaner`, paging, validation.                                                                                                              |
| `frontend/`                  | Angular app. Structure in [frontend/README.md](./frontend/README.md).                                                                                                                                            |
| `docs/`                      | Project documentation ([see the index in the README](./README.md#documentation)), `openapi.json`, the challenge brief.                                                                                           |
| `testing/`                   | Bruno API test suite and its tools. See [testing/README.md](./testing/README.md).                                                                                                                                |
| `mock-api/`                  | An early in-memory mock of the API. **Not maintained and not part of the build:** it predates IGDB, prices and the profile changes. Kept for possible future use; it needs updating before it can be used again. |

How the modules fit together: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Conventions

- **Image versions are pinned:** SQL Server in `docker-compose.yml`, the .NET SDK and Node in the Dockerfiles, so everyone builds the same thing. Update them on purpose, in their own commit, and run the version checks afterwards. Never move SQL Server to a lower build: a newer version can upgrade the database files, and an older one can't open them again.
- **Dev-only settings go only in `docker-compose.override.yml`.** Compose adds list settings such as `ports` and `volumes` from both files together, so a port listed in both is published twice and the container fails to start.
- **npm dependencies come from the lockfile.** The frontend image installs with `npm ci`. Add or upgrade packages with `npm install <package>` (or `npm update`) and commit the updated `package-lock.json` together with `package.json`.
- **Environment variables:** every variable the app reads is listed and explained in `.env.example`. Add new ones there, and never commit `.env`.
- **When the API changes:**
  - Update the endpoint metadata (summary, description, responses) so the Scalar reference stays accurate.
  - Regenerate `docs/openapi.json`: `curl -s http://localhost:3001/openapi/v1.json -o docs/openapi.json`.
  - Update [docs/API.md](./docs/API.md) if the overview changes.
  - Add tests to the Bruno suite: see [Maintaining the tests](./testing/README.md#5-maintaining-the-tests).
- **Database changes** are EF Core migrations in the module that owns the schema (`Lune.Auth/Data/Migrations`, `Lune.Favorites/Data/Migrations`). They run automatically at startup. Update [docs/DATABASE.md](./docs/DATABASE.md) with the change.

<!-- Team workflow: branch naming, pull requests and reviews, commit message style. Add here once agreed. -->

---

## Testing

API tests (Bruno), exploring the API (Scalar) and frontend unit tests are all in [testing/README.md](./testing/README.md).

---

## Troubleshooting

| Symptom                                                                             | Cause and fix                                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bind for 0.0.0.0:1433 failed: port is already allocated`                           | Another stack or a local SQL Server is using the port. See the upgrade note in [First-time setup](#first-time-setup), and run `docker ps` to find what's using it.                           |
| `failed to bind host port 127.0.0.1:1433/tcp: address already in use`               | Usually the same port listed in both Compose files. Run `docker compose config` and check that `ports` only appears in the override file.                                                    |
| Backend keeps restarting, or the frontend never starts                              | Usually a missing or invalid value in `.env` (`SA_PASSWORD` must meet the password rules). Check `docker compose logs backend`.                                                              |
| Game pages show errors; the API returns `503`                                       | `IGDB_CLIENT_ID` / `IGDB_API_SECRET` missing or wrong.                                                                                                                                       |
| A new npm package "isn't installed" in the container                                | The container's `node_modules` is reused. Run `docker compose up --build -V`.                                                                                                                |
| Frontend build fails with a lockfile error (`npm ci` ... out of sync)               | `package.json` and `package-lock.json` don't match, e.g. after a hand edit to `package.json`. Run `npm install` in `frontend/` on your machine, then commit the updated `package-lock.json`. |
| `/docs` returns 404                                                                 | The backend isn't in Development. Check `ASPNETCORE_ENVIRONMENT` in `.env`, then `docker compose up -d backend`.                                                                             |
| Log shows `Failed to read '.../obj\Debug/net10.0/staticwebassets.development.json'` | Harmless `dotnet watch` path bug on Linux; the app works normally. Only live reload of files in `wwwroot` is affected.                                                                       |
| Start over with an empty database                                                   | `docker compose down -v`, then `docker compose up`. This deletes all local data.                                                                                                             |
