# Lune database schema

One SQL Server database (`Lune`). Follows [ASP.NET Core authentication](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/?view=aspnetcore-10.0) standards. Each backend module owns its own **schema** and its own EF Core `DbContext` and migrations, which are applied automatically on startup. Each schema has its own `__EFMigrationsHistory` table.

| Module    | SQL schema  | Purpose                                                                   |
| --------- | ----------- | ------------------------------------------------------------------------- |
| Auth      | `auth`      | User authentication, roles, and claims (ASP.NET Identity + custom fields) |
| Favorites | `favorites` | User game favorites with game data snapshots                              |
| Games     | —           | No database storage. Data sourced from IGDB API, cached in memory.        |

## Architecture overview

**Game data** is not persisted in the database—it comes from the IGDB API and is cached in memory. When a user favorites a game, a **snapshot** of the game's metadata (name, image, rating, critic score, genres, platforms, release date) is stored in the `Favorites` table, so the favorites list loads without calling IGDB. Snapshots aren't refreshed yet; a refresh job is planned (see [FUTURE.md](./FUTURE.md#refreshing-favorite-snapshots)).

**User identity and authorization** use ASP.NET Core Identity with standard tables (`AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, etc.) plus three custom columns on `AspNetUsers` for additional metadata.

The `Favorites` table references `AspNetUsers.Id` but **has no database foreign key**—modules are intentionally decoupled so each can move to its own database independently. The API layer enforces ownership by validating the user ID from the auth token.

### Currently utilized tables

- **`auth.AspNetUsers`** — actively used for user registration and login
- **`auth.__EFMigrationsHistory`** — tracks EF Core migrations for the auth schema
- **`favorites.Favorites`** — actively used to store and retrieve user favorites
- **`favorites.__EFMigrationsHistory`** — tracks EF Core migrations for the favorites schema

### Tables created but not yet utilized

The following tables are created as part of the ASP.NET Core Identity framework but are **not actively saving or using data** as of now:

- **`auth.AspNetRoles`**, **`auth.AspNetUserRoles`** — role-based authorization (reserved for future multi-tenant or admin features)
- **`auth.AspNetUserClaims`**, **`auth.AspNetRoleClaims`** — fine-grained claims-based authorization (reserved for future access control)
- **`auth.AspNetUserTokens`** — token storage for OAuth and refresh tokens (reserved for multi-provider auth scaling)
- **`auth.AspNetUserLogins`** — external login credentials (reserved for GitHub OAuth or third-party auth integration)

These tables exist to support planned features and to follow ASP.NET Identity conventions, avoiding schema changes down the road when authorization and multi-provider auth are needed.

## ER diagram

``` mermaid
erDiagram
    AspNetUsers ||--o{ AspNetUserClaims : has
    AspNetUsers ||--o{ AspNetUserRoles : has
    AspNetUsers ||--o{ AspNetUserTokens : has
    AspNetUsers ||--o{ AspNetUserLogins : has
    AspNetUsers ||--o{ Favorites : owns
    AspNetRoles ||--o{ AspNetUserRoles : assigned-to
    AspNetRoles ||--o{ AspNetRoleClaims : has
    AspNetUsers {
        nvarchar450 Id PK
        nvarchar256 Email UK
        nvarchar256 UserName
        nvarchar_max DisplayName "custom"
        nvarchar_max PasswordHash
        datetime2 CreatedAtUtc "custom"
        datetime2 PrivacyConsentedAtUtc "custom, nullable"
        bit EmailConfirmed
        nvarchar_max SecurityStamp
        nvarchar_max ConcurrencyStamp
        int AccessFailedCount
        datetimeoffset LockoutEnd "nullable"
    }
    AspNetRoles {
        nvarchar450 Id PK
        nvarchar256 Name UK
        nvarchar_max ConcurrencyStamp
    }
    AspNetUserRoles {
        nvarchar450 UserId PK
        nvarchar450 RoleId PK
    }
    AspNetUserClaims {
        int Id PK
        nvarchar450 UserId FK
        nvarchar_max ClaimType
        nvarchar_max ClaimValue
    }
    AspNetRoleClaims {
        int Id PK
        nvarchar450 RoleId FK
        nvarchar_max ClaimType
        nvarchar_max ClaimValue
    }
    AspNetUserTokens {
        nvarchar450 UserId PK
        nvarchar450 LoginProvider PK
        nvarchar450 Name PK
        nvarchar_max Value
    }
    AspNetUserLogins {
        nvarchar450 LoginProvider PK
        nvarchar450 ProviderKey PK
        nvarchar_max ProviderDisplayName
        nvarchar450 UserId FK
    }
    Favorites {
        nvarchar450 UserId PK "no FK"
        int IgdbId PK
        nvarchar300 Name "snapshot"
        nvarchar500 BackgroundImage "snapshot, nullable"
        nvarchar10 Released "snapshot, nullable"
        float Rating "snapshot"
        int Metacritic "snapshot, nullable"
        nvarchar_max Genres "JSON array"
        nvarchar_max Platforms "JSON array"
        datetime2 CreatedAtUtc
        datetime2 SnapshotUpdatedAtUtc "when snapshot refreshed"
    }
```

## Schema `auth` (ASP.NET Identity)

Standard ASP.NET Identity tables plus three custom columns on `AspNetUsers` for app-specific data.

### `auth.AspNetUsers`

| Column                  | Type           | Null | Notes                                                                            |
| ----------------------- | -------------- | :--: | -------------------------------------------------------------------------------- |
| `Id`                    | nvarchar(450)  |  No  | **PK**, GUID string                                                              |
| `DisplayName`           | nvarchar(max)  | Yes  | **Custom**. Unique (case-insensitive) when set; checked in code, not by an index |
| `CreatedAtUtc`          | datetime2      |  No  | **Custom**, set at registration                                                  |
| `PrivacyConsentedAtUtc` | datetime2      | Yes  | **Custom**, server-recorded UTC consent time; null for existing accounts         |
| `UserName`              | nvarchar(256)  | Yes  | Same as `Email` at registration                                                  |
| `NormalizedUserName`    | nvarchar(256)  | Yes  | Uppercased. **Unique index**                                                     |
| `Email`                 | nvarchar(256)  | Yes  |                                                                                  |
| `NormalizedEmail`       | nvarchar(256)  | Yes  | Uppercased. Index                                                                |
| `EmailConfirmed`        | bit            |  No  | Always false (no confirmation flow)                                              |
| `PasswordHash`          | nvarchar(max)  | Yes  | Salted PBKDF2 hash. Never the password.                                          |
| `SecurityStamp`         | nvarchar(max)  | Yes  |                                                                                  |
| `ConcurrencyStamp`      | nvarchar(max)  | Yes  |                                                                                  |
| `PhoneNumber`           | nvarchar(max)  | Yes  | Unused                                                                           |
| `PhoneNumberConfirmed`  | bit            |  No  | Unused                                                                           |
| `TwoFactorEnabled`      | bit            |  No  | Unused                                                                           |
| `LockoutEnd`            | datetimeoffset | Yes  | Unused: login lockout isn't enabled yet                                          |
| `LockoutEnabled`        | bit            |  No  |                                                                                  |
| `AccessFailedCount`     | int            |  No  | Unused: login lockout isn't enabled yet                                          |

Indexes: `PK_AspNetUsers (Id)`, `UserNameIndex (NormalizedUserName) UNIQUE WHERE NOT NULL`, `EmailIndex (NormalizedEmail)`.

## Schema `favorites`

### `Favorites`

Stores user-favorited games. Each row holds a **snapshot** of the game's metadata from IGDB at the time of favoriting. A planned job will refresh old snapshots so game data stays current (e.g., rating changes, new platforms added) without the user re-favoriting; until then, a snapshot keeps the values from when the game was saved.

| Column                 | Type          | Null | Notes                                                                                    |
| ---------------------- | ------------- | :--: | ---------------------------------------------------------------------------------------- |
| `UserId`               | nvarchar(450) |  No  | **PK part 1**. The `auth.AspNetUsers.Id` of the owner. **No FK**—modules are decoupled.  |
| `IgdbId`               | int           |  No  | **PK part 2**. IGDB game ID.                                                             |
| **Snapshot columns**   |               |      |                                                                                          |
| `Name`                 | nvarchar(300) |  No  | Game name (truncated to 300 chars)                                                       |
| `BackgroundImage`      | nvarchar(500) | Yes  | Cover image URL (truncated to 500 chars, `null` if longer)                               |
| `Released`             | nvarchar(10)  | Yes  | Release date in `yyyy-MM-dd` format                                                      |
| `Rating`               | float         |  No  | IGDB user rating, scaled to 0–5                                                          |
| `Metacritic`           | int           | Yes  | Critic score, 0–100 (IGDB's aggregated critic rating, shown as the Metacritic score)     |
| `Genres`               | nvarchar(max) |  No  | JSON array of `{Value, Name}` objects, e.g. `[{"Value":"adventure","Name":"Adventure"}]` |
| `Platforms`            | nvarchar(max) |  No  | JSON array of `{Value, Name}` objects; `Value` is the IGDB platform ID                   |
| **Tracking columns**   |               |      |                                                                                          |
| `CreatedAtUtc`         | datetime2     |  No  | When the user favorited this game. Sorts the user's list newest-first.                   |
| `SnapshotUpdatedAtUtc` | datetime2     |  No  | When the snapshot was taken. Reserved for the planned refresh job, to find stale rows.   |

**Key design decisions:**

- **Snapshots are immutable at insert.** Snapshot columns are populated from IGDB when the game is favorited; the client never provides them.
- **Composite PK `(UserId, IgdbId)`** ensures a user can favorite each game at most once. Duplicate inserts are automatically rejected.
- **No foreign key on `UserId`.** Intentional decoupling: `favorites` schema can move to its own database without changing the auth schema. Consequences:
- Ownership is enforced by the API layer: the user ID is extracted from the auth token, never trusted from the client.
- **`SnapshotUpdatedAtUtc` is ready for refresh logic.** The planned job would query rows where `SnapshotUpdatedAtUtc < now - 7 days`, re-fetch them from IGDB, and update only the snapshot columns. It isn't implemented yet.
- **Limit: 1000 favorites per user.** Enforced in code, not in the database.
- **Index `IX_Favorites_IgdbId (IgdbId)`** (non-unique). Allows fast lookups of "all users who favorited this game" for analytics or cache invalidation.

## SQL Server Table Creation

### Core tables

``` sql
CREATE SCHEMA auth;
GO
CREATE SCHEMA favorites;
GO

-- User identity with custom fields
CREATE TABLE auth.AspNetUsers (
    Id                   nvarchar(450)  NOT NULL CONSTRAINT PK_AspNetUsers PRIMARY KEY,
    DisplayName          nvarchar(max)  NULL,
    CreatedAtUtc         datetime2      NOT NULL,
    PrivacyConsentedAtUtc datetime2     NULL,
    UserName             nvarchar(256)  NULL,
    NormalizedUserName   nvarchar(256)  NULL UNIQUE,
    Email                nvarchar(256)  NULL,
    NormalizedEmail      nvarchar(256)  NULL,
    EmailConfirmed       bit            NOT NULL,
    PasswordHash         nvarchar(max)  NULL,
    SecurityStamp        nvarchar(max)  NULL,
    ConcurrencyStamp     nvarchar(max)  NULL,
    PhoneNumber          nvarchar(max)  NULL,
    PhoneNumberConfirmed bit            NOT NULL,
    TwoFactorEnabled     bit            NOT NULL,
    LockoutEnd           datetimeoffset NULL,
    LockoutEnabled       bit            NOT NULL,
    AccessFailedCount    int            NOT NULL
);
CREATE INDEX EmailIndex ON auth.AspNetUsers (NormalizedEmail);

-- Favorited games with snapshots
CREATE TABLE favorites.Favorites (
    UserId              nvarchar(450) NOT NULL,
    IgdbId              int           NOT NULL,
    Name                nvarchar(300) NOT NULL,
    BackgroundImage     nvarchar(500) NULL,
    Released            nvarchar(10)  NULL,
    Rating              float         NOT NULL,
    Metacritic          int           NULL,
    Genres              nvarchar(max) NOT NULL,
    Platforms           nvarchar(max) NOT NULL,
    CreatedAtUtc        datetime2     NOT NULL,
    SnapshotUpdatedAtUtc datetime2    NOT NULL,
    CONSTRAINT PK_Favorites PRIMARY KEY (UserId, IgdbId)
);
CREATE INDEX IX_Favorites_IgdbId ON favorites.Favorites(IgdbId);
```

### Migration Scripts

Migrations run automatically when the backend starts: each module applies its pending migrations and records them in its own `__EFMigrationsHistory` table. After changing a module's data model, add a migration in that module.

Complete migration scripts are in `backend/src/Lune.Auth/Data/Migrations/` and `backend/src/Lune.Favorites/Data/Migrations/`.

### Database Image Updates

The SQL Server image is pinned to a fixed version (2022 CU27) in `docker-compose.yml`. Make sure local changes are compatible with that version, and never move the image to a lower build: a newer SQL Server can upgrade the data files, and an older one can't open them again.
