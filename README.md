# Codex WebSocket Client

A minimal Node/TypeScript web application for exercising the Codex app-server
WebSocket API. It provides a split view of the high-level conversation and the
underlying JSON-RPC frames, making it handy for demos, diagnostics, and
troubleshooting.

## Prerequisites

- Node.js 18+ and npm (for building/running the web UI)
- A Codex CLI installation that exposes the app-server WebSocket endpoint. This
  project assumes the fork at
  [`https://github.com/niklasha/codex`](https://github.com/niklasha/codex),
  branch `niklasha/connectivity/app-server-websockets`, which adds the
  `--websocket` transport option to `codex-app-server`.

## Getting Started

1. Clone this repository alongside the Codex checkout:

   ```bash
   cd ~/dev/ai
   git clone git@github.com:niklasha/codex-websocket-client.git
   ```

2. From the Codex fork checkout, start the app-server with WebSocket enabled:

   ```bash
   cd ~/dev/ai/codex/codex-rs
   cargo run -p codex-app-server --bin codex-app-server -- \
     --websocket 127.0.0.1:9998 --stdio
   ```

3. Install dependencies and build the web UI:

   ```bash
   cd ~/dev/ai/codex-websocket-client
   npm install
   npm run build
   ```

4. Launch the lightweight dev server (default port 5173, set `PORT` to override):

   ```bash
   npm run dev
   ```

5. Open the browser (e.g. <http://localhost:5173/>) and connect to the app-server
   WebSocket URL (defaults to `ws://127.0.0.1:9998/app-server/v1`).

## Features

- Auto-initializes a conversation and displays Codex replies alongside the
  underlying JSON-RPC traffic.
- Split-pane layout with a draggable divider to balance chat and raw event views.
- Conversation log that keeps prompts and responses in a clean, compact feed
  while raw events remain available in the WebSocket pane.
- Simple Node/Express hosting; works equally well when deployed behind other
  HTTP servers.

## Development Notes

- `npm run build` bundles the TypeScript client with esbuild into `public/js`.
- `npm run dev` uses `ts-node` to run the Express server directly from source.
- Build artefacts (`public/js`, `dist/`) are ignored by default; run a fresh
  build when you need production assets.

## License

MIT, like the upstream Codex project.
