# pi-tps

Pi extension that reports throughput and token usage after each settled turn.

```
TPS 47.5 tok/s. out 431, in 1,722, cache r/w 235,264/0, total 237,417, 9.1s
```

- `TPS` is output tokens divided by generation time. Generation time is summed per agent run, so a wait between runs — a retry backoff, an extension deciding what to inject — does not count against throughput.
- `out` / `in` are summed output and input tokens of every assistant message in the turn.
- A turn that took more than one agent run says so: `TPS 47.5 tok/s (3 runs).`
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
- Reported once per settled turn, from `agent_settled`. Reporting per `agent_end` prints one partial number per agent run, and a turn can span several — a retry, a compaction retry, a message another extension injected before settling.
- The summary is a `ui.notify` info message: it never enters the model context and never writes to the terminal while the TUI owns it.
- A turn that produced no output tokens (aborted, or nothing generated) reports nothing instead of `0.0 tok/s`.

## Development

```sh
npm install
npm test      # node --test with native TypeScript stripping (Node >= 22.18)
npm run check # tsc --noEmit
```

`stats.ts` holds the pure math (`createTotals` / `addRun` / `summarizeTotals`) and formatting; `tps.ts` only wires the pi events to it.

## Releasing

1. Add entries under `## [Unreleased]` in `CHANGELOG.md`.
2. Run `npm run release -- 1.1.0` (or `./scripts/release.sh 1.1.0`).

The script refuses to run on a dirty tree or off `main`, checks that `v1.1.0` does not exist yet, runs `npm test` and `npm run check`, bumps `package.json` and `package-lock.json`, promotes the Unreleased entries to `## [1.1.0] - <date>`, commits `chore: release v1.1.0`, tags it, pushes `main` and the tag, and creates the GitHub release from that changelog section.

Options:

- `--dry-run`: validate and print the plan, write nothing.
- `--no-push`: stop after the local commit and tag.
- `--skip-checks`: skip tests and typechecking.

## License

MIT
