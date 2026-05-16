# Create App

`creo-create-app` is a CLI that scaffolds a ready-to-run Creo project with Vite and, optionally, a [Hono](https://hono.dev) backend. Use it when you want a new project without wiring up the tooling yourself.

## Quick start

<div class="pkg-tabs" data-pkg-tabs>
  <div class="pkg-tabs-bar" role="tablist">
    <button class="pkg-tab active" data-pkg="bun" role="tab">bun</button>
    <button class="pkg-tab" data-pkg="npm" role="tab">npm</button>
    <button class="pkg-tab" data-pkg="pnpm" role="tab">pnpm</button>
    <button class="pkg-tab" data-pkg="yarn" role="tab">yarn</button>
  </div>
  <pre class="pkg-panel active" data-pkg="bun"><code>bunx creo-create-app my-app</code></pre>
  <pre class="pkg-panel" data-pkg="npm"><code>npx creo-create-app my-app</code></pre>
  <pre class="pkg-panel" data-pkg="pnpm"><code>pnpm dlx creo-create-app my-app</code></pre>
  <pre class="pkg-panel" data-pkg="yarn"><code>yarn dlx creo-create-app my-app</code></pre>
</div>

Omit the project name to be prompted for it:

```bash
bunx creo-create-app
```

## Interactive prompts

The CLI asks two questions:

1. **Project name** — becomes the directory name and `package.json` name. Skipped if you passed the name as an argument.
2. **Include a server (Hono)?** — adds a Hono backend that serves the built static files and exposes a sample `/api/health` endpoint.

## Generated layout

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

During development you run both terminals. Vite proxies `/api/*` requests to the Hono server on `localhost:3000`:

```bash
# Terminal 1 — backend
bun run dev:server

# Terminal 2 — frontend
bun run dev
```

For production:

```bash
bun run build
bun run start
```

## Adding API routes

The generated `src/server.ts` is a normal Hono app. Add routes directly:

```ts
app.get("/api/users", (c) => c.json([{ id: 1, name: "Alice" }]));

app.use("/*", async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});
```

The server uses Bun's native HTTP via `export default { port, fetch }`, so nothing else is required to run it.

## Next steps

- Start editing `src/app.ts` — the starter counter is a normal Creo view.
- Read [Getting Started](#/getting-started) for the core API.
- Want to ship it? See [Host on Vercel](#/how-to/deploy-vercel).
