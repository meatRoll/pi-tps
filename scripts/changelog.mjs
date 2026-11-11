#!/usr/bin/env node
/**
 * Changelog helpers for scripts/release.sh.
 *
 *   node scripts/changelog.mjs unreleased        # print the Unreleased body, non-zero when empty
 *   node scripts/changelog.mjs release <version> # move Unreleased entries under <version>
 *   node scripts/changelog.mjs notes <version>   # print the body of one released version
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const changelogPath = join(dirname(dirname(fileURLToPath(import.meta.url))), "CHANGELOG.md");
const HEADING = /^## \[([^\]]+)\]/;

function fail(message) {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

function readChangelog() {
	try {
		return readFileSync(changelogPath, "utf8");
	} catch {
		fail(`Cannot read ${changelogPath}`);
	}
}

/** Split the changelog into a preamble and one section per version heading. */
function parse(text) {
	const lines = text.split("\n");
	const preamble = [];
	const sections = [];
	let current = undefined;

	for (const line of lines) {
		const heading = HEADING.exec(line);
		if (heading) {
			current = { version: heading[1], heading: line, body: [] };
			sections.push(current);
			continue;
		}
		if (current) current.body.push(line);
		else preamble.push(line);
	}

	for (const section of sections) {
		section.body = trimBlankLines(section.body);
	}
	return { preamble: trimBlankLines(preamble), sections };
}

function trimBlankLines(lines) {
	const copy = [...lines];
	while (copy.length > 0 && copy[0].trim() === "") copy.shift();
	while (copy.length > 0 && copy[copy.length - 1].trim() === "") copy.pop();
	return copy;
}

function findSection(sections, version) {
	const section = sections.find((candidate) => candidate.version === version);
	return section && section.body.length > 0 ? section : undefined;
}

function unreleased(text) {
	const { sections } = parse(text);
	const section = findSection(sections, "Unreleased");
	if (!section) fail("CHANGELOG.md has no non-empty '## [Unreleased]' section: add entries before releasing.");
	return section.body;
}

function notes(text, version) {
	const { sections } = parse(text);
	const section = findSection(sections, version);
	if (!section) fail(`CHANGELOG.md has no non-empty '## [${version}]' section.`);
	return section.body;
}

function release(text, version) {
	const { preamble, sections } = parse(text);
	const index = sections.findIndex((section) => section.version === "Unreleased");
	if (index === -1) fail("CHANGELOG.md has no '## [Unreleased]' section.");

	const body = sections[index].body;
	if (body.length === 0) fail("'## [Unreleased]' is empty: add entries before releasing.");
	if (sections.some((candidate) => candidate.version === version)) {
		fail(`CHANGELOG.md already has a '${version}' section.`);
	}

	const today = new Date().toISOString().slice(0, 10);
	const updated = sections.map((section) => ({ ...section, body: [...section.body] }));
	updated[index].body = [];
	updated.splice(index + 1, 0, { version, heading: `## [${version}] - ${today}`, body });

	const chunks = [preamble.join("\n").trim()];
	for (const entry of updated) {
		chunks.push([entry.heading, ...entry.body].join("\n"));
	}
	try {
		writeFileSync(changelogPath, `${chunks.join("\n\n").trim()}\n`);
	} catch {
		fail(`Cannot write ${changelogPath}`);
	}
	return body;
}

const [command, argument] = process.argv.slice(2);
const text = readChangelog();

switch (command) {
	case "unreleased":
		process.stdout.write(`${unreleased(text).join("\n")}\n`);
		break;
	case "release":
		if (!argument) fail("Usage: node scripts/changelog.mjs release <version>");
		release(text, argument);
		break;
	case "notes":
		if (!argument) fail("Usage: node scripts/changelog.mjs notes <version>");
		process.stdout.write(`${notes(text, argument).join("\n")}\n`);
		break;
	default:
		fail("Usage: node scripts/changelog.mjs <unreleased|release|notes> [version]");
}
