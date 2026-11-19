/**
 * pi-tps: after each settled turn, report throughput and token usage.
 *
 * The message goes through ctx.ui.notify, so it never touches the model context
 * and never writes to the terminal while the TUI owns it.
 *
 * Reported at agent_settled, not agent_end: a turn can span several agent runs
 * (a retry, a compaction retry, a message an extension injected before settling),
 * and reporting each run separately prints several partial numbers for what the
 * user did once. agent_settled is also the last event of the turn, which matters
 * for the trailing status line — Pi rewrites the previous status in place when
 * two arrive back to back, so whoever speaks last is the one you read.
 *
 * Install: pi install git:github.com/meatRoll/pi-tps
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { addRun, createTotals, formatTpsSummary, summarizeTotals } from "./stats.ts";

export {
	addRun,
	createTotals,
	formatTpsSummary,
	summarizeAgentRun,
	summarizeTotals,
} from "./stats.ts";
export type { MessageLike, TpsSummary, TpsTotals, UsageLike } from "./stats.ts";

export default function (pi: ExtensionAPI) {
	let totals = createTotals();
	let runStartedAt: number | null = null;

	pi.on("agent_start", () => {
		runStartedAt = Date.now();
	});

	pi.on("agent_end", (event) => {
		const startedAt = runStartedAt;
		runStartedAt = null;
		if (startedAt === null) return;
		addRun(totals, event.messages, Date.now() - startedAt);
	});

	pi.on("agent_settled", (_event, ctx) => {
		const summary = summarizeTotals(totals);
		totals = createTotals();
		runStartedAt = null;
		if (!ctx.hasUI || !summary) return;
		ctx.ui.notify(formatTpsSummary(summary), "info");
	});
}
