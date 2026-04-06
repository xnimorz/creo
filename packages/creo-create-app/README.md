# creo-create-app

CLI scaffolding tool for new [Creo](../../README.md) projects. Creates a ready-to-run app with Vite and optional Hono server.

## Usage

```bash
bunx creo-create-app my-app
```

Or without a name (will be prompted):

```bash
bunx creo-create-app
```

## Interactive Setup

The CLI asks:

1. **Project name** — directory name and `package.json` name (skipped if passed as argument)
2. **Include a server (Hono)?** — adds a Hono backend that serves static files by default

## What Gets Generated

### Client-only (default)

```
my-app/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .gitignore
└── src/
    ├── main.ts        # Mounts the creo app
    └── app.ts         # Starter counter component
```

Scripts:

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start dev server with HMR |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build |

### With server (Hono)

Everything above, plus:

```
my-app/
└── src/
    └── server.ts      # Hono server with static file serving
```

Additional scripts:

| Script | Command | Description |
|--------|---------|-------------|
| `dev:server` | `bun run --watch src/server.ts` | Start Hono server with watch mode |
| `start` | `bun run src/server.ts` | Run Hono server in production |

The Vite dev server proxies `/api` requests to the Hono server at `localhost:3000`, so during development you run both:

```bash
# Terminal 1
bun run dev:server

# Terminal 2
bun run dev
```

For production, build with Vite then serve with Hono:

```bash
bun run build
bun run start
```

## Server Details

The generated Hono server (`src/server.ts`):

- Serves static files from `dist/` (Vite build output)
- Includes a sample `/api/health` endpoint
- Uses Bun's native HTTP server via `export default { port, fetch }`
- Edit `src/server.ts` to add routes, middleware, or replace the static file serving

```ts
// Example: adding an API route
app.get("/api/users", (c) => c.json([{ id: 1, name: "Alice" }]));

// Example: custom middleware
app.use("/*", async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});
```

## Getting Started

```bash
bunx creo-create-app my-app
cd my-app
bun install
bun run dev
```
