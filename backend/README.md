# LunaNova backend

The ASP.NET Core 10 API for LunaNova (internal name: Lune). It serves game data from IGDB, prices from Steam and GG.deals, and user accounts and favorites from SQL Server, to the Angular frontend.

| Looking for                           | Where                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| What each endpoint does               | [docs/API.md](../docs/API.md), and the interactive reference at [localhost:3001/docs](http://localhost:3001/docs) |
| How the modules fit together, and why | [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)                                                                   |
| Database schemas and tables           | [docs/DATABASE.md](../docs/DATABASE.md)                                                                           |
| API tests                             | [testing/README.md](../testing/README.md)                                                                         |

## Running it

**With Docker (the usual way):** from the repository root, `docker compose up`. The API runs on [http://localhost:3001](http://localhost:3001) with `dotnet watch`, so saving a `.cs` file rebuilds and reloads. Database migrations run at startup. See the [contributor guide](../CONTRIBUTING.md).

**On your machine** (needs the .NET 10 SDK), with SQL Server still in Docker:

``` bash
docker compose stop backend frontend
docker compose up -d sqlserver
cd backend/src/Lune.Api
# set the configuration below as environment variables, then:
dotnet watch run
```

Outside Docker the API uses `Properties/launchSettings.json`: the Development environment, on `http://localhost:3001`. The full steps are in [Running parts outside Docker](../CONTRIBUTING.md#running-parts-outside-docker).

| URL                                                                                                        | What it is                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [localhost:3001](http://localhost:3001)                                                                    | Developer landing page: every route with its access level, plus quick register/login/logout/delete buttons |
| [localhost:3001/docs](http://localhost:3001/docs)                                                          | API reference (Scalar), Development only                                                                   |
| [localhost:3001/openapi/v1.json](http://localhost:3001/openapi/v1.json)                                    | OpenAPI document, Development only                                                                         |
| [localhost:3001/health](http://localhost:3001/health), [/health/ready](http://localhost:3001/health/ready) | Liveness and readiness checks                                                                              |

## Configuration

Settings come from environment variables. Docker Compose fills them in from `.env` (see `.env.example`). Nested settings use a double underscore: `Igdb__ClientId` sets `Igdb:ClientId`.

**Required:**

| Variable                            | From `.env`                         | What it is                                              |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `ConnectionStrings__Default`        | built from `SA_PASSWORD`            | SQL Server connection string                            |
| `Jwt__Secret`                       | `JWT_SECRET`                        | Key for signing login tokens, at least 32 characters    |
| `Igdb__ClientId`, `Igdb__ApiSecret` | `IGDB_CLIENT_ID`, `IGDB_API_SECRET` | IGDB credentials (a Twitch developer app)               |
| `ASPNETCORE_ENVIRONMENT`            | `ASPNETCORE_ENVIRONMENT`            | `Development` turns on `/docs` and the OpenAPI document |

**Optional:**

| Variable                                                                                         | Default           | What it is                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------- |
| `GgDeals__ApiKey`                                                                                | none              | GG.deals prices. Without it, prices come from Steam only.                     |
| `Jwt__ExpirationMinutes`                                                                         | `1440` (24 hours) | Login session length                                                          |
| `Jwt__CookieName`                                                                                | `Lune_auth`       | Name of the auth cookie                                                       |
| `Igdb__SearchCacheMinutes`                                                                       | `5`               | How long search results are cached                                            |
| `Igdb__GameDetailsCacheMinutes`, `Igdb__FilterOptionsCacheMinutes`, `Igdb__FeaturedCacheMinutes` | `10` each         | How long game details, filter options and featured-game candidates are cached |
| `Steam__CacheMinutes`, `GgDeals__CacheMinutes`                                                   | `360` (6 hours)   | How long prices are cached                                                    |
| `GgDeals__Region`, `Steam__CurrencyCode`                                                         | `it`              | Price region (Italy)                                                          |

The defaults are in each module's `Options/` folder. Add any new setting to `.env.example` and to the backend's `environment` list in `docker-compose.yml`.

## Project structure

The backend is one ASP.NET Core application split into modules, each in its own project under `src/`:

| Project          | Responsibility                                                                                                                                                        | Database           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `Lune.Api`       | The host. `Program.cs` loads the modules, configures OpenAPI, Scalar and health checks, and serves the landing page (`LandingPage.cs`) and static files (`wwwroot/`). | none               |
| `Lune.Auth`      | Registration, login, logout, profile, account deletion. ASP.NET Core Identity; JWT in an HttpOnly cookie.                                                             | schema `auth`      |
| `Lune.Games`     | Game search, details, filter options, company search, featured games. Talks to IGDB, and provides `IGameCatalog` to other modules.                                    | none               |
| `Lune.Favorites` | Saved games per user, with a copy of each game's summary. Cleans up a user's data on account deletion.                                                                | schema `favorites` |
| `Lune.Prices`    | Price comparison across stores (Steam, GG.deals), matched through the Steam app ID.                                                                                   | none               |
| `Lune.Shared`    | Contracts and interfaces shared by the modules: `IModule`, `IGameCatalog`, `IUserDataCleaner`, paging, validation, game contracts.                                    | none               |

Inside a module, folders follow the same pattern:

| Folder            | Contents                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Endpoints/`      | Route definitions and handlers, including the OpenAPI metadata (summaries, descriptions, responses) shown in Scalar |
| `Services/`       | Business logic and calls to outside APIs                                                                            |
| `Contracts/`      | Request and response types (types shared between modules, such as the game contracts, live in `Lune.Shared`)        |
| `Models/`         | Shapes of outside APIs' responses (IGDB, Steam, GG.deals)                                                           |
| `Options/`        | Typed configuration, bound from a named section (e.g. `Igdb`)                                                       |
| `Data/`           | `DbContext`, entities, design-time factory and `Migrations/` (database modules only)                                |
| `<Name>Module.cs` | The module's entry point (see below)                                                                                |

**Main packages:** ASP.NET Core Identity with EF Core, JWT bearer authentication, EF Core for SQL Server, Microsoft.AspNetCore.OpenApi, Scalar.AspNetCore, and the EF Core health checks.

### Modules

Every module implements `IModule` from `Lune.Shared`:

``` csharp
public interface IModule
{
    void AddServices(IServiceCollection services, IConfiguration configuration);
    void MapEndpoints(IEndpointRouteBuilder endpoints);

    // Runs once at startup after the app is built (e.g. database migrations).
    Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
```

`Program.cs` creates the list of modules and calls these three methods on each in turn. Modules don't reference each other. When one needs another's data, it uses an interface from `Lune.Shared`: Prices and Favorites look games up through `IGameCatalog`, and Auth calls every `IUserDataCleaner` when an account is deleted.

**Adding a module:**

1. Create `src/Lune.<Name>` as a class library and reference `Lune.Shared`.
2. Add a `<Name>Module` class implementing `IModule`: register services in `AddServices`, map routes in `MapEndpoints` (under `/api/<name>`, with `.WithTags("<Name>")`), and migrate its database in `InitializeAsync` if it has one.
3. Reference the project from `Lune.Api` and add `new <Name>Module()` to the module list in `Program.cs`.
4. Document its endpoints (summary, description, responses) so they appear in Scalar, and add a section description in `Program.cs`'s document transformer.

## Database migrations

Each database module owns its schema and migrations. At startup, `InitializeAsync` applies any pending migrations, retrying while SQL Server is still starting (common right after `docker compose up`).

To **add a migration** after changing a module's entities, from `backend/src` on your machine:

``` bash
dotnet tool install --global dotnet-ef    # once

dotnet ef migrations add <MigrationName> \
  --project Lune.Favorites \
  --startup-project Lune.Api \
  --context FavoritesDbContext
```

Use `--project Lune.Auth --context AuthDbContext` for the `auth` schema. Each module has a design-time factory (`Data/*DbContextFactory.cs`), so creating a migration doesn't need a running database. The migration is applied the next time the backend starts. Describe the change in [docs/DATABASE.md](../docs/DATABASE.md) as well.

## Conventions

- **Routes** live under `/api/<module>` and are grouped with `.WithTags(...)`, which becomes their section in Scalar.
- **Errors** use Problem Details: `Results.ValidationProblem(...)` for invalid input, `Results.Problem(...)` with a `title` and `detail` for everything else, and `503` when an outside provider fails.
- **Validation:** request bodies use data annotations, checked with `RequestValidator.TryValidate`; query parameters are checked in the handler, or in a parser like `GameSearchFilterParser`.
- **Signed-in user:** endpoints that need one use `.RequireAuthorization()` and read the user ID from the token (`User.GetUserId()`), never from the request.
- **Documentation:** each endpoint has `.WithName`, `.WithSummary`, `.WithDescription` and `.Produces...` for every response, and `[Description]` on its parameters. After changing an endpoint, regenerate `docs/openapi.json` (see the [contributor guide](../CONTRIBUTING.md#conventions)).
