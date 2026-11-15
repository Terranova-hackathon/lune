# Lune Architecture

Lune (commercial name: LunaNova) is an open-source game discovery and price comparison platform built with **ASP.NET Core** (backend) and **Angular** (frontend), for the Terranova Software _Gaming Explorer_ challenge. It runs with Docker Compose.

## Design Philosophy

### Modular Backend

The backend follows a **modular architecture** where each feature owns its domain:

- **Loose coupling**: Modules communicate through shared interfaces, not direct dependencies
- **Independent data**: Each module owns its database schema and EF migrations
- **Plug-and-play**: New modules implement `IModule` (register services, map endpoints, initialize)
- **Extensibility**: Features like pricing use interface-based service registration, allowing new implementations without core changes

### Technology Choices

| Layer                | Technology                                                                | Why                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**          | ASP.NET Core 10 (.NET SDK 10)                                             | Type-safe, high-performance, modular with dependency injection                                                                                                                                                            |
| **Frontend**         | Angular 22                                                                | Component-based, reactive (RxJS), tested (Vitest), modern tooling                                                                                                                                                         |
| **Database**         | SQL Server 2022                                                           | Enterprise-grade, Schema-per-module isolation, EF Core integration                                                                                                                                                        |
| **Runtime**          | Docker Compose                                                            | One command starts the database, backend and frontend with hot reload; easy reset. A production configuration is planned ([FUTURE.md](./FUTURE.md#deployment-and-operations)).                                            |
| **Authentication**   | ASP.NET Core Identity, JWT in an HttpOnly cookie                          | The token can't be read by JavaScript (XSS-resistant); `SameSite=Lax` limits cross-site requests; no token handling in the frontend                                                                                       |
| **Game Data**        | IGDB (via Twitch OAuth)                                                   | Comprehensive game metadata, regular updates, free tier available. Replaced RAWG (the API the brief suggests) after a RAWG service outage; IGDB has no Metacritic score, so its aggregated critic rating is used instead. |
| **Pricing Data**     | GG.deals and Steam for current prices and historical lows; Italian region | IGDB has no pricing data, so price comparison needs additional APIs.                                                                                                                                                      |
| **API docs & tests** | OpenAPI + Scalar, Bruno                                                   | The reference is generated from the code, so it stays current; Bruno collections are plain files in Git                                                                                                                   |

---

## Docker Setup

### Container Architecture

``` mermaid
graph TB
    subgraph "Docker Compose Network (private-network)"
        SQL["SQL Server 2022<br/>Port: 1433<br/>Database: Lune"]
        API["ASP.NET Core API<br/>Port: 3001<br/>Health: /health/ready"]
        WEB["Angular Frontend<br/>Port: 8080<br/>Dev Server"]
    end

    SQL -->|TCP| API
    API -->|HTTP REST| WEB
    WEB -->|HTTP REST<br/>/api proxy| API

    API -->|HTTPS| IGDB["IGDB API<br/>Game Metadata"]
    API -->|HTTPS| Steam["Steam API<br/>Current Prices"]
    API -->|HTTPS| GGDeals["GG.deals API<br/>Current Prices"]

    style SQL fill:#0078d4,color:#fff
    style API fill:#68217a,color:#fff
    style WEB fill:#d32f2f,color:#fff
    style IGDB fill:#2e7d32,color:#fff
    style Steam fill:#2e7d32,color:#fff
    style GGDeals fill:#2e7d32,color:#fff
    style WEB fill:#d32f2f,color:#fff
```

## Backend Module Architecture

The backend is built on a **plugin module system**. Each module:

1. **Implements** `IModule` interface (register services, map endpoints, initialize)
2. **Owns** one database schema
3. **Communicates** with other modules via shared interfaces
4. **Registers** with the main app in `Program.cs`

### Module Connections Diagram

``` mermaid
graph LR
    subgraph "Lune.Api (Entry Point)"
        PROG["Program.cs<br/>Loads & Initializes Modules"]
    end

    subgraph "Core Modules"
        AUTH["AuthModule<br/>────────<br/>JWT signing<br/>User registration/login<br/>Account deletion<br/>Schema: auth"]

        GAMES["GamesModule<br/>────────<br/>Game search/filtering<br/>Game details<br/>IGDB integration<br/>Exports: IGameCatalog<br/>(Scoped)"]

        FAV["FavoritesModule<br/>────────<br/>Save/load user favorites<br/>Schema: favorites"]

        PRICES["PricesModule<br/>────────<br/>Price comparison<br/>Depends on: IGameCatalog<br/>No DB schema"]

        SHARED["Lune.Shared<br/>────────<br/>IModule interface<br/><br/>Contracts, models & interfaces"]
    end

    subgraph "SQL Server Database"
        DB[("SQL Server<br/>Database: Lune")]
        AUTHDB["Schema: auth<br/>────────<br/>AspNetUsers<br/>AspNetUserLogins<br/>AspNetRoles, etc."]
        FAVDB["Schema: favorites<br/>────────<br/>Favorites<br/>(UserId, GameId)"]
    end

    subgraph "External Data Sources"
        IGDB["IGDB API<br/>(Game Database)<br/>Steam App ID source"]
        STEAM["Steam API<br/>(Current Price)<br/>⚡ ACTIVE"]
        GGDEALS["GG.deals API<br/>(Price History)<br/>⚡ ACTIVE"]
    end

    PROG --> AUTH
    PROG --> GAMES
    PROG --> FAV
    PROG --> PRICES

    AUTH --> SHARED
    GAMES --> SHARED
    FAV --> SHARED
    PRICES --> SHARED

    GAMES --> IGDB
    PRICES -->|Gets Steam App ID| IGDB
    PRICES -->|Scoped DI<br/>IGameCatalog| GAMES
    PRICES -->|Use Steam App ID| STEAM
    PRICES -->|Use Steam App ID| GGDEALS

    FAV -.-> GAMES

    AUTH -->|IUserDataCleaner| FAV

    AUTH -->|EF Migrations<br/>SQL| DB
    DB --> AUTHDB
    FAV -->|EF Migrations<br/>SQL| DB
    DB --> FAVDB

    style PROG fill:#4527a0,color:#fff
    style AUTH fill:#1565c0,color:#fff
    style GAMES fill:#00796b,color:#fff
    style FAV fill:#c62828,color:#fff
    style PRICES fill:#f57f17,color:#fff
    style SHARED fill:#616161,color:#fff
    style DB fill:#0078d4,color:#fff
    style AUTHDB fill:#1565c0,color:#fff
    style FAVDB fill:#c62828,color:#fff
    style STEAM fill:#2e7d32,color:#fff
    style GGDEALS fill:#2e7d32,color:#fff
```

### Module Details

#### AuthModule

- **Storage**: SQL Server schema `auth` (ASP.NET Identity tables)
- **Auth Method**: JWT in HttpOnly cookie (`Lune_auth`, 24-hour expiration)
- **Integrations**: Calls `IUserDataCleaner` implementations on account deletion (currently only Favorites data requires cleaning)

#### GamesModule

- **Data Source**: IGDB (Internet Game Database) via Twitch OAuth token
- **Caching**: In-memory cache for search results (5 minutes), game details, filter options and featured-game candidates (10 minutes each); configurable through the `Igdb` options
- **Exports**: `IGameCatalog` interface for other modules to look up game metadata, external store IDs (Steam, GOG, Epic, etc.)

#### FavoritesModule

- **Storage**: SQL Server schema `favorites`, up to 1,000 favorites per user
- **Data Model**: Favorites store a snapshot of the game at save time (name, image, release date, ratings, genres, platforms) + the IGDB game ID, so the favorites list needs no IGDB calls
- **Data Cleanup**: Implements `IUserDataCleaner` to delete all a user's favorites when account is deleted

#### PricesModule

- **Data Flow**:
- Look up game's **Steam App ID** via `IGameCatalog.FindExternalIdsAsync()` (from IGDB data)
- Use that Steam App ID to fetch prices from registered `IPlatformPriceService` implementations
- Return all available prices or 503 if none succeed
- **Currently Active**:
- **Steam API** ⚡ — Current price (public endpoint, Italian region)
- **GG.deals API** ⚡ — Current price + historical low (Italian region)
- **Dependency Injection**: Receives `IGameCatalog` (Scoped) from Games module via DI container
- **Caching**: 6-hour in-memory cache per game and store; Steam app ID lookups cached for 24 hours
- **Error Handling**: If one platform fails, still return data from others

## Extensibility: Adding a New Price Service

The **PricesModule** is designed to scale to new price platforms without modifying the core API.

### Architecture Pattern

Each price platform implements `IPlatformPriceService`:

``` csharp
public interface IPlatformPriceService
{
    string PlatformName { get; }   // e.g. "Steam", "GG.deals"

    // Returns null if the game isn't available on this platform.
    Task<PlatformPrice?> GetPriceAsync(int steamAppId, CancellationToken cancellationToken = default);
}
```

`MultiPlatformPriceService` receives every registered implementation through dependency injection, calls each one, and combines the results.

### Adding a New Platform (e.g., Epic Games Store)

1. **Create a service** in `backend/src/Lune.Prices/Services/ExternalServices/EpicGamesService.cs` that implements `IPlatformPriceService`: call the store's API and return a `PlatformPrice`, or `null` if the store doesn't have the game.
2. **Add options** in `backend/src/Lune.Prices/Options/EpicGamesOptions.cs`: base URL, API key, cache duration, region.
3. **Register it** in `backend/src/Lune.Prices/PricesModule.cs`, next to Steam and GG.deals:

   ``` csharp
   services.Configure<EpicGamesOptions>(configuration.GetSection(EpicGamesOptions.SectionName));
   services.AddHttpClient<EpicGamesService>();
   services.AddScoped<IPlatformPriceService>(sp => sp.GetRequiredService<EpicGamesService>());
   ```

1. **Add the configuration:** the key in `.env.example` (and your `.env`), and its mapping in the backend's `environment` list in `docker-compose.yml`:

   ``` env
   EPIC_GAMES_API_KEY=...

   ```

   ``` yaml
   - EpicGames__ApiKey=${EPIC_GAMES_API_KEY}
   ```

1. **No other code changes are needed:** `GET /api/prices/{id}` includes the new store automatically. Add a test for it to the Bruno suite.

### Extension Diagram

``` mermaid
graph LR
    ENDPOINT["GET /api/prices/{gameId}"]
    MULTI["MultiPlatformPriceService<br/>(discovers all platforms)"]

    INTERFACE["IPlatformPriceService<br/>interface"]

    STEAM["SteamPriceService"]
    GGDEALS["GgDealsService"]
    EPIC["EpicGamesService<br/>(future)"]
    GOG["GogService<br/>(future)"]

    ENDPOINT --> MULTI
    MULTI --> INTERFACE

    INTERFACE -.-> STEAM
    INTERFACE -.-> GGDEALS
    INTERFACE -.-> EPIC
    INTERFACE -.-> GOG

    style ENDPOINT fill:#1565c0,color:#fff
    style MULTI fill:#00796b,color:#fff
    style INTERFACE fill:#616161,color:#fff
    style STEAM fill:#4527a0,color:#fff
    style GGDEALS fill:#4527a0,color:#fff
    style EPIC fill:#c0c0c0,color:#333
    style GOG fill:#c0c0c0,color:#333
```

## Frontend Architecture

The Angular app (`frontend/src/app`) is organized by responsibility:

| Folder           | Contents                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/`         | One folder per route: home, games (search results), game details, favorites, login, register, account, privacy, about. Larger pages are split into child components (e.g. the game details page: hero, gallery, facts, ratings, related games). |
| `shared/`        | Reusable components: navbar, footer, game card, filters, company search, featured-game carousel, price comparison.                                                                                                                              |
| `core/services/` | One service per backend area (`AuthService`, `GameService`, `FavoriteService`, `GamePriceService`), plus the theme and search-navigation state.                                                                                                 |
| `core/guards/`   | `authGuard`, which protects the favorites and account routes and sends guests to the login page.                                                                                                                                                |
| `core/models/`   | TypeScript types matching the API's responses.                                                                                                                                                                                                  |

- **State** is held in Angular signals; data flows use RxJS (debounced search input, `switchMap` to cancel outdated requests).
- **The signed-in user** is loaded once at startup (`GET /api/auth/me`, via an app initializer). The auth cookie itself is never touched by the frontend.
- **Search state lives in the URL** as query parameters, so results can be bookmarked, shared and reloaded.
- **API calls** use relative URLs (`/api/...`). In development the Angular dev server proxies them to the backend (`proxy.conf.js`), so frontend and API share one origin.

<!-- Diagram: page -> service -> API flow -->

## Health & Monitoring

The backend exposes two health endpoints:

- **GET `/health`** — Liveness probe (process running?). Returns `ok`.
- **GET `/health/ready`** — Readiness probe (database reachable?). Returns 200 or 503 with the status of each check.

The backend's Docker Compose health check uses `/health/ready` (5-second interval, 30-second start period, 20 retries), and the frontend container starts only once it reports healthy.

---

For the API, see [API.md](./API.md). For the database schema, see [DATABASE.md](./DATABASE.md). For what's planned, see [FUTURE.md](./FUTURE.md).
