/**
 * pi-tps: after each agent run, report throughput and token usage.
 *
 * The message goes through ctx.ui.notify, so it never touches the model context
 * and never writes to the terminal while the TUI owns it.
 *
 * Install: pi install git:github.com/meatRoll/pi-tps
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { formatTpsSummary, summarizeAgentRun } from "./stats.ts";

export { formatTpsSummary, summarizeAgentRun } from "./stats.ts";
export type { MessageLike, TpsSummary, UsageLike } from "./stats.ts";

export default function (pi: ExtensionAPI) {
	let startedAt: number | null = null;

	pi.on("agent_start", () => {
		startedAt = Date.now();
	});

	pi.on("agent_end", (event, ctx) => {
		if (!ctx.hasUI) return;
		if (startedAt === null) return;

		const elapsedMs = Date.now() - startedAt;
		startedAt = null;

		const summary = summarizeAgentRun(event.messages, elapsedMs);
		if (!summary) return;

		ctx.ui.notify(formatTpsSummary(summary), "info");
	});
}
