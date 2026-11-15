# Lune

**Lune** is an opensource game search engine. Designed to be hosted as complete web-app: anyone can search and browse games, and signed-in users can save favorites. This repository (Lune) holds the whole stack: an ASP.NET Core backend, SQL Server and an Angular frontend.

## Contents

1. [Quick start](#quick-start)
2. [How the Docker setup works](#how-the-docker-setup-works)
3. [Everyday commands](#everyday-commands)
4. [Editor support](#editor-support)
5. [Running parts outside Docker](#running-parts-outside-docker)
6. [Project layout](#project-layout)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Quick start

**Requirements:** Docker Engine and the Docker Compose plugin. Nothing else is needed to run the app.

1. **Create your `.env`:**

``` bash
cp .env.example .env
```

Fill in the values marked **REQUIRED**: `SA_PASSWORD`, `JWT_SECRET`, `IGDB_CLIENT_ID` and `IGDB_API_SECRET`. `GGDEALS_API_KEY` is strongly recommended. Each value has a comment explaining where to get it.

1. **Start everything:**

``` bash
docker compose up --build
```

The first start takes a few minutes (images, packages, database setup). The frontend starts once the backend reports that it's ready.

1. **Open the app:**

| What                   | URL                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Frontend (Angular)     | [http://localhost:8080](http://localhost:8080)                                     |
| Backend API            | [http://localhost:3001](http://localhost:3001): a landing page listing every route |
| API reference (Scalar) | [http://localhost:3001/docs](http://localhost:3001/docs)                           |
| SQL Server             | `localhost,1433` (user `sa`, password from `.env`), from this machine only         |

Press `Ctrl+C` to stop, or run `docker compose down`.

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

`docker compose up` loads both automatically, so there's nothing extra to type. A production file can be added later next to them without changing the development setup.

The development containers:

| Service     | Image                                           | What it runs                                                                                                                              |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlserver` | SQL Server 2022                                 | The database. Data is kept in the `sqlserver-data` volume, so it survives restarts.                                                       |
| `backend`   | .NET 10 SDK (`backend/Dockerfile`, stage `dev`) | `dotnet watch` on `backend/src`, mounted from your machine. Saving a `.cs` file rebuilds and reloads. Database migrations run at startup. |
| `frontend`  | Node 22 (`frontend/Dockerfile`, stage `dev`)    | `ng serve` on `frontend/`, mounted from your machine. Saving a file reloads the browser. `/api` requests are proxied to the backend.      |

Things to know:

- **Your code lives on your machine.** The containers run it through bind mounts, so you edit with your normal tools.
- **Build output and packages stay inside the containers.** The backend's `bin/` and `obj/` folders and the frontend's `node_modules` are container-only volumes, so builds on your machine and in the containers never mix.
- **The environment is Development**, set by `ASPNETCORE_ENVIRONMENT` in `.env`. That's what turns on `/docs`.
- **Startup order:** SQL Server first, then the backend once the database answers, then the frontend once the backend's `/health/ready` reports healthy.
- **Image versions are pinned** (SQL Server in `docker-compose.yml`, the .NET SDK and Node in the Dockerfiles), so everyone builds the same thing. Update them on purpose, in their own commit. Never move SQL Server to a lower build: a newer version can upgrade the database files, and an older one can't open them again.
- **Dev-only settings go only in the override file.** Compose adds list settings such as `ports` and `volumes` from both files together, so a port listed in both is published twice and the container fails to start. `docker compose config` shows the merged result.

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

`dotnet restore` installs every NuGet package the backend uses (including Scalar for the API reference), and `npm install` installs the Angular CLI and every frontend package. Nothing needs to be installed separately.

**VS Code extensions:** C# Dev Kit, Angular Language Service (recommended in `frontend/.vscode/extensions.json`), and Bruno (`bruno-api-client.bruno`) for the API tests.

---

## Running parts outside Docker

Useful for debugging the backend in your IDE. Keep SQL Server in Docker and run the rest on your machine. This needs the [editor support](#editor-support) installs.

1. **Start only the database:**

``` bash
docker compose up -d sqlserver
```

1. **Run the backend** with the settings it would get from Compose, pointing at `localhost` instead of the `sqlserver` container:

``` bash
cd backend/src/Lune.Api
export ConnectionStrings__Default="Server=localhost,1433;Database=Lune;User Id=sa;Password=<SA_PASSWORD>;TrustServerCertificate=True"
export Jwt__Secret="<JWT_SECRET>"
export Igdb__ClientId="<IGDB_CLIENT_ID>"
export Igdb__ApiSecret="<IGDB_API_SECRET>"
export GgDeals__ApiKey="<GGDEALS_API_KEY>"
dotnet watch run
```

Use the values from your `.env`. The backend runs on [http://localhost:3001](http://localhost:3001) in Development, from `Properties/launchSettings.json`. In an IDE, set the same variables in its run configuration.

1. **Run the frontend:**

``` bash
cd frontend
npm start
```

It serves on [http://localhost:4200](http://localhost:4200) and proxies `/api` to `http://localhost:3001` (see `frontend/proxy.conf.js`).

Stop the containerized backend and frontend first (`docker compose stop backend frontend`), or their ports will clash.

---

## Project layout

| Path           | What it is                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/` | Modular ASP.NET Core API: `Lune.Api` (host), `Lune.Auth`, `Lune.Games`, `Lune.Favorites`, `Lune.Prices`, `Lune.Shared`. Each module owns its database schema and applies its EF Core migrations at startup.                |
| `frontend/`    | Angular app                                                                                                                                                                                                                |
| `docs/`        | [API.md](./docs/API.md) (endpoint overview), [DATABASE.md](./docs/DATABASE.md) (schema), `openapi.json` (generated API description)                                                                                        |
| `testing/`     | API tests and test documentation                                                                                                                                                                                           |
| `mock-api/`    | Old in-memory mock of the API. **Not maintained and not part of the build**: it predates the current backend (IGDB, prices, profile changes). Kept for possible future use; it needs updating before it can be used again. |

**About the API:** all routes are under `/api` (e.g. `/api/favorites`). Sign-in uses an HttpOnly `Lune_auth` cookie, set by `POST /api/auth/register` or `POST /api/auth/login`. Game data comes from IGDB, and prices from Steam and GG.deals. The full reference, with request and response details, is at [http://localhost:3001/docs](http://localhost:3001/docs).

---

## Testing

API tests (Bruno), exploring the API (Scalar) and frontend unit tests are documented in [testing/README.md](./testing/README.md).

---

## Troubleshooting

| Symptom                                                                             | Cause and fix                                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bind for 0.0.0.0:1433 failed: port is already allocated`                           | Another stack or a local SQL Server is using the port. See [Upgrading an existing setup](#quick-start). Run `docker ps` to find what's using it.                                             |
| Backend keeps restarting, or the frontend never starts                              | Usually a missing or invalid value in `.env` (`SA_PASSWORD` must meet the password rules). Check `docker compose logs backend`.                                                              |
| Game pages show errors; the API returns `503`                                       | `IGDB_CLIENT_ID` / `IGDB_API_SECRET` missing or wrong.                                                                                                                                       |
| A new npm package "isn't installed" in the container                                | The container's `node_modules` is reused. Run `docker compose up --build -V`.                                                                                                                |
| Frontend build fails with a lockfile error (`npm ci` ... out of sync)               | `package.json` and `package-lock.json` don't match, e.g. after a hand edit to `package.json`. Run `npm install` in `frontend/` on your machine, then commit the updated `package-lock.json`. |
| `/docs` returns 404                                                                 | The backend isn't in Development. Check `ASPNETCORE_ENVIRONMENT` in `.env`, then `docker compose up -d backend`.                                                                             |
| Log shows `Failed to read '.../obj\Debug/net10.0/staticwebassets.development.json'` | Harmless `dotnet watch` path bug on Linux; the app works normally. Only live reload of files in `wwwroot` is affected.                                                                       |
| Start over with an empty database                                                   | `docker compose down -v`, then `docker compose up`. This deletes all local data.                                                                                                             |
