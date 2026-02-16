# Local Development URL

## Development Mode

```
http://localhost:5173/
```

In development mode, Vite uses `/` as the base path. The dev server is started by `npm run dev`, which uses `dotenvx run --overload -- npx vite` to decrypt environment variables and launch Vite.

## Production Mode

```
https://sallvainian.github.io/My-Love/
```

In production, the base path is `/My-Love/` to match the GitHub Pages deployment under the repository name. This is configured in `vite.config.ts`:

```typescript
base: mode === 'production' ? '/My-Love/' : '/',
```

## Preview Mode

```
http://localhost:4173/My-Love/
```

`npm run preview` serves the built `dist/` directory locally using Vite's preview server. Since `dist/` is built with the production base path (`/My-Love/`), the preview URL includes the subpath.

## SPA Routing on GitHub Pages

GitHub Pages does not natively support single-page application routing. The `index.html` file includes a redirect handler that converts 404 pages into SPA routes. GitHub Pages serves `index.html` for the root path, and the script reconstructs the intended route from the URL.

## Port Configuration

The default Vite port is `5173`. If this port is already in use, Vite will automatically try the next available port (`5174`, `5175`, etc.) and print the actual URL in the terminal output.

The Playwright config expects the dev server at `http://localhost:5173`:

```typescript
webServer: {
  command: 'npx vite --mode test',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

If you change the port, update this URL in `playwright.config.ts` as well.
