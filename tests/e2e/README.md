# OpenExpress Smoke Testing

This folder holds lightweight end-to-end smoke checks for the web-rendered Tauri UI.

## Commands

```bash
npm run smoke:routes
npm run e2e
```

The Playwright config starts an isolated Vite dev server automatically on
`127.0.0.1:57173` so route smoke tests do not reuse an unrelated app on the
default Tauri/Vite dev port. Override with `OPENEXPRESS_E2E_PORT` when needed.

Install browsers once on a new machine:

```bash
npx playwright install chromium
```

## Current coverage

`route-smoke.spec.ts` intentionally covers representative golden paths instead of all 32 tools:

- image: `/image/compress`
- video: `/video/trim`
- PDF: `/pdf/split`
- audio: `/audio/trim`
- home category links

These checks verify that each representative page renders the shared workspace, exposes Input/Settings regions, shows a dropzone, and keeps the primary action disabled before a file is selected.

## Manual desktop smoke still required

The route smoke tests run in a browser against Vite. They do not exercise native Tauri APIs, OS dialogs, ffmpeg sidecars, shell context-menu launch, model download paths, or filesystem permissions. Before a release, run the manual desktop checklist from the project kanban in `npm run tauri dev`.
