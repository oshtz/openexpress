<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/openexpress-logo-white.svg" />
    <img src="public/openexpress-logo.svg" width="220" alt="OpenExpress" />
  </picture>
</p>

> Open-source, offline-first desktop alternative to Adobe Express. Fast native quick-actions for image, video, audio, and PDF — no subscription, no cloud processing requirement, no privacy trade-offs.

<p align="center">
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri%202-111111?style=for-the-badge&labelColor=111111&color=111111" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-111111?style=for-the-badge&labelColor=111111&color=111111" />
  <img alt="React 19" src="https://img.shields.io/badge/React%2019-111111?style=for-the-badge&labelColor=111111&color=111111" />
  <img alt="React Router 7" src="https://img.shields.io/badge/React%20Router%207-111111?style=for-the-badge&labelColor=111111&color=111111" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite%208-111111?style=for-the-badge&labelColor=111111&color=111111" />
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind%20CSS%204-111111?style=for-the-badge&labelColor=111111&color=111111" />
</p>

The current target platforms are Windows and macOS; Linux is kept as a development build target, not an initial release target.

<p align="center">
  <a href="https://youtu.be/ike4lq0X5Q8">
    <img src="https://img.youtube.com/vi/ike4lq0X5Q8/maxresdefault.jpg" alt="Watch the OpenExpress promo video" width="640" />
  </a>
</p>

## Status

Alpha. The core quick-action surface is implemented and wired: 32 tools across image, video, PDF, and audio.

## Tools

- **Image:** Resize, Crop, Convert, Adjust, Compress, Rotate / Flip, Sharpen, Blur, Trace to SVG, Remove BG, AI Upscale
- **Video:** Trim, Convert, Resize, To GIF, Speed, Extract Audio, Crop, Reverse, Mute, Merge
- **PDF:** Merge, Image → PDF, PDF → Image, Compress, Split, Organize
- **Audio:** Trim, Convert, Fade In, Fade Out, Volume

AI tools are local-first and enabled in default app builds. Remove BG and AI Upscale use ONNX-model infrastructure, but model files are not bundled; users explicitly download checksum-verified models from the tool UI on first use.

## Usage

Launch OpenExpress, pick a tool from Image, Video, PDF, or Audio, add files by drag/drop or the file picker, adjust the options, and run it. Single-file tools ask where to save unless Settings -> Default Output Folder is set. Batch tools save to that folder, or next to each input with a descriptive suffix.

## Requirements

- **Node** >= 20.19.0 or >= 22.13.0
- **Rust** >= 1.77.2 (stable toolchain)
- **Tauri prerequisites** for your platform: <https://tauri.app/start/prerequisites/>
- **FFmpeg** — handled through `ffmpeg-sidecar` for media operations; first use may download/cache the sidecar depending on platform/build.

## Develop

```sh
npm install
npm run tauri dev
```

The dev command starts Vite on `http://localhost:5173` and launches the Tauri shell with the Rust backend hot-reloading on save.

If Vite/Rolldown reports a missing native optional dependency, refresh the Node install from a clean state:

```sh
rm -rf node_modules
npm ci
```

## Build

```sh
npm run tauri build
```

Local builds produce the configured Tauri bundles in `src-tauri/target/release/bundle/`. The release workflow publishes a Windows portable exe, a macOS DMG, a macOS `.app.zip` updater payload, and `latest.json`.

Useful local helpers:

```sh
npm run smoke:fixtures
npm run models:mirror
```

## Verification

```sh
# Frontend
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build

# Backend
cd src-tauri
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --lib
```

For packaged-app confidence, run an interactive desktop smoke pass for drag/drop, file dialogs, crop/trim controls, media playback metadata, model downloads, batch cancellation, CLI handoff, and Windows Explorer shell integration.

## Project layout

```text
src/                         React + TypeScript frontend
├── pages/{image,video,pdf,audio}
├── components/{common,layout}
├── hooks/                    React hooks (useProcess, useBatch, launch-action helpers)
├── stores/                   Zustand stores
└── lib/                      Tool registry, output paths, errors, utilities

src-tauri/                    Tauri shell + Rust backend
├── src/plugins/{image,video,pdf,audio}
├── src/plugins/models.rs     ML model catalog/downloader
├── src/shell/                OS shell integration + tool registry
├── src/updater.rs            Custom GitHub Releases updater
├── capabilities/             Tauri permissions
├── tauri.conf.json           App config, CSP, bundle metadata
└── Cargo.toml                Rust deps and feature flags
```

## License

MIT — see [LICENSE](./LICENSE).
