import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTpsSummary, type MessageLike, summarizeAgentRun, type UsageLike } from "../stats.ts";

const assistant = (usage: UsageLike): MessageLike => ({ role: "assistant", usage });

describe("summarizeAgentRun", () => {
	it("sums usage across assistant messages and derives tok/s from output", () => {
		const messages: MessageLike[] = [
			assistant({ input: 1000, output: 200, cacheRead: 100_000, cacheWrite: 0, totalTokens: 101_200 }),
			{ role: "user" },
			assistant({ input: 722, output: 231, cacheRead: 135_264, cacheWrite: 0, totalTokens: 136_217 }),
		];

		const summary = summarizeAgentRun(messages, 9100);
		assert.ok(summary);
		assert.equal(summary.output, 431);
		assert.equal(summary.input, 1722);
		assert.equal(summary.cacheRead, 235_264);
		assert.equal(summary.cacheWrite, 0);
		assert.equal(summary.totalTokens, 237_417);
		assert.equal(Math.round(summary.tps * 10) / 10, 47.4);
	});

	it("ignores messages without usage and non-assistant roles", () => {
		const summary = summarizeAgentRun(
			[{ role: "assistant" }, { role: "user", usage: { output: 500 } }, assistant({ output: 10 })],
			2000,
		);
		assert.ok(summary);
		assert.equal(summary.output, 10);
		assert.equal(summary.input, 0);
	});

	it("reports nothing when the run produced no output tokens", () => {
		assert.equal(summarizeAgentRun([assistant({ input: 100 })], 1000), undefined);
		assert.equal(summarizeAgentRun([], 1000), undefined);
	});

	it("reports nothing for a non-positive elapsed time", () => {
		assert.equal(summarizeAgentRun([assistant({ output: 10 })], 0), undefined);
		assert.equal(summarizeAgentRun([assistant({ output: 10 })], -5), undefined);
	});
});

describe("formatTpsSummary", () => {
	it("formats the one-line summary with grouped counts", () => {
		const summary = summarizeAgentRun(
			[assistant({ input: 1722, output: 431, cacheRead: 235_264, cacheWrite: 0, totalTokens: 237_417 })],
			9100,
		);
		assert.ok(summary);
		assert.equal(
			formatTpsSummary(summary),
			"TPS 47.4 tok/s. out 431, in 1,722, cache r/w 235,264/0, total 237,417, 9.1s",
		);
	});
});
