# Features

What LunaNova does, mapped to the requirements of the Terranova Software _Gaming Explorer_ brief ([`en.game_explorer.pdf`](./en.game_explorer.pdf)), followed by the bonus features and the engineering behind them.

## Contents

1. [At a glance](#at-a-glance)
2. [Mandatory features](#mandatory-features)
3. [Technical specifications](#technical-specifications)
4. [Bonus features](#bonus-features)
5. [Engineering highlights](#engineering-highlights)
6. [Known gaps](#known-gaps)
7. [Client meeting / requirement clarifications](#client-meeting--requirement-clarifications)

---

## At a glance

| Area                                 | Status                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Mandatory features (brief §IV.1)     | All implemented                                                                                                                 |
| Technical specifications (brief §V)  | ASP.NET Core, Angular + TypeScript + Bootstrap, SQL Server, Git, API testing                                                    |
| Bonus features from the brief (§VII) | Authentication, dark/light mode                                                                                                 |
| Additional bonus features (our own)  | Price comparison, autocomplete, developer/publisher filters, related games, account management, guest browsing, privacy consent |

<!-- Screenshot strip: home, search, game details, favorites, account (docs/images/) -->

---

## Mandatory features

Each row lists what the brief asks for and where to see it in the app.

### Home page (§IV.1.1)

| Requirement                     | Implementation                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Overview of the application     | Hero section with a short introduction; an [About](http://localhost:8080/about) page describes the project and the team.                 |
| Search bar                      | On the home page, with suggestions as you type. Submitting opens the results page.                                                       |
| Selection of games from the API | A **featured games** carousel: 10 games picked at random from the 50 most-rated on IGDB (`GET /api/games/featured`). Keyboard-navigable. |

<!-- Details / screenshot -->

### Basic search (§IV.1.2)

| Requirement                    | Implementation                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Search by full or partial name | Matches anywhere in the game name, case-insensitive.                                            |
| Results shown dynamically      | Results update as you type (debounced by 300 ms). Suggestions appear under the home search bar. |

### Advanced search (§IV.1.3)

| Requirement                      | Implementation                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Genre                            | Multi-select. Several genres match any of them.                                                                            |
| Platform                         | Multi-select over the supported platforms.                                                                                 |
| Release year                     | Sort by release date, newest or oldest first. A separate release year filter was clarified with Terranova as not required. |
| Rating                           | Critic score range (0–100) with two sliders. The brief's Metacritic score; see the note below.                             |
| Sorting                          | Rating, critic score, release date (newest and oldest), popularity, name A–Z.                                              |
| _Extra:_ developer and publisher | Autocomplete search for companies, used as filters.                                                                        |

Filters combine with each other and with the search text. Within one filter, values are alternatives (any selected genre); across filters, all must match. The search and filters are kept in the URL, so a result page can be bookmarked, shared or reloaded.

> **Metacritic score:** the brief assumes the RAWG API, which provides Metacritic scores. LunaNova uses IGDB (see [ARCHITECTURE.md](./ARCHITECTURE.md#technology-choices)), which has no Metacritic data. IGDB's aggregated critic rating (0–100, an average of professional reviews) is used in its place and labeled as the Metacritic score.

### Video game list (§IV.1.4)

| Requirement                                                      | Implementation                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Cards in a grid                                                  | Responsive card grid with pagination.                                        |
| Cover image, title, release date, average rating, main platforms | All shown on each card.                                                      |
| Each item selectable                                             | Each card opens the game's detail page. The card also has a favorite button. |

### Detail page (§IV.1.5)

| Requirement              | Implementation                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Description              | Summary and, when available, the storyline.                                                 |
| Images and screenshots   | Full-width hero image and a screenshot gallery (1080p).                                     |
| Genres, platforms        | Listed in the game facts.                                                                   |
| Developer, publisher     | Listed in the game facts.                                                                   |
| Rating, Metacritic score | User rating and critic score, shown side by side.                                           |
| _Extra_                  | Price comparison (see [Bonus features](#bonus-features)) and a paged list of related games. |

### Favorites (§IV.1.6)

| Requirement            | Implementation                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add and remove         | Heart button on every game card and on the detail page. Repeat-safe on the server: adding twice or removing a missing favorite is not an error.                                                    |
| Dedicated section      | **Favorites** page (signed-in users), newest first, paged.                                                                                                                                         |
| Stored in the database | SQL Server, schema `favorites`, up to 1,000 per user. Each favorite keeps a copy of the game's summary, so the page loads without calling IGDB. See [DATABASE.md](./DATABASE.md#schema-favorites). |

### Application state management (§IV.1.7)

| Requirement        | Implementation                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Loading indicator  | Spinners on the home page, search results, game pages and favorites.                                                        |
| API error handling | Error messages for failed requests, provider outages (`503`), unknown games and the favorites limit.                        |
| No-results message | Separate messages for a search with no matches and for filters with no matches. The favorites page has its own empty state. |

### Responsive design (§IV.1.8)

Built with Bootstrap's grid. Layouts adapt from phone to desktop: the filter panel stacks into a single column on small screens, and the card grid reflows to the screen width.

<!-- Screenshots: mobile and desktop of the same page -->

---

## Technical specifications

| Brief (§V)                            | LunaNova                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C# / ASP.NET Core Web API (§V.1)      | ASP.NET Core 10, minimal APIs, split into modules                                                                                                                                                                                                                                                                                                                                |
| Angular, TypeScript, Bootstrap (§V.2) | Angular 22, TypeScript, Bootstrap, RxJS                                                                                                                                                                                                                                                                                                                                          |
| Relational database (§V.3)            | SQL Server 2022 with Entity Framework Core                                                                                                                                                                                                                                                                                                                                       |
| Git (§V.4)                            | GitHub repository with the full commit history                                                                                                                                                                                                                                                                                                                                   |
| API testing with Postman (§V.5)       | **Bruno**, an open-source Postman alternative. The collection is stored as files in Git, and its OpenCollection format imports into Postman. 79 requests with automated tests check endpoints, status codes, JSON responses, input validation and error conditions. An interactive **Scalar** reference documents every endpoint. See [testing/README.md](../testing/README.md). |

---

## Bonus features

### From the brief (§VII)

| Feature                        | Status  | Notes                                                                                                                                                                                        |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User authentication (§VII.1)   | Done    | Register, log in, log out, and a personal account area. ASP.NET Core Identity with a JWT in an HttpOnly cookie. Routes for favorites and the account page are protected by an Angular guard. |
| Dark / light mode (§VII.2)     | Done    | Toggle in the navbar. The choice is stored in the browser and applied on the next visit.                                                                                                     |
| Video game comparison (§VII.3) | Not yet | See [FUTURE.md](./FUTURE.md).                                                                                                                                                                |
| Wishlist (§VII.4)              | Not yet | See [FUTURE.md](./FUTURE.md).                                                                                                                                                                |
| Personal statistics (§VII.5)   | Not yet | See [FUTURE.md](./FUTURE.md).                                                                                                                                                                |

### Our own additions

| Feature                             | What it does                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Price comparison**                | Each game page shows the current price and historical low from Steam and GG.deals, with links to the stores. Prices are matched through the game's Steam app ID. Italian region (EUR) for now. |
| **Autocomplete**                    | Game suggestions under the home search bar; developer and publisher search in the filters.                                                                                                     |
| **Developer and publisher filters** | Not required by the brief; built on IGDB's company data.                                                                                                                                       |
| **Related games**                   | A paged list of similar games on each detail page.                                                                                                                                             |
| **Account management**              | Change your display name, or permanently delete your account and all its data.                                                                                                                 |
| **Guest browsing**                  | Search and game pages work without an account. Clicking a favorite as a guest asks you to log in, then returns you to the page you were on.                                                    |
| **Privacy consent**                 | Registration requires accepting the privacy policy. The consent time is recorded, and a privacy page explains what's stored. Account deletion removes the user's data from every module.       |

<!-- Add more as they ship -->

---

## Engineering highlights

The parts that aren't visible in the UI, but that we'd most like evaluators to see. More detail in [ARCHITECTURE.md](./ARCHITECTURE.md).

### Backend

- **Modular backend.** Each feature (Auth, Games, Favorites, Prices) is a module that registers its own services and endpoints through the `IModule` interface, and owns its own database schema and migrations. Adding a module doesn't touch the others.
- **Modules talk through interfaces, not references.** Prices and Favorites look up games through `IGameCatalog`, never by calling the Games module directly. Account deletion asks every module that holds user data to clean up through `IUserDataCleaner`, so Auth doesn't need to know which modules exist.
- **Pluggable price sources.** Each store implements `IPlatformPriceService`. Adding a store means adding one class and registering it; the endpoint picks it up automatically. If one store fails, the others are still returned.
- **Favorites keep a copy of the game.** Saving a favorite stores the game's summary next to its ID, so the favorites page is a single database query and keeps working when IGDB is unavailable.
- **Caching where it pays off:** filter options (12 hours), featured games (10 minutes), Steam app ID lookups (24 hours) and prices (6 hours), in memory.
- **Input validation and consistent errors.** All query parameters and request bodies are validated (slug formats, value limits, score ranges, password rules), and every error uses the standard Problem Details format.
- **Secure session handling.** The JWT lives in an HttpOnly, SameSite=Lax cookie that JavaScript can't read. The user ID always comes from the token, never from the request.
- **Health checks.** `/health` (process up) and `/health/ready` (database reachable). Docker starts the frontend only once the backend is ready.

### Frontend

- **Standalone components and signals.** State lives in Angular signals; data flows use RxJS (debounced search, cancellation of outdated requests with `switchMap`).
- **Search state in the URL.** Search text and filters are query parameters, so the back button, reloads and shared links all work.
- **Safe redirects.** After login, the app returns to the page you came from, but only to known app routes.
- **Accessibility.** Labeled form controls, keyboard navigation in the featured carousel, ARIA attributes on validation errors and toggles.

### Tooling

- **Interactive API reference.** Every endpoint is documented with summaries, parameter descriptions and every possible response, rendered by Scalar at `/docs`.
- **Automated API test suite.** 79 Bruno requests cover every endpoint and its documented error cases. Each run creates its own test users and deletes them afterwards, and writes an HTML report. One command runs it.
- **One-command development environment.** `docker compose up` starts SQL Server, the backend and the frontend with hot reload. Image versions are pinned so every machine builds the same thing.

<!-- Add: difficulties encountered and how we solved them (the brief asks for this in the presentation), e.g. switching from RAWG to IGDB -->

---

## Known gaps

| Gap                                  | Why                                             | Plan                                                   |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| "Metacritic" is IGDB's critic rating | IGDB has no Metacritic data.                    | Documented here and in the API reference.              |
| Prices for the Italian region only   | Region and currency are fixed in configuration. | Per-user region planned; see [FUTURE.md](./FUTURE.md). |

---

## Client meeting / requirement clarifications

Points clarified with Terranova during the Q&A, and how each one is addressed.

| Clarification                                                                                                                                                                                                                | How it's addressed                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release year filter isn't required.** Clarified verbally: the advanced-search requirement (§IV.1.3) is met without a dedicated release year filter.                                                                        | Results can be sorted by release date (newest or oldest first). A year filter is listed in [FUTURE.md](./FUTURE.md#release-year-filter) as a possible enhancement.                                                                                                                                            |
| **The frontend must respond to every possible state:** loading, success with data, success without data, and error.                                                                                                          | Loading spinners, error messages, and separate empty-state messages for searches, filters and the favorites page. See [Application state management](#application-state-management-iv17).                                                                                                                     |
| **Metacritic is used for filtering instead of rating.**                                                                                                                                                                      | The score range filter uses the critic score (`metacriticMin` / `metacriticMax`). With IGDB, this is IGDB's aggregated critic rating, labeled as the Metacritic score.                                                                                                                                        |
| **The frontend should have guards/interceptors for authentication.**                                                                                                                                                         | `authGuard` protects the favorites and account routes and sends guests to the login page. There's no HTTP interceptor yet: each service handles its own `401` responses.                                                                                                                                      |
| **The README should explain:** the prerequisites to install, how to create and configure the environment, which variables are required, how to start the frontend and backend, and any database initialization or migration. | The [README's Quick start](../README.md#quick-start) covers all five: Docker as the only prerequisite, `.env` from `.env.example`, a table of required variables, one command to start everything, and migrations that run automatically at startup. More detail is in [CONTRIBUTING.md](../CONTRIBUTING.md). |

<!-- Add further clarifications from client meetings here, with the date if known. -->
