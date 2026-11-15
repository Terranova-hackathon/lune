# Future work

Features we've planned, or prepared for in the architecture, but haven't built yet, plus known limitations we intend to fix. For what's already done, see [FEATURES.md](./FEATURES.md).

Each item notes what's already in place and where it would go. Sections marked _(details to add)_ are placeholders for the team.

## Contents

1. [Features](#features)
2. [Platform and data](#platform-and-data)
3. [Security and accounts](#security-and-accounts)
4. [Deployment and operations](#deployment-and-operations)
5. [Developer experience](#developer-experience)

---

## Features

### Wishlist (brief §VII.4)

A list of games to buy or try later, separate from favorites.

- **Already in place:** the Favorites module is a template: per-user rows with a copy of the game, a limit, paging, and cleanup on account deletion.
- **What's needed:** a list type on the existing table, or a sibling module with its own schema. Combined with price comparison, a wishlist could flag price drops.

### More price sources

Epic Games Store, GOG and others.

- **Already in place:** each store is an `IPlatformPriceService`; adding one means one class and one registration line. See [ARCHITECTURE.md](./ARCHITECTURE.md#extensibility-adding-a-new-price-service).
- **Also planned:** a fuller Steam integration with a Steam API key (`STEAM_API_KEY` in `.env.example`). Today the public store endpoint is used.

### Release year filter

Not required for the challenge (clarified with Terranova); results can already be sorted by release date. Listed here as a possible enhancement.

- **Already in place:** IGDB stores each game's first release date, and the search already filters on it (games without a date are excluded).
- **What's needed:** `releasedFrom` / `releasedTo` (year) parameters in the games search and its validation, a range control in the filters, and tests in the Bruno suite.

---

## Platform and data

### Per-user region and currency for prices

Prices are fixed to the Italian region (EUR), set in configuration (`GgDeals:Region`, `Steam:CurrencyCode`). The GG.deals cache key already includes the region; the Steam cache key would need it too before a per-user setting is added.

### Refreshing favorite snapshots

Each favorite stores a copy of the game's summary from when it was saved, plus the time of that copy (`SnapshotUpdatedAtUtc`). Nothing refreshes those copies yet, so ratings or platforms can go out of date. The planned job re-fetches favorites whose copy is older than, for example, 7 days. The column and the `IgdbId` index it needs are already in place.

### Free games on Steam return 503

When no store returns a price, for example for a free-to-play game on Steam, the price endpoint returns `503 Price data is currently unavailable` instead of `404 No price data found`. This is a known bug to fix in `MultiPlatformPriceService`.

### Alternative game data provider

The original RAWG integration is still in the backend, commented out (`Lune.Games/Services/Rawg/`, and its registration in `GamesModule`). Because games are served through `IGamesService`, it could be brought back up to date and switched on, or used as a fallback if IGDB is unavailable.

---

## Security and accounts

- **Login rate limiting / lockout:** repeated failed logins aren't slowed down yet. ASP.NET Identity's lockout (the `AccessFailedCount` and `LockoutEnd` columns already exist) or ASP.NET Core rate limiting would add it.
- **Password reset:** a `forgot-password` endpoint is stubbed out in `AuthEndpoints`. It needs an email service.
- **External logins** (e.g. GitHub OAuth): the Identity tables for external logins (`AspNetUserLogins`) are already created.
- **Roles and admin features:** the role tables (`AspNetRoles`, `AspNetUserRoles`) are already created.
- **Unique display names at database level:** uniqueness is checked in code; a filtered unique index (allowing several users without a name) would also prevent two simultaneous sign-ups from taking the same name.
- **Consistent validation error keys:** registration errors are keyed by field name (`Email`, `Password`), but Identity errors from the profile and delete endpoints are still keyed by Identity error code.

---

## Deployment and operations

The current Docker setup is for development. A production setup is planned:

- **Production images:** a multi-stage backend build (`dotnet publish`, then the small ASP.NET runtime image) and a frontend built with `ng build` and served as static files.
- **A production Compose file** next to the existing two (`docker-compose.prod.yml`): no bind mounts, no published database port, `ASPNETCORE_ENVIRONMENT=Production`.
- **Health checks without `curl`**, which the runtime image doesn't include.
- **HTTPS behind a reverse proxy.** The auth cookie is marked `Secure` automatically when the request is HTTPS.
- **A decision on the API reference:** `/docs` is currently only served in Development.
- **CI:** run the frontend unit tests and the Bruno suite on every pull request.

---

## Developer experience

- **Update the mock API** (`mock-api/`) to match the current backend (IGDB data, prices, profile), so the frontend can be developed without SQL Server or API keys. It's currently not maintained and not part of the build.
- **Lock icons in the API reference** for endpoints that need sign-in (a cookie security scheme in the OpenAPI document).
- **Remove the `staticwebassets` warning** that `dotnet watch` logs on Linux (a path bug; workaround with a `Directory.Build.props`).
