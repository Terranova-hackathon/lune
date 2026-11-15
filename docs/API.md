# API overview

An overview of the Lune backend API: what each endpoint does, how authentication works, and the conventions every endpoint follows.

**The complete, always-current reference** (every parameter, request body, response schema and status code) is generated from the code. With the backend running:

- **Interactive reference (Scalar):** [http://localhost:3001/docs](http://localhost:3001/docs). Every endpoint can be tried from the browser.
- **OpenAPI document:** [http://localhost:3001/openapi/v1.json](http://localhost:3001/openapi/v1.json). A copy is kept in [`openapi.json`](./openapi.json).

The database behind it is described in [DATABASE.md](./DATABASE.md), the module design in [ARCHITECTURE.md](./ARCHITECTURE.md), and the automated tests in [testing/README.md](../testing/README.md).

## Contents

1. [Conventions](#1-conventions)
2. [Endpoints](#2-endpoints)
3. [Games](#3-games)
4. [Prices](#4-prices)
5. [Auth](#5-auth)
6. [Favorites](#6-favorites)
7. [Health](#7-health)
8. [Example requests](#8-example-requests)

---

## 1. Conventions

- **Base URL:** `http://localhost:3001` in development. The Angular app calls relative URLs (`/api/games`), which its dev server proxies to the backend (`frontend/proxy.conf.js`), so the browser sees a single origin and no CORS is needed.
- **Format:** JSON in and out, with camelCase property names.
- **Game IDs** are IGDB game IDs, and the same ID is used by `/api/games`, `/api/favorites` and `/api/prices`.
- **Dates:** `released` is a `YYYY-MM-DD` string, or `null` if unknown.
- **Ratings:** `rating` is IGDB's user rating, scaled to 0–5. `metacritic` is IGDB's aggregated critic rating (0–100); IGDB has no Metacritic data, so this stands in for it.
- **Paging:** list endpoints take `page` (from 1; lower values become 1) and `pageSize` (clamped to 1–40) and return:
``` json
{ "items": [], "page": 1, "pageSize": 20, "totalCount": 0, "totalPages": 0 }
```
- **Filter options** (genres, platforms, companies) are `{ "value": "...", "name": "..." }` objects: `value` is what you send back to the API, `name` is for display.

### Authentication

Sign-in uses a JWT in an **HttpOnly cookie** named `Lune_auth`, not an `Authorization` header.

- `POST /api/auth/register` and `POST /api/auth/login` set the cookie; `POST /api/auth/logout` and `DELETE /api/auth/delete-account` clear it.
- Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, 24-hour expiry, `Secure` when the request is HTTPS.
- The browser sends it automatically. The frontend never reads it.
- The user is always taken from the cookie, never from the request.

| Routes                                        | Sign-in required |
| --------------------------------------------- | ---------------- |
| `/api/games/**`, `/api/prices/**`             | No               |
| `/api/auth/register`, `/login`, `/logout`     | No               |
| `/api/auth/me`, `/profile`, `/delete-account` | Yes              |
| `/api/favorites/**`                           | Yes              |
| `/health`, `/health/ready`                    | No               |

A protected route without a valid cookie returns **`401`** with an empty body.

### Errors

Errors use the standard [Problem Details](https://www.rfc-editor.org/rfc/rfc9457) format:

``` json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "ordering": ["ordering is not one of the supported sort orders."]
  }
}
```

- **Validation errors (`400`)** have an `errors` object mapping each field or parameter to its messages. Auth request fields are PascalCase (`Email`, `Password`, `DisplayName`, `AcceptedPrivacyPolicy`); game query parameters are camelCase (`genres`, `metacriticMin`).
- **Other errors** have a `title` and usually a `detail`.

| Code                  | Meaning                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `200` / `201` / `204` | OK with a body / created / OK without a body                                                                     |
| `400`                 | Validation failed                                                                                                |
| `401`                 | Not signed in, or wrong email or password                                                                        |
| `404`                 | Game not found, or no price data for the game                                                                    |
| `409`                 | Favorites limit reached                                                                                          |
| `503`                 | An outside provider (IGDB, Steam or GG.deals) didn't respond, or isn't configured. Retrying later usually works. |

---

## 2. Endpoints

| Method | Path                       | Sign-in | Purpose                                          |
| ------ | -------------------------- | :-----: | ------------------------------------------------ |
| GET    | `/api/games`               |         | Search, filter, sort and page games              |
| GET    | `/api/games/{id}`          |         | One game's full details, with related games      |
| GET    | `/api/games/filters`       |         | Genre, platform and sort options for the filters |
| GET    | `/api/games/companies`     |         | Developer or publisher search, for autocomplete  |
| GET    | `/api/games/featured`      |         | 10 random games from the 50 most-rated           |
| GET    | `/api/prices/{id}`         |         | Steam and GG.deals prices for a game             |
| POST   | `/api/auth/register`       |         | Create an account and sign in                    |
| POST   | `/api/auth/login`          |         | Sign in                                          |
| POST   | `/api/auth/logout`         |         | Sign out                                         |
| GET    | `/api/auth/me`             |   Yes   | The signed-in user                               |
| PUT    | `/api/auth/profile`        |   Yes   | Change the display name                          |
| DELETE | `/api/auth/delete-account` |   Yes   | Delete the account and all its data              |
| GET    | `/api/favorites`           |   Yes   | The user's favorites, paged, newest first        |
| GET    | `/api/favorites/ids`       |   Yes   | IDs of all the user's favorites                  |
| PUT    | `/api/favorites/{id}`      |   Yes   | Add a favorite                                   |
| DELETE | `/api/favorites/{id}`      |   Yes   | Remove a favorite                                |
| GET    | `/health`                  |         | Liveness: is the process running?                |
| GET    | `/health/ready`            |         | Readiness: can the API reach its database?       |

---

## 3. Games

Game data comes from [IGDB](https://www.igdb.com/). Two shapes are returned:

- **`GameSummary`** (search results, favorites, related games): `id`, `name`, `released`, `backgroundImage`, `rating`, `metacritic`, `genres`, `platforms`.
- **`GameDetails`** (one game, featured games): everything in the summary, plus `cover`, `description`, `storyLine`, `website`, `externalGames` (the game's IDs on other stores), `developers`, `publishers`, `screenshots`, `artworks`, `videos` (all as ready-to-use URLs) and `relatedGames` (a paged list of summaries).

`genres`, `platforms`, `developers` and `publishers` are lists of filter options (`value` and `name`).

### `GET /api/games`

All parameters are optional.

| Param                            | Default   | Rules                                                                                                               |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `search`                         | none      | Matches anywhere in the game name, case-insensitive. Blank is ignored.                                              |
| `page`, `pageSize`               | `1`, `20` | See [Paging](#1-conventions).                                                                                       |
| `genres`                         | none      | Comma-separated genre slugs, up to 10. Valid values from `/api/games/filters`.                                      |
| `platforms`                      | none      | Comma-separated platform IDs, up to 10. Valid values from `/api/games/filters`.                                     |
| `developers`, `publishers`       | none      | Comma-separated company slugs, up to 10 each. Valid values from `/api/games/companies`.                             |
| `ordering`                       | see below | `-rating`, `-metacritic`, `-released`, `released`, `-added` (most rated) or `name`. A leading `-` means descending. |
| `metacriticMin`, `metacriticMax` | none      | 0–100. The minimum can't be greater than the maximum.                                                               |

How they combine:

- Values within one filter are alternatives: `genres=shooter,indie` matches either.
- Different filters must all match: genre **and** platform **and** ...
- The search text combines with the filters.
- **Default order:** most-rated first when browsing; name A–Z when searching. `ordering` overrides either.
- Games without a release date or a rating are never included. When browsing without search text, games nobody has rated are left out too.

Responses: **200** with a paged list of `GameSummary` (an empty `items` list when nothing matches), **400** for invalid parameters, **503**.

### `GET /api/games/{id}`

Full details for one game. `page` and `pageSize` (default 6) page through `relatedGames` only. `backgroundImage` is a screenshot chosen at random, so it can differ between calls.

Responses: **200** `GameDetails`, **404** (empty body) for an unknown ID, **503**.

### `GET /api/games/filters`

Everything the search filters accept: `genres` (all IGDB genres; `value` is the slug), `platforms` (the platforms Lune supports; `value` is the numeric ID as a string) and `orderings` (the six sort orders). Cached on the server for 12 hours.

Responses: **200**, **503**.

### `GET /api/games/companies`

Developer or publisher search, for autocomplete. Both parameters are required:

| Param    | Rules                                                           |
| -------- | --------------------------------------------------------------- |
| `kind`   | `developer` or `publisher`                                      |
| `search` | 2–60 characters, matched anywhere in the name, case-insensitive |

Returns up to 10 companies, those with the most games first: `{ "slug": "nintendo", "name": "Nintendo", "gamesCount": 1294 }`. Pass `slug` to the `developers` or `publishers` filter.

Responses: **200**, **400**, **503**.

### `GET /api/games/featured`

10 games picked at random from IGDB's 50 most-rated, for the home page. The candidates are cached for 10 minutes; the selection changes on each call. Each item is a `GameDetails` with an empty `relatedGames` list, and `backgroundImage` is the game's first screenshot (or its cover).

Responses: **200**, **404** (only if IGDB returns nothing), **503**.

---

## 4. Prices

### `GET /api/prices/{id}`

Prices for a game on each supported store, currently for the **Italian region** (EUR).

1. The backend looks up the game's **Steam app ID** in IGDB (cached for 24 hours).
2. It asks each store for prices using that ID (cached for 6 hours per store).

``` json
{
  "gameId": 1020,
  "steamAppId": 271590,
  "platforms": [
    { "platform": "Steam", "currentPrice": 29.99, "historicalLow": null, "averagePrice": null, "currency": "EUR", "url": "https://store.steampowered.com/app/271590" },
    { "platform": "GG.deals", "currentPrice": 12.49, "historicalLow": 7.5, "averagePrice": null, "currency": "EUR", "url": "https://gg.deals/game/..." }
  ]
}
```

(Example values.)

- **Steam** gives the current price only; `historicalLow` is always `null`.
- **GG.deals** gives the current price and the historical low.
- `averagePrice` isn't filled in yet.
- If one store fails, the other is still returned.

Responses:

- **200**
- **404** `No price data found.`: IGDB doesn't link the game to Steam.
- **503** `Price data is currently unavailable.`: no store returned a price. This currently also happens for free games, which have no Steam price; see [FUTURE.md](./FUTURE.md#free-games-on-steam-return-503).

---

## 5. Auth

User responses are `{ "id": "...", "email": "...", "displayName": "..." }`; `displayName` is `null` if not set.

### `POST /api/auth/register`

``` json
{ "email": "ann@example.com", "password": "Passw0rd!", "displayName": "Ann", "acceptedPrivacyPolicy": true }
```

| Field                   | Rules                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `email`                 | Required, a valid email, not already registered                                                     |
| `password`              | Required: at least 8 characters, with an uppercase letter, a lowercase letter, a digit and a symbol |
| `displayName`           | Optional. If given, it must be unique (case-insensitive). Blank is treated as no name.              |
| `acceptedPrivacyPolicy` | Must be `true`. The consent time is recorded.                                                       |

Responses: **201** with the user, a `Location: /api/auth/me` header and the auth cookie (the user is signed in); **400** with `errors` keyed by `Email`, `Password`, `DisplayName` or `AcceptedPrivacyPolicy`.

### `POST /api/auth/login`

``` json
{ "email": "ann@example.com", "password": "Passw0rd!" }
```

Responses: **200** with the user and the auth cookie; **400** if a field is missing; **401** `Invalid email or password.`, the same for an unknown email and a wrong password, so the response doesn't reveal whether an account exists.

### `POST /api/auth/logout`

Clears the auth cookie. No body, no sign-in needed. Always **204**.

### `GET /api/auth/me`

The signed-in user. Use it to check whether the session is still valid, for example on page load.

Responses: **200**; **401** if not signed in, the session expired, or the account no longer exists.

### `PUT /api/auth/profile`

``` json
{ "displayName": "Ann" }
```

Changes the display name. It's trimmed, must be 2–20 characters, and must not be used by another account (case-insensitive).

Responses: **200** with the updated user, **400**, **401**.

### `DELETE /api/auth/delete-account`

Permanently deletes the signed-in user's account and all their data (including favorites), then clears the cookie. This can't be undone.

Responses: **204**, **401**, **400** if the delete is refused.

---

## 6. Favorites

All favorites endpoints require sign-in. Each favorite keeps a copy of the game's summary from when it was saved; see [DATABASE.md](./DATABASE.md#schema-favorites).

### `GET /api/favorites`

The user's favorites, **newest first**, as a paged list of `GameSummary`. Served from the database only, so it works even when IGDB is unavailable.

Responses: **200**, **401**.

### `GET /api/favorites/ids`

The IGDB IDs of all the user's favorites, as one array in no particular order, e.g. `[1020, 7346]`. Used to mark favorites in search results without loading full game data.

Responses: **200**, **401**.

### `PUT /api/favorites/{id}`

Saves a game. No request body. Safe to repeat: saving a game that is already a favorite also returns 201.

| Result                                                 | Status                             |
| ------------------------------------------------------ | ---------------------------------- |
| Saved, or already saved                                | **201**, no body                   |
| IGDB has no game with this ID (or the ID is 0 or less) | **404**, no body                   |
| The user already has 1,000 favorites                   | **409** `Favorites limit reached.` |
| IGDB unavailable                                       | **503**                            |
| Not signed in                                          | **401**                            |

### `DELETE /api/favorites/{id}`

Removes a game. Safe to repeat: returns **204** whether or not the game was saved. **401** if not signed in.

---

## 7. Health

| Endpoint            | Returns                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`       | `ok` (plain text) while the process is running. Doesn't check anything else.                                                                                                                   |
| `GET /health/ready` | `200 {"status":"Healthy","checks":{"database":"Healthy"}}` when the database is reachable; `503` with the failing check otherwise. Docker Compose waits for this before starting the frontend. |

---

## 8. Example requests

Paste into any HTTP client that supports `.http` files (VS Code REST Client, JetBrains), or replace `{{baseUrl}}` with `http://localhost:3001` in a browser or Postman.

``` http
@baseUrl = http://localhost:3001

### Default listing (most-rated first, page 1, 20 results)
GET {{baseUrl}}/api/games

### Search by text
GET {{baseUrl}}/api/games?search=zelda

### Search with paging
GET {{baseUrl}}/api/games?search=mario&page=2&pageSize=10

### Match either genre, on PC or PlayStation 5
GET {{baseUrl}}/api/games?genres=shooter,adventure&platforms=6,167

### Sort by critic score within a score range
GET {{baseUrl}}/api/games?ordering=-metacritic&metacriticMin=70&metacriticMax=95

### Search, filter, sort and page together
GET {{baseUrl}}/api/games?search=zelda&genres=adventure&platforms=130&ordering=-released&page=1&pageSize=20

### Filter options
GET {{baseUrl}}/api/games/filters

### Find a developer, then filter by its slug
GET {{baseUrl}}/api/games/companies?kind=developer&search=Nintendo
GET {{baseUrl}}/api/games?developers=nintendo

### One game, and its prices
GET {{baseUrl}}/api/games/1020
GET {{baseUrl}}/api/prices/1020

### Validation errors (400)
GET {{baseUrl}}/api/games?ordering=popular
GET {{baseUrl}}/api/games?platforms=pc
GET {{baseUrl}}/api/games?metacriticMin=90&metacriticMax=50
```
