# Agent usage statistics

Two files, produced by `tools/agent-usage-stats.js` on 2026-11-04 and committed
because the session logs they summarise were deleted afterwards to free disk:

- `agent-usage-daily.json` — one row per UTC day from 2026-03-26: commits on
  `origin/main` by author class (`codex`, `claude`, `ops` = the "Wine Ops"
  identity on the ops box, `human` = everything else), Codex and Claude tokens
  (input, cached, output, reasoning; Codex split by role), tokens per commit,
  and peak concurrent sessions. `coverage` and `sources` say what was scanned.
- `agent-sessions.json` — one row per agent thread: vendor, id, host, role,
  main model, start / first and last token use, total and output tokens, and the
  log file names it came from. No transcript text.

## How it was produced

```sh
# on the ops box (Codex coordinator + workers), from a copy of the tool
node agent-usage-stats.js codex --root=$HOME/.codex/sessions --root=$HOME/.codex/transcript-archives --host=boat --out=codex-boat.json
# on the laptop
node tools/agent-usage-stats.js codex  --root=$HOME/.codex/sessions  --host=laptop --out=codex-laptop.json
node tools/agent-usage-stats.js claude --root=$HOME/.claude/projects --host=laptop --out=claude-laptop.json
# merge with git and write these files
node tools/agent-usage-stats.js merge --in=codex-boat.json --in=codex-laptop.json --in=claude-laptop.json \
  --out=docs/stats/agent-usage-daily.json --sessions-out=docs/stats/agent-sessions.json
node tools/agent-usage-stats.js report --in=docs/stats/agent-usage-daily.json --weekly
```

Only sessions whose working directory (Codex) or project directory (Claude)
names `wine-assembly` are counted. The counting rules — cumulative Codex
counters taken once per thread, Claude messages deduplicated by id — are in the
tool's header. As a cross-check, the per-thread Codex totals for the ops box
match `tokens_used` in Codex's own `state_5.sqlite` exactly (for example the
first coordinator thread, 6,881,830,876 tokens).

## What it does not cover

- **No logs before 2026-04-27 (Codex) or 2026-08-14 (Claude).** The first 776
  April commits and all of March have no token data; Claude Code sessions
  before mid-August were not kept.
- **Claude sessions that ran elsewhere.** About 860 commits from Aug 27 to
  Sep 20 carry a `Claude-Session: https://claude.ai/code/...` trailer (cloud
  sessions), and the commits authored as `Claude <noreply@anthropic.com>` on
  Oct 6, 10 and 11 (about 700) came from sessions whose logs are on neither
  machine. The Claude orchestrator that ran on the ops box from Oct 23 left no
  transcripts (its project directory was empty). Those days therefore show a
  misleadingly low tokens-per-commit.
- **Tokens are not comparable one-to-one across vendors.** Codex input includes
  cached input; Claude's cache reads and writes are separate fields and are
  added into its total. Both totals are dominated (~97%) by cache reads of the
  growing context, so output tokens are the better measure of work produced.
- Commits are dated by author date in UTC, so a rebased or cherry-picked commit
  counts on the day it was written, not the day it landed.
