# Claude Code Proxy

TypeScript server that exposes an Anthropic-compatible API backed by Azure OpenAI, allowing Claude Code to communicate with Azure deployments via `localhost:9999`.

## Prerequisites

- Node.js 18+
- `~/.codex/config.toml` with an `azure` `model_provider` entry (the existing CLI config works)
- Environment variable matching the `env_key` defined in the config (e.g. `OPENAI_API_KEY`)

## Install

```bash
npm install
```

## Run

```bash
# optional: override port
export PORT=9999

npm run dev
```

Or run the compiled CLI directly:

```bash
npm run build
node dist/cli.js --port 9999
```

After publishing you can install it globally:

```bash
npm install -g openai-claude
openai-claude --port 9999 --host 0.0.0.0
```

Set Claude Code to use the proxy:

```bash
export ANTHROPIC_BASE_URL="http://0.0.0.0:9999"
export ANTHROPIC_AUTH_TOKEN="your-shared-secret"
export ANTHROPIC_MODEL="gpt-5-codex"
# optional: verbose proxy logging
# export DEBUG=true
```

By default the server requires `x-api-key`/`Bearer` auth that matches `ANTHROPIC_AUTH_TOKEN`. If you omit that environment variable the proxy skips authentication.

## Notes

- The proxy reads `~/.codex/config.toml` on startup to discover the Azure endpoint, wire API, and API key environment variable.
- If the configured `env_key` (e.g. `OPENAI_API_KEY`) is unset, the proxy falls back to `ANTHROPIC_AUTH_TOKEN` so you can reuse the same secret for both Claude Code and Azure.
- Optional `model_reasoning_effort` in `~/.codex/config.toml` is forwarded to Azure via the `reasoning.effort` field unless a request provides its own override.
- `/v1/messages` now supports both standard and streaming responses. Streaming is proxied as SSE using Anthropic-compatible events.
- Tool/function calls are translated between Anthropic and Azure `responses` formats, so Claude Code can invoke tools and return results through the proxy.
- Requests are forwarded to the Azure `responses` API and the response is translated back to the Anthropic message format expected by Claude Code.
- Tool outputs should be returned to the assistant as Anthropic `tool_result` content blocks; the proxy relays them to Azure as `function_call_output` entries automatically.
- `npm run build` is executed automatically before `npm publish` so the generated `dist/` folder is packaged; the published module exposes a global `openai-claude` executable.
