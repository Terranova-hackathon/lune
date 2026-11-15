# LunaNova frontend

The Angular 22 app for LunaNova (internal name: Lune), built with TypeScript, Bootstrap and RxJS. It talks to the backend through relative `/api/...` URLs.

How the app is organized (pages, shared components, services, guards) is described in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#frontend-architecture).
The API it calls is described in [backend/README.md](../backend/README.md).

## Running it

**With Docker (the usual way):** from the repository root, `docker compose up`. The app is served on [http://localhost:8080](http://localhost:8080), and saving a file reloads the browser. See the [contributor guide](../CONTRIBUTING.md).

**On your machine** (needs Node.js v22.22.3 or newer):

``` bash
npm install
npm start
```

The app is served on [http://localhost:4200](http://localhost:4200). `/api` requests are proxied to the backend at `http://localhost:3001` by default, which the backend container or a locally running backend provides. Set `API_URL` to send them elsewhere (see `proxy.conf.js`).

## Scripts

| Command         | What it does                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`     | Development server with live reload (`ng serve`)                                                                                |
| `npm test`      | Unit tests with [Vitest](https://vitest.dev/) (`ng test`). See [testing/README.md](../testing/README.md#6-frontend-unit-tests). |
| `npm run build` | Production build into `dist/` (`ng build`)                                                                                      |
| `npm run watch` | Development build that rebuilds on changes                                                                                      |

## Folder structure

| Path                    | Contents                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/app/pages/`        | One folder per route (home, games, game details, favorites, login, register, account, privacy, about)                      |
| `src/app/shared/`       | Reusable components (navbar, footer, game card, filters, company search, featured-game carousel, price comparison)         |
| `src/app/core/`         | Services (one per backend area, plus theme and search state), the auth guard, and TypeScript models of the API's responses |
| `src/app/app.routes.ts` | Routes; favorites and account are protected by `authGuard`                                                                 |
| `proxy.conf.js`         | Dev-server proxy for `/api`                                                                                                |
| `public/`               | Static assets: icons and images                                                                                            |

## Generating code

The project was created with [Angular CLI](https://angular.dev/tools/cli) 22.2.5. To scaffold a component:

``` bash
npx ng generate component shared/component-name
```

`npx ng generate --help` lists the other schematics (services, guards, pipes, ...).
