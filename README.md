# pi-tps

Pi extension that reports throughput and token usage after each agent run.

```
TPS 47.5 tok/s. out 431, in 1,722, cache r/w 235,264/0, total 237,417, 9.1s
```

- `TPS` is output tokens divided by wall-clock time of the run (`agent_start` to `agent_end`).
- `out` / `in` are summed output and input tokens of every assistant message in the run.
- `cache r/w` is cache-read and cache-write tokens, `total` is the provider-reported total.

## Install

```sh
pi install git:github.com/meatRoll/pi-tps
```

Or from a checkout:

```sh
pi install /path/to/pi-tps
```

## Behavior

- Runs only in the interactive UI (`ctx.hasUI`); print, JSON, and RPC modes stay silent.
- The summary is a `ui.notify` info message: it never enters the model context and never writes to the terminal while the TUI owns it.
- A run that produced no output tokens (aborted, or nothing generated) reports nothing instead of `0.0 tok/s`.

## Development

```sh
npm install
npm test      # node --test with native TypeScript stripping (Node >= 22.18)
npm run check # tsc --noEmit
```

`stats.ts` holds the pure math and formatting; `tps.ts` only wires the pi events to it.

## License

MIT
