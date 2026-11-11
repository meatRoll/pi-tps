#!/usr/bin/env bash
#
# Cut a release: bump the version, promote the changelog, commit, tag, push, and
# create the GitHub release.
#
#   ./scripts/release.sh 1.1.0            # full release
#   ./scripts/release.sh 1.1.0 --dry-run  # validate only, nothing is written
#   ./scripts/release.sh 1.1.0 --no-push  # commit and tag locally, skip push/release
#
# Add entries under "## [Unreleased]" in CHANGELOG.md before running this.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"

version=""
dry_run=false
no_push=false
skip_checks=false

usage() {
	cat <<'EOF'
Usage: scripts/release.sh <version> [options]

  <version>       New semver version, e.g. 1.1.0 (no leading "v").
  --dry-run       Validate everything, write nothing.
  --no-push       Commit and tag locally, skip push and GitHub release.
  --skip-checks   Skip npm test and npm run check.
  --help          Show this message.

Release notes come from the "## [Unreleased]" section of CHANGELOG.md.
EOF
}

die() {
	printf 'error: %s\n' "$*" >&2
	exit 1
}

step() {
	printf '\n== %s\n' "$*"
}

while [ $# -gt 0 ]; do
	case "$1" in
		--dry-run) dry_run=true ;;
		--no-push) no_push=true ;;
		--skip-checks) skip_checks=true ;;
		--help | -h) usage; exit 0 ;;
		-*) printf 'error: unknown option %s\n\n' "$1" >&2; usage; exit 1 ;;
		*)
			[ -z "$version" ] || die "only one version argument is allowed"
			version="$1"
			;;
	esac
	shift
done

[ -n "$version" ] || { usage; exit 1; }
printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "version must look like 1.2.3"

step "Preflight"
for tool in git node npm; do
	command -v "$tool" >/dev/null 2>&1 || die "$tool is required"
done
if ! $no_push; then
	command -v gh >/dev/null 2>&1 || die "gh is required unless --no-push is used"
	gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"
fi

[ -z "$(git status --porcelain)" ] || die "working tree is not clean; commit or stash first"

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || die "releases are cut from main, currently on '$branch'"

current=$(node -p "require('./package.json').version")
[ "$current" != "$version" ] || die "package.json is already at $version"

git rev-parse -q --verify "refs/tags/v$version" >/dev/null && die "tag v$version already exists"

if git ls-remote --exit-code --tags origin "refs/tags/v$version" >/dev/null 2>&1; then
	die "tag v$version already exists on origin"
fi

node scripts/changelog.mjs unreleased >/dev/null || die "add entries under '## [Unreleased]' in CHANGELOG.md first"
node scripts/changelog.mjs notes "$version" >/dev/null 2>&1 && die "CHANGELOG.md already has a '$version' section"

if ! $dry_run; then
	step "Sync with origin"
	git fetch --quiet origin main
	if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
		die "main is not in sync with origin/main; pull or push first"
	fi
fi

if ! $skip_checks; then
	step "Checks"
	npm test
	npm run check
fi

if $dry_run; then
	step "Dry run"
	printf 'would bump %s -> %s, promote the changelog, commit, tag v%s' "$current" "$version" "$version"
	if $no_push; then printf ' (no push)\n'; else printf ', push, and create the GitHub release\n'; fi
	exit 0
fi

step "Bump version"
npm version "$version" --no-git-tag-version --ignore-scripts

step "Promote changelog"
node scripts/changelog.mjs release "$version"

step "Commit and tag"
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v$version"
git tag -a "v$version" -m "pi-tps v$version"

if $no_push; then
	step "Done locally"
	printf 'main and tag v%s are local. Finish with:\n' "$version"
	printf '  git push origin main\n  git push origin v%s\n  gh release create v%s --title "pi-tps v%s" --notes-file <notes>\n' \
		"$version" "$version" "$version"
	exit 0
fi

step "Push"
if ! git push origin main; then
	die "push failed; the release commit and tag v$version are local. Retry with 'git push origin main && git push origin v$version'"
fi
git push origin "v$version"

step "GitHub release"
notes_file=$(mktemp "${TMPDIR:-/tmp}/pi-tps-notes.XXXXXX")
trap 'rm -f "$notes_file"' EXIT
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
{
	node scripts/changelog.mjs notes "$version"
	printf '\nInstall: `pi install git:%s`\n' "$repo"
} >"$notes_file"

gh release create "v$version" --repo "$repo" --title "pi-tps v$version" --notes-file "$notes_file"

step "Released"
printf 'main and v%s are pushed, the GitHub release is up.\n' "$version"
