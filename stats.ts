/**
 * Pure token-usage math for pi-tps. Kept free of pi imports so it can be tested
 * without an extension host.
 */

/** The parts of a message/usage pi-tps reads. */
export interface UsageLike {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
	totalTokens?: number;
}

export interface MessageLike {
	role?: string;
	usage?: UsageLike;
}

/**
 * Running totals for one settled turn. A turn is one run chain: the prompt,
 * plus whatever Pi chains onto it (retries, compaction retries, queued
 * follow-ups), plus any message an extension injected before it settled.
 */
export interface TpsTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	/** Wall-clock generation time, summed per run so waits between runs are not counted. */
	elapsedMs: number;
	runs: number;
}

export interface TpsSummary {
	/** Output tokens divided by elapsed seconds. */
	tps: number;
	output: number;
	input: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	elapsedSeconds: number;
	/** How many agent runs the turn took. */
	runs: number;
}

export function createTotals(): TpsTotals {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, elapsedMs: 0, runs: 0 };
}

/** Fold one agent run into the turn's totals. */
export function addRun(totals: TpsTotals, messages: readonly MessageLike[], elapsedMs: number): void {
	if (elapsedMs > 0) totals.elapsedMs += elapsedMs;
	totals.runs += 1;
	for (const message of messages) {
		if (message.role !== "assistant" || !message.usage) continue;
		totals.input += message.usage.input ?? 0;
		totals.output += message.usage.output ?? 0;
		totals.cacheRead += message.usage.cacheRead ?? 0;
		totals.cacheWrite += message.usage.cacheWrite ?? 0;
		totals.totalTokens += message.usage.totalTokens ?? 0;
	}
}

/** Turn accumulated totals into a summary, or nothing when there is nothing to say. */
export function summarizeTotals(totals: TpsTotals): TpsSummary | undefined {
	if (!(totals.elapsedMs > 0)) return undefined;
	// An aborted or empty turn reports nothing rather than 0 tok/s noise.
	if (totals.output <= 0) return undefined;

	const elapsedSeconds = totals.elapsedMs / 1000;
	return {
		tps: totals.output / elapsedSeconds,
		output: totals.output,
		input: totals.input,
		cacheRead: totals.cacheRead,
		cacheWrite: totals.cacheWrite,
		totalTokens: totals.totalTokens,
		elapsedSeconds,
		runs: totals.runs,
	};
}

/** Sum the usage of every assistant message in one agent run. */
export function summarizeAgentRun(
	messages: readonly MessageLike[],
	elapsedMs: number,
): TpsSummary | undefined {
	if (!(elapsedMs > 0)) return undefined;
	const totals = createTotals();
	addRun(totals, messages, elapsedMs);
	return summarizeTotals(totals);
}

/** One-line summary, e.g. `TPS 47.5 tok/s. out 431, in 1,722, cache r/w 235,264/0, total 237,417, 9.1s`. */
export function formatTpsSummary(summary: TpsSummary): string {
	const count = (value: number) => value.toLocaleString("en-US");
	const runs = summary.runs > 1 ? ` (${summary.runs} runs)` : "";
	return [
		`TPS ${summary.tps.toFixed(1)} tok/s${runs}.`,
		`out ${count(summary.output)},`,
		`in ${count(summary.input)},`,
		`cache r/w ${count(summary.cacheRead)}/${count(summary.cacheWrite)},`,
		`total ${count(summary.totalTokens)},`,
		`${summary.elapsedSeconds.toFixed(1)}s`,
	].join(" ");
}
