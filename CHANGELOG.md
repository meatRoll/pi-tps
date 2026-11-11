# Changelog

## [Unreleased]

## [1.0.0]

- Initial release: report tok/s plus input, output, cache read/write and total tokens after each agent run.
- Split the usage math and formatting into `stats.ts` so it is testable without an extension host.
- Skip non-interactive modes and runs without output tokens.
