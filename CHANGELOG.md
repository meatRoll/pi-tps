# Changelog

## [Unreleased]

## [1.1.0] - 2026-11-19
- Report once per settled turn instead of once per agent run. A turn can span
  several runs (retry, compaction retry, an injected message), which used to
  print several partial numbers for work the user did once.
- Sum generation time per run, so a wait between runs is not charged to
  throughput.
- Name the run count when a turn took more than one: `TPS 47.5 tok/s (3 runs).`
- Emit from `agent_settled`, the last event of the turn. `ui.notify` rewrites
  the previous status line when two arrive back to back, so a line written at
  `agent_end` is the one another extension replaces.

## [1.0.0]
- Initial release: report tok/s plus input, output, cache read/write and total tokens after each agent run.
- Split the usage math and formatting into `stats.ts` so it is testable without an extension host.
- Skip non-interactive modes and runs without output tokens.
