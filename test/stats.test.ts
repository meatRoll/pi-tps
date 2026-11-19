import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	addRun,
	createTotals,
	formatTpsSummary,
	type MessageLike,
	summarizeAgentRun,
	summarizeTotals,
	type UsageLike,
} from "../stats.ts";

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

describe("turn totals", () => {
	it("folds several runs into one number", () => {
		const totals = createTotals();
		addRun(totals, [assistant({ input: 800, output: 200, totalTokens: 1000 })], 4000);
		addRun(totals, [assistant({ input: 900, output: 400, totalTokens: 1300 })], 6000);

		const summary = summarizeTotals(totals);
		assert.ok(summary);
		assert.equal(summary.runs, 2);
		assert.equal(summary.output, 600);
		assert.equal(summary.input, 1700);
		assert.equal(summary.elapsedSeconds, 10);
		assert.equal(Math.round(summary.tps * 10) / 10, 60);
	});

	it("sums run time instead of wall clock, so waits between runs are not counted", () => {
		const totals = createTotals();
		addRun(totals, [assistant({ output: 100 })], 2000);
		// A minute passes while an extension decides what to inject, then run two.
		addRun(totals, [assistant({ output: 100 })], 2000);

		const summary = summarizeTotals(totals);
		assert.ok(summary);
		assert.equal(summary.elapsedSeconds, 4);
		assert.equal(summary.tps, 50);
	});

	it("reports nothing when the turn produced no output", () => {
		const totals = createTotals();
		addRun(totals, [assistant({ input: 500 })], 1000);
		assert.equal(summarizeTotals(totals), undefined);
	});

	it("names the run count only when a turn took more than one", () => {
		const single = createTotals();
		addRun(single, [assistant({ output: 431, input: 1722, totalTokens: 237_417 })], 9100);
		const one = summarizeTotals(single);
		assert.ok(one);
		assert.ok(!formatTpsSummary(one).includes("runs"));

		addRun(single, [assistant({ output: 1 })], 100);
		const two = summarizeTotals(single);
		assert.ok(two);
		assert.match(formatTpsSummary(two), /tok\/s \(2 runs\)/);
	});
});
