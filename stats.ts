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

export interface TpsSummary {
	/** Output tokens divided by elapsed seconds. */
	tps: number;
	output: number;
	input: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	elapsedSeconds: number;
}

/** Sum the usage of every assistant message in one agent run. */
export function summarizeAgentRun(
	messages: readonly MessageLike[],
	elapsedMs: number,
): TpsSummary | undefined {
	if (!(elapsedMs > 0)) return undefined;

	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let totalTokens = 0;

	for (const message of messages) {
		if (message.role !== "assistant" || !message.usage) continue;
		input += message.usage.input ?? 0;
		output += message.usage.output ?? 0;
		cacheRead += message.usage.cacheRead ?? 0;
		cacheWrite += message.usage.cacheWrite ?? 0;
		totalTokens += message.usage.totalTokens ?? 0;
	}

	// An aborted or empty run reports nothing rather than 0 tok/s noise.
	if (output <= 0) return undefined;

	const elapsedSeconds = elapsedMs / 1000;
	return {
		tps: output / elapsedSeconds,
		output,
		input,
		cacheRead,
		cacheWrite,
		totalTokens,
		elapsedSeconds,
	};
}

/** One-line summary, e.g. `TPS 47.5 tok/s. out 431, in 1,722, cache r/w 235,264/0, total 237,417, 9.1s`. */
export function formatTpsSummary(summary: TpsSummary): string {
	const count = (value: number) => value.toLocaleString("en-US");
	return [
		`TPS ${summary.tps.toFixed(1)} tok/s.`,
		`out ${count(summary.output)},`,
		`in ${count(summary.input)},`,
		`cache r/w ${count(summary.cacheRead)}/${count(summary.cacheWrite)},`,
		`total ${count(summary.totalTokens)},`,
		`${summary.elapsedSeconds.toFixed(1)}s`,
	].join(" ");
}
