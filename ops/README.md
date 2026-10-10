# Wine / Ops

A local dashboard with append-only blocker replies and an optional tmux terminal.
Files remain the source of truth; no database or external service.

```sh
npm ci --prefix ops --ignore-scripts
node ops/server.js
# http://127.0.0.1:8098
```

The UI polls every five seconds, including background tabs for approval alerts
(the browser may throttle background timers). Reads are cached in memory;
restart to rebuild everything. The server binds only to loopback. Explicit
actions create/edit/reorder tasks in `TODOS.md`, append discussion to
`messageboard.txt`, or send terminal input after enabling Control. Creating a
task or posting a note does not launch or wake an agent.

## Browser terminal

The orchestrator card has a **Terminal >_** button. Open it to view the registered
pane; **Enable control** sends keyboard input to that pane. Only one browser can
control a mapping at a time. Reconnect starts in View. Closing the drawer detaches
the web client and leaves the agent running.

`ops/terminals.json` explicitly links an agent ID to a tmux session, pane ID and
pane PID. A stale PID disables attachment; update the mapping after deliberately
replacing the orchestrator. Find those values with:

```sh
tmux list-panes -a -F '#{session_name} #{pane_id} #{pane_pid}'
```

The bridge uses [tmux control mode](https://github.com/tmux/tmux/wiki/Control-Mode)
through Node child-process pipes, plus JavaScript-only `ws` and `@xterm/xterm`.
There is no `node-pty`, native Node addon, or dependency install script. The
existing tmux executable is required. Only the mapped pane is shown, with an
initial screen capture followed by live output; tmux status bars and copy-mode
overlays are not mirrored. The original pane dimensions are retained; smaller
viewers scroll instead of resizing the agent's terminal.

WebSocket connections require a same-origin, single-use, 30-second ticket.
View input is rejected by the server. Control input is sent as literal bytes to
the pinned pane, with a PID check before delivery. Keep this loopback service local.
Run `node --test ops/terminal.test.js` to exercise a disposable tmux server;
the test never sends commands to the real orchestrator.

## Sources

**What matters now** is the agent-written `ops/STATUS.md`, shown prominently on
Overview with a compact preview on Tasks. It refreshes with the other files.
This is an editorial summary, not a health calculation. The explicit review
timestamp and author are displayed; file mtime is never substituted. After
24 hours the UI asks readers to check freshness, without claiming work stopped.

The coordinator owns routine updates. Workers report material changes on the
board so concurrent agents do not overwrite each other. Keep about 150 words:
what actually changed, what needs attention from the user, and what happens
next. Remove superseded points rather than accumulating a log. Reread the file,
write a temporary sibling, then rename it after review. Example:

```markdown
updated: 2026-10-02T02:40:26Z
author: codex:coordinator-session-id

# Startup works; gameplay still needs verification.

## Needs attention
- Choose which installer version to support.

## What changed
- The startup regression passed; this does not establish gameplay support.

## Next
- Verify controls and save gameplay evidence after the version is chosen.
```

Separate metadata from the body with a blank line. Headings, paragraphs,
bullets, bold, and inline code are supported; HTML remains inert text. The file
is limited to 16 KiB. Missing files and missing review timestamps are explicit.
The summary does not change task status, dispatch agents, or resolve blockers.

| View | Source |
| --- | --- |
| Tasks | Existing root `TODOS.md` |
| What matters now | Agent-maintained `ops/STATUS.md` |
| Corpus | `test/candidate-corpus/manifest.json`, matching tasks and recorded runs |
| Candidate notes | Existing `docs/re-notes/<candidate-id>.md` or note paths named in the manifest |
| Activity | Latest 150 messageboard entries plus up to 150 unique Git commits reachable from local refs, with All / Commits / Messages filtering |
| Agents | Project-scoped local Claude and Codex JSONL session logs, local process snapshots |
| Runs | `scratch/runs/<id>/result.json` and preserved `ops/runs/<id>/result.json` |

The dashboard does not treat manifest notes or smoke-test `READY` as evidence
of gameplay. Fixture **present** means the named executable files exist, not
that their checksums or behavior have been verified. Candidate IDs are exact;
they are not inferred from executable basenames.

## Persistent Claude terminals on the Linux box

Run `node ops/claude-tmux.js --session-id UUID --id claude-worker --tmux wine-claude-worker --label 'Claude worker' --wait`
to resume an existing conversation interactively and register its current pane
and PID. Unlike `claude -p`, the interactive session stays available after a
turn. The launcher waits for an existing run of the same session to finish;
it never kills or duplicates that run. Use this launcher for subsequent resumes
instead of starting headless copies of a session that already has a terminal.

On the dedicated box, the user explicitly requested Claude permission bypass.
Pass `--dangerously-skip-permissions` to the launcher for that mode; the default
does not bypass permissions. This controls tool permission prompts, not task
decisions: design approval, release decisions, and existing review blockers
still require their recorded resolution.

Terminal records expose provider, lifecycle state, and permission mode. Ended
panes remain unavailable until resumed and registered; they do not generate
urgent approval-monitor warnings. Codex's menu parser and y/p/Escape controls
are not applied to Claude. Claude in normal permission mode is operated through
the terminal; automated Claude approval-menu buttons are not implemented.
Telegram chat is never typed into a pane: the bot appends it to
`scratch/telegram/inbox.jsonl` and consumers read past their own cursor (see
[TELEGRAM.md](TELEGRAM.md)). Linux Claude process
matching validates machine/namespace, kernel start ticks and wall-clock start
before showing PID, CPU, RSS and descendants.

## Tasks: use the existing Markdown file

**Tasks → + New task** collects a title, done criteria, optional candidate, and
Up next/Backlog queue. More fields include a next step, dependencies (stable task
IDs), and notes/references. New requests get a UUID-based `T-…` ID and are
appended under `## Dashboard requests`, unassigned and **Awaiting pickup**.

The coordinator acknowledges by recording `accepted: <ISO timestamp>` and
`accepted-by: codex:<session ID>`, then assigns `owner:` and updates the task
status when work actually starts. It can append `[OPS-ACK task-id] message` to
the board so the acknowledgment also appears in Discussion. Assignment alone
shows **Assigned**; it is not an invented acknowledgment timestamp. The UI shows
unresolved `depends-on:` IDs; the coordinator must check them before dispatch.

Task Details exposes done criteria, next step, discussion, evidence, and queue
actions. **Edit** preserves owner, status, timestamps, handoffs, and unknown source
fields. **↑ / ↓** reorder editable peers of the same status within their existing
Markdown section, preserving section boundaries. **Defer**, **Move to backlog**,
and **Reopen/Queue task** change the ledger; they do not interrupt an agent.
Tasks in review offer **Mark reviewed / done** or **Request another pass**.
Legacy tasks without a unique explicit ID stay read-only until an ID is added.

Worker tasks with no terminal of their own offer **Coordinator >_** when it is
available. The coordinator bar reports observed activity; a live PID does not
prove it will pick up a task. Open its terminal and explicitly prompt an idle
coordinator to read the queue. No automatic keystrokes are sent.

### Concurrent task edits

Task writes compare a SHA-256 source revision, acquire the directory lock
`scratch/ops-task-write.lock`, reread the file, and write a temporary file beside
`TODOS.md` before renaming it. A stale form gets a conflict; its draft stays in
the editor. **Load latest, keep my draft** shows the current task source for
comparison before an explicit retry. Repeated submissions reuse a request ID;
create/edit retries do not duplicate the saved task. Task mutation notices use
`[OPS-TASK task-id]` in the board. If a notice fails after saving, the UI says the
task was saved and that coordinator notification failed.

**All agents editing `TODOS.md` must use the same lock.** Create the directory
exclusively, reread the source after acquiring it, preserve unrelated content,
write the update, and remove the empty lock directory in a `finally` block.
If it exists, wait and retry; do not remove another writer's lock. Ordinary
editors that ignore the lock can still race the final revision check/rename;
the lock is the shared-writer contract, not an OS-enforced file lock. A crashed
writer can leave a lock; verify it is no longer writing before removing it.

### Task discussion

The task detail **Send** action appends one `[OPS-NOTE task-id]` line with a
deduplication request ID. Agents can append `[OPS-NOTE task-id] message` and
`[OPS-ACK task-id] message` using their own actor name and the usual append-only
messageboard protocol. Blocker replies remain `[OPS-REPLY task-id]`.
Discussion shows the latest 50 matching entries, including task change notices,
from the board (up to 32 MiB), independently of the Activity feed's latest 150
entries. Replies never mark a task complete or unblock it. Acknowledgments and
assignment are separate from the fact that a note was posted.

Legacy level-two sections remain visible with **unknown** status. We do not
guess whether historical prose describes work that is still open. Add ordinary
checkboxes when recording current tasks:

```markdown
## Current work

- [~] Fix resumable SEH
  id: T-0142
  candidate: serious-sam-demo
  owner: claude:YOUR_SESSION_ID
  started: 2026-10-01T14:00:00Z
  progress: 2026-10-01T14:25:00Z
  Next: test handler resumption after the guest commits the page.

- [ ] Verify gameplay and capture a screenshot
  id: T-0143
  candidate: serious-sam-demo
```

`[ ]` = ready, `[~]` = active, `[!]` = blocked, `[x]` = done. An optional
`status: backlog|ready|active|blocked|review|deferred|done` overrides the checkbox.
The Tasks screen groups Running, Up next, Needs review, Blocked, Backlog,
Deferred, Done, and Historical notes in that order, with text and color labels.
Within a group, file order is queue order: move a task earlier in `TODOS.md`
to prioritize it. `Next:` is shown directly on the row. Backlog, deferred,
completed, and historical groups start collapsed; filter or search to reveal
them. Group expansion is retained during refresh. Running means explicitly
assigned in the ledger, not inferred live process health. Use `deferred` for
work intentionally excluded from the current scope, rather than `blocked`.
Task rows show the latest available screenshot or diagram. Runs with an exact
`taskId` take precedence; otherwise captures from a linked candidate appear as
**Related app**, without claiming they prove this task. Owner identity alone
does not link images. Click the thumbnail for run evidence or the task title
for up to four associated visual runs. Add `taskId` to run metadata for precise
association. Preview dates are the recorded run dates, including historical
imports; they do not imply fresh validation.
Candidate IDs can occur anywhere in the item, so one task can link several
candidates. Prefer explicit IDs and use the full provider-prefixed session ID
shown in agent details for `owner:`. Session ownership is advisory. Continue
using the existing messageboard protocol to coordinate edits.

`started:` and `progress:` are explicit task timestamps, never inferred from
token counts or tool activity. Without them, the corresponding clocks show
unknown. Historical sections without checkboxes are navigation into the source,
not automatically actionable tasks.

## Blockers and decisions

Record actionable blockers as ordinary tasks in `TODOS.md`:

```markdown
- [!] Restore reproducible startup test
  id: B-startup-fixture
  owner: codex:YOUR_SESSION_ID
  blocker: The original installer is missing from the test machine.
  needs: Choose the version and supply its fixture path.
  waiting-on: maintainer
  blocked-since: 2026-10-01T14:00:00Z
```

`[!]` or `status: blocked` puts the task in Blockers and Overview's Needs attention.
Use a stable explicit `id:` (letters, digits, underscore, dot or hyphen) to enable
replies. Quiet sessions and unstructured messageboard prose are not inferred to
be blocked tasks. `blocker`, `needs`, and `waiting-on` are single-line descriptions.

Blockers are split into **Needs your input** and **Agent-resolvable** by
`blocker-model.js` `actor()`, the same function Telegram `/blockers` uses, from
recorded fields only: a blocked dependency → agent; `waiting-on` saying "no user
decision" → agent; `waiting-on` naming the user, human, you, maintainer,
dashboard-user or an approval → user; an automated-review stop or a capacity need
(host/CPU/GPU) → user; any other `waiting-on` → agent; nothing recorded → agent
(the owner must state the need). Each row shows the basis. Write
`waiting-on: user` when the user must act.

**Respond → Post reply to messageboard** appends one timestamped line:

```text
2026-10-01T14:15:00.000Z dashboard-user [OPS-REPLY B-startup-fixture] Use version 1.0 at test/fixtures/installer.exe; verify startup.
```

The reply is a decision/help handoff, not a success assertion. The owner reads
the board, verifies the proposed fix, records evidence, then changes the task to
`[~]` (resumed) or `[x]` (done). If it still fails, keep `[!]` and update the ask.
Agents may append replies using the same `[OPS-REPLY task-id]` marker, with their
own actor name. The dashboard shows up to ten matching replies from the task
discussion; older history remains in the file. A task stays blocked after
a reply, visibly labeled “Reply posted · still blocked”.

The write endpoint accepts only same-origin JSON, a currently blocked stable ID,
and a nonempty reply of at most 2,000 characters. Multiline text is normalized to
one line; existing board bytes are preserved. No automatic sends, task edits, or
process signals occur. On an uncertain network result, inspect Activity before
retrying to avoid posting twice.

## Runs: one folder per execution

Create a folder such as `scratch/runs/R-0085/` with a `result.json` and its
outputs. `scratch/` is already gitignored. This is a file convention, not a new
capture API: use your existing shell, browser-control, and test tools.

### Agent capture workflow

`scratch/runs/<id>/` is the durable evidence location. Any other directory
under `scratch/` is a disposable work directory after 48 hours: preserve needed
evidence in the run folder before then. This retention rule does not authorize
deleting active workers' files or a symlink's target.

Before publishing a bundle, run `node ops/check-run-evidence.js` (or pass the
checkout root as its argument). The check exits nonzero for artifact references
outside their own run directory, including absolute paths, traversal and symlinks.
It covers screenshots, diagrams, gameplay screenshots, artifact arrays/object
maps, explicit evidence, and build source-manifest/patch files. Missing local
artifacts are reported separately; containment does not prove completeness.
Historical commands and source working-directory metadata remain unchanged.
Run its regression tests with `node --test ops/run-evidence.test.js`.
For existing bundles, `node ops/check-run-evidence.js --localize ROOT` copies
only named external files, verifies their bytes and rewrites the corresponding
references atomically. Originals are retained; work directories are never moved.
Unavailable external files stay reported as failures until recovered or explicitly
recorded as missing evidence, with the unavailable artifact field set to `null`.

1. Choose the exact `candidateId` from `test/candidate-corpus/manifest.json`.
   App registry IDs and EXE basenames are not necessarily candidate IDs. If the
   app has no manifest entry, keep the evidence in your existing investigation
   notes until it is registered; do not attach it to an unrelated candidate.
2. Make a unique run folder: use a UTC timestamp, candidate ID, and a short
   agent/session suffix, for example
   `scratch/runs/20261001T153012Z-serious-sam-demo-agent7-before/`.
   Each execution owns its own folder; never overwrite another run.
3. Reproduce or test using the existing tools. CLI `test/run.js --png=PATH`
   writes a headless capture. For an already-controlled browser session,
   `node tools/ctl.js -s SESSION_ID png PATH` captures that session. Existing
   browser tests may already save the required PNGs and logs: copy those files
   into the run folder instead of rerunning solely to change their location.
   Record the original execution time and command, not the copy time.
4. Save the screenshots and relevant output first. Use ordinary files inside
   the run folder, not symlinks to temporary or remote artifacts. Remote workers
   should copy the completed bundle into the checkout served by the dashboard;
   it cannot discover files on another machine or in another worktree.
5. Write `result.json` with the tested route/checkpoint (`startup`, `main-menu`,
   `gameplay`, or a specific reproduction), command, outcome, and environment.
   Record the actual loaded build: a browser may still run an older module than
   the current local build file. Include commit, dirty-patch/module hashes when
   known, and relevant browser/engine versions, renderer, thread mode, viewport,
   or input sequence. Use `null` or an explicit `unknown` for unavailable values;
   never substitute current HEAD for an unverified build identity.
6. Publish the metadata last: write `result.json.tmp` and rename it to
   `result.json` within the folder after artifact writes/copies finish. The
   dashboard ignores the temporary filename and discovers the run on refresh.
7. Inspect the image and supporting results before setting `verification` to
   `reviewed`. A successful capture or normal exit alone does not prove the menu,
   gameplay, audio, or input works. State exactly what passed in `summary`.
   Record failures too; omit a screenshot field if capture failed and explain
   why. Preserve useful failure logs.
8. For a visual fix, keep separate before/after runs with matching candidate,
   route, renderer, and environment. Reference their IDs in `TODOS.md` or the
   app's investigation notes and append a messageboard update with their paths.
   Explain any missing baseline or comparison mismatch.

```text
scratch/runs/<unique-id>/
  screen.png       # capture from this execution, if available
  output.log       # relevant test/run output
  result.json      # published last; dashboard entry point
```

No new task runner or provider-specific integration is needed. Claude and Codex
follow the same convention. The dashboard reports malformed run records and
missing artifacts under source notices; check those if a capture does not appear.

### Result format

Example (replace with actual evidence; omit unavailable artifact paths):

```json
{
  "candidateId": "serious-sam-demo",
  "taskId": "T-0142",
  "agentId": "claude:YOUR_SESSION_ID",
  "startedAt": "2026-10-01T14:30:00Z",
  "finishedAt": "2026-10-01T14:31:00Z",
  "outcome": "failed",
  "route": "startup",
  "command": "the exact reproduction command",
  "build": {
    "commit": "git commit hash",
    "dirtyPatchSha256": "hash when the worktree is dirty",
    "wasmSha256": "tested module hash"
  },
  "environment": { "host": "local", "mode": "browser", "renderer": "OpenGL" },
  "summary": "Startup fault before the menu",
  "verification": "unreviewed",
  "screenshot": "screen.png",
  "artifacts": ["output.log", "trace.log"]
}
```

Required: `candidateId`, ISO `startedAt`, and `outcome` from `passed`, `failed`,
`timeout`, `harness-error`, `running`, or `unknown`. A pass applies only to the
recorded route. Set `verification` to `reviewed` after reviewing the evidence;
this is a recorded assertion, not independent dashboard validation.

Use `screenshots: ["menu.png", "gameplay.png"]` for multiple captures. Artifact
paths are relative to that run folder; PNG/JPEG/WebP/JSON/text/log files are
served. Escaping paths and symlinks outside the folder are rejected. A missing
artifact is reported, not silently treated as a successful capture.

For reviewed gameplay scenes, also record `verification: "reviewed"`, a named
`gameplaySceneReview.reviewer`, and an explicit `gameplayScreenshots` image-name
allowlist. The corpus prefers the newest such scene, labels it **Reviewed gameplay
scene**, and identifies an earlier capture while retaining the latest run outcome.
Only existing, safely contained screenshot artifacts qualify; diagrams and route
text cannot promote an image. This records a review assertion, not automatic scene
recognition or proof of controls/FPS. Without that metadata, ordinary captures
remain visible without the gameplay badge.

### Agent rows on Overview and Agents

Agents are one full-width column. Each agent is exactly two text lines: line 1
provider, short session id, name (task title, else the task ID named in its
prompt), status word and last-activity age; line 2 the decision needed, else the
active task's `Next:`, else `Latest:` (the session's last assistant text), else
"No result or next step recorded". Each subagent (`parentAgentId`) is the same two
lines under its parent; three are shown, the rest behind "Show N more". Status
words are observations: "Quiet · check session" after 15 minutes without session
activity, "Turn ended" when the log is idle; the age is activity, never progress.
Process, tokens, evidence previews and timestamps are in the agent detail (▸).
A current subagent keeps its parent row current; search matches subagents too.
On phones lines wrap instead of truncating.

### Visuals on Overview and Agents

Within each category the EXE corpus prioritizes candidates linked to running
tasks, then review, blocked, and queued tasks. Within those groups, failed/timeout/harness-error
results come before untested, unknown, and passed results; names break ties.
An In progress banner names the active task, with a matching filter. Completed
and deferred tasks do not mark a candidate active. Task state and run outcome
are displayed separately: a past failed capture can coexist with active work.

Overview prioritizes agent activity and shows the newest visual run for each of
up to six candidates. Agent cards show one compact latest preview whose optional
`agentId` exactly matches the provider-prefixed Session
ID in agent details (for example `codex:<session-uuid>` or `claude:<session-uuid>`).
For a Claude subagent, use its displayed `claude:agent-...` identity. Runs without
an `agentId` still appear on Overview and Corpus; the dashboard does not guess
ownership from task titles or filenames. A capture can predate the current task.

Add `"diagrams": ["architecture.png", "render-flow.webp"]` to the same result
file for related diagrams exported as PNG/JPEG/WebP. These appear as diagrams in
visual previews and run details, and do not replace the candidate screenshot.
No new folder or command is needed. Save the images first, then update metadata.
Each preview uses the last image listed in the run (diagrams follow screenshots),
shows its age, and opens all run artifacts, original timestamps, and review status.
Run timestamps determine ordering; visual evidence does not imply agent health
or that the current build passes.

Promote a useful run by moving its whole folder to `ops/runs/<id>/` and committing
it. Keep large traces out of Git. Delete the scratch copy after promotion to
avoid displaying two copies. Cleaning scratch destroys unpreserved evidence.
Run folders are ordered by their explicit start timestamp, never file mtime.

## Claude and Codex observation

### Backfill existing visual evidence

Run `node ops/backfill.js --scan`, then `node ops/backfill.js --publish` to
inventory this project's historical Codex/Claude tool references and existing
`build/`, `scratch/`, `screenshots/`, and `test/output/` images. This never executes recovered commands or starts
guest applications. The scan can take several minutes for large session logs.

The inventory and dated import reports live in `scratch/ops-backfill/`.
Use `--scan-files` to refresh these directories while retaining previously scanned
session references. `--publish --candidates=notepad,calc` limits publication to
selected corpus IDs. Registry-only apps use the same ID mapping as the dashboard.
Reference-emulator/comparison captures and near-uniform frames require review
instead of automatic publication.
Published bundles live in `scratch/runs/history-<candidate>-<content-hash>/` and
appear on the next dashboard refresh. Repeating publication skips content
already in run folders. Existing runs and source files are never modified.

Candidate mapping requires an exact candidate/registered app ID as a complete
path component or image filename stem. Words in tool inputs never establish
candidate identity (for example, the ordinary word "generally" is not evidence
for GeneRally). `node ops/backfill.js --audit` moves unsafe older imports to
`scratch/ops-backfill/quarantine/` and writes an association audit, preserving
the files outside the live dashboard. Publication revalidates old inventories.
Ambiguous
associations, missing files, small PNG crops, and near-black/transparent PNGs
are reported rather than published as previews. This pixel check is only a
triage heuristic, not visual review; useful dark captures may need manual import.
Diagrams named as such are tagged separately. Other images remain screenshots.

Every bundle records original path, SHA-256, dimensions when decoded, and
session-log line references. Raw transcripts and tool commands are not copied.
A unique referencing session can link the visual to its agent card; this does
not establish authorship. These records use original file mtime as an explicitly
labeled fallback date, not verified capture time. Build identity and outcome
remain unknown, and verification remains unreviewed. The importer does not
promote historical captures into compatibility passes.

### Live process observation

Agent cards display associated local PIDs with OS-reported CPU percentage and
resident memory (RSS), plus a background-process count and summed CPU/RSS.
Agent details list PID, parent PID, CPU, RSS, executable name, OS state, process
age, and up to 40 host descendants, busiest first. Totals include all observed
descendants even when the table is capped. Shared hosts are labeled: these are
host-process measurements, not per-subagent model/token usage. CPU can exceed
100%; summed RSS can double-count shared memory. Detached/reparented processes
and remote jobs cannot be reliably attributed and are not included. Read-only
`ps`/`lsof` observations refresh at most every ten seconds; no agent processes are
started, stopped, or signaled by this feature. Command arguments and environment
variables are not sent to the browser.

The default cards prioritize session title, recent/quiet/ended activity, PID,
and a small latest preview. Unknown task/progress clocks, model names, raw
session IDs, token/cache telemetry, child processes and evidence metadata live
in Details. A context estimate at 90% or more of the reported limit gets a
compact warning on the card. Duplicate logs for the same provider/session ID
produce one card, using the most recent activity. No-session-title fallback
uses the latest capture's candidate name, or “Untitled session”.

Codex association uses an exact open session-log path on a `codex` process.
Claude also uses `~/.claude/sessions/<pid>.json`, requiring its session ID,
provider executable, local PID domain, and process start time to match the live
process table (stale/reused PIDs are rejected). Claude subagent logs can link to
their parent session host, explicitly marked shared. Multiple sessions with the
same host PID are marked shared as well; descendants are host-level processes,
not proof of which task launched them. A stopped session may retain a live host.

Missing utilities, permissions, or timeouts produce **PID unavailable**; an
unmatched session shows **PID not matched**, never a guessed PID based on its
title or working directory. Process presence and OS sleep/runnable state do not
establish agent responsiveness or progress. This observes local processes only.

Defaults:

- Codex: `~/.codex/sessions/`, filtered by record `cwd` within this repository.
- Claude: `~/.claude/projects/<encoded-repository-path>/`, likewise filtered by
  `cwd`. Subagent log files keep separate identities.

Overrides and fixture support:

```sh
node ops/server.js --port=8099 --root=/path/to/repo
node ops/server.js --codex-root=/path/to/sessions --claude-root=/path/to/project-logs
node ops/server.js --no-agents
```

Provider logs are an evolving, best-effort input format, not a stable integration
API. No log files are modified or copied. New logs are discovered every 30s;
the 100 most recently modified files per provider are considered and the newest
40 matching project sessions are displayed. The reader scans at most 10,000 log
files per provider directory, at depth five. Use narrower source directories
when needed. Missing/unreadable sources produce visible notices.

For a large session, only the first 256 KiB and final 1 MiB are parsed. The UI
labels that coverage as partial. Incomplete JSONL records are ignored until a
later refresh. Unsupported records are ignored. Full prompts, tool arguments,
tool output, and reasoning are not sent to the dashboard API; only a short
session title and summarized measurements/activity are exposed.

- **Activity:** observed timestamp and last tool/message state. A log is not a
  process heartbeat. “Quiet” after 15 minutes means inspect the session, not
  that it is dead or stuck. Completed turns remain idle, even with a live PID.
- **Progress:** only the task's explicit `progress:` timestamp. Not tool calls.
- **Context estimate:** last reported request input, with its timestamp. Codex's
  reported model context limit is used when present; Claude's limit remains
  unknown. Input is not exact live occupancy. A compaction clears the estimate
  until a newer usage record arrives.
- **Tokens:** last-request input/output and, for Codex when reported, session
  total. Claude session totals remain unknown; summing sampled or repeated
  streaming records would miscount them.
- **Cache reuse:** cache-read tokens divided by total last-request input. Claude
  input includes uncached input + cache read + cache creation; Codex input
  already includes cached input. Cache writes are shown separately. Absent
  counters remain unknown, not zero.

Provider references: [OpenAI App Server](https://learn.chatgpt.com/docs/app-server)
documents lifecycle and usage events;
[Claude Code usage](https://code.claude.com/docs/en/costs) explains cache reads
and writes. This v1 observes local files rather than attaching to either runtime.

## Validation

```sh
node --test ops/ops.test.js
node ops/browser-test.js
```

The first command covers real file ingestion, provider differences, freshness,
partial records, HTTP boundaries, and artifact traversal. The second uses the
repository's existing Puppeteer installation for a small dashboard-only browser
test with synthetic sources; it never launches an emulator or reads your real
session logs. `CHROME` can point to a Chrome executable.

## Corpus assessments, source groups and FPS

EXE corpus groups candidates by an editorial genre/application category, with
category counts and a category filter that combines with search, source group
and evidence/status filters. Work and failure priority is retained within each
category. `ops/corpus-categories.js` assigns exact candidate identities from the
local manifest and registry; installer entries use the target title's category. New unmapped
identities are explicitly **Unclassified**. Categories do not establish gameplay,
compatibility or permission to distribute assets.

The corpus includes registry-only entries from `lib/apps.js`, including WEP and
community games. Exact app IDs and executable paths deduplicate them against the
manifest using `ops/corpus-inventory.js`, shared with the gameplay coverage audit.
Unknown registry entries stay visible for classification. Registered executable
presence is reported separately from the original candidate fixture; neither
proves companion assets or a playable route. Registry-only rows use the
**Registry only** source group and retain their stable app ID for run association.

`ops/corpus-status.json` contains a dated evidence assessment and next step for each
candidate; `ops/corpus-status.md` is the readable audit. The dashboard separates
this assessment from an individual run outcome and flags a newer run for review.
Source groups and package/distribution notes are independent of compatibility.
The manifest and registry are combined for display, including WEP and community
collections. Do not treat a demo label as permission to publish its assets.

To publish a recorded presentation-event rate, add `performance` to the existing run's `result.json`:

```json
{"performance":{"metric":"guest-presents","measuredAt":"2026-10-02T00:00:00Z","renderer":"D3D / WebGL","scene":"Race cockpit","host":"Machine / CPU","gpu":"Actual renderer string","wasmSha256":"exact module hash","historical":false,"samples":[{"frames":600,"durationMs":10000,"p95FrameMs":21.4}],"notes":"Route and measurement conditions"}}
```

Capture counted guest presents/flips over wall time in a reviewed gameplay scene.
Keep raw measurement output in the run's artifacts. Record hardware GPU versus
SwiftShader explicitly. The event rate is total counted events / total sampled wall
seconds; p95 is shown per sample, never averaged across samples. A zero rate is
valid; missing measurements are unknown. Legacy `guest-presents` records without
a qualified frame discriminator display **guest presentation events/s** and
**p95 presentation interval**, preserving their numbers without certifying FPS.
CLI batch counts, CPU-window seconds and browser rAF are not gameplay FPS.
Historical measurements remain labelled with renderer and age.
Current archived measurements cover NFS3 and GTA2 under SwiftShader only; fresh
hardware baselines are queued as `OPS-GAME-FPS-BASELINE` and `NFS3-RENDERER-BENCH`.

For an identified raw guest Flip collector, set optional
`performance.counterKind: "guest-flip-events"`. The coarse metric remains
`guest-presents`; existing `frames`, `fps` and `p95FrameMs` fields retain their
numbers but represent event counts, events/second and successive Flip intervals.
Cards and sample columns then say **guest Flip events/s** and **p95 Flip interval**.
This discriminator does not certify unique logical frames or displayed FPS.

Source-qualified game-specific render submissions use both `metric` and
`counterKind` set to `guest-logical-frame-submissions`, with the same counted
`frames`/`durationMs` samples. The reader requires `qualification.accepted: true`
and nonempty `sceneReview`, `counterReview`, and `evidence` fields in that object.
These identify the reviewers and the linked run receipt; they are documentary
assertions, not automatic revalidation of the raw counter. Cards label this
**logical gameplay frames/s**. Preserve raw observations, pinned binaries,
temporal scene captures, counter proof, and instrumentation conditions in the
run. Physical displayed FPS remains unknown; leave unavailable p95 values null.
Unknown explicit counter kinds are rejected; omission preserves existing labels.
The archived NFS3/GTA2 collectors count originating `dx_trace` kind6, not public
frame callbacks; surface IDs and same-context arm/stop calibration were absent.
Their reported p95 uses sorted intervals at zero-based `floor(count*0.95)`;
preserve that convention and each sample rather than averaging/recomputing it.
See `ops/handoffs/ops-historical-fps-semantics.md` for exact collector evidence.

Candidate details add **Before / after** when more than one measurement is
recorded: the newest measurement is compared with each earlier one only when
metric, counter, scene, renderer, host and GPU are identical and both runs
recorded `wasmSha256`; the delta is shown with the metric label and whether the
builds differ. Every other earlier measurement is listed as not comparable with
the fields that differ. One measurement says "only one measurement recorded".

## Reviewed historical screenshot recovery

`node ops/recover-visuals.js` imports the explicitly reviewed associations in
`ops/historical-visuals.json`. Each entry pins the image SHA-256, original path,
timestamp basis, source test/log and a description of what is actually visible.
Source files and quarantined bundles stay intact. Missing source files are
reported; changed bytes are rejected. Imports remain historical and unreviewed
as compatibility results, even when their visual association has been reviewed.
This complements the conservative automatic backfill; it does not loosen its
matching rules or turn image filenames into pass/fail results.

Corpus displays linked screenshot coverage and filters for present/missing
captures. Recorded evidence precedes unrecorded candidates after active work and
failures. Queue previews show short summaries; full criteria remain in Details.
Activity initially shows 25 matching entries, with controls to show more or all.
The source filter combines with search and survives refreshes. Commits include
subject, author, timestamp, short hash and a GitHub link when the configured
origin is recognized; local visibility does not certify remote publication.
Git reads are bounded and cached for 30 seconds, without fetching. Dated items
sort newest first; undated board messages keep their order after dated items.
Each commit shows where it is, from local refs only (no fetch, no GitHub call):
**merged** (reachable from `origin/HEAD`, normally `origin/main`, via `rev-list`
with an exact `merge-base --is-ancestor` fallback), **pushed** (on another remote
branch, named) or **local only**; **tested** when a run's `build.commit` is this
commit (count, passed, reviewed); **deployed: not recorded**, because the
production snapshot records deployed files, not a commit. The Activity header
gives the last fetch time. Task IDs named in a commit message link to the task;
task rows summarise `Code: N commits · merged/pushed/local` and task details list
them. Narrow portrait and short landscape screens use compact navigation.

## Live command approvals

Registered tmux panes are inspected on each dashboard refresh. A recognized
Codex command approval appears above every view, with a tab-title notification,
reason, terminal, and time first observed (not an inferred timeout). Review opens
the full command and original prompt. Approve once sends the native `y` shortcut;
Decline sends Escape. No persistent command rule is offered. Decisions are never
sent automatically, and posting a messageboard reply is not approval.

The server checks the loopback origin, registered pane and PID, a recent
observation, and an unchanged screen immediately before sending a decision.
Decisions cannot be replayed; active browser terminal control prevents submission.
Only the recognized command-menu layout is supported. Other prompts require
inspection through the web terminal. Automated review rejections are reported
blockers, not user-approvable commands.

This is a narrow screen adapter, not the structured
[Codex app-server approval protocol](https://learn.chatgpt.com/docs/app-server).
Terminal output can imitate UI text, and native keyboard input or process output
can race a screen check. Review the original terminal if anything is unexpected;
do not use this bridge to approve commands from untrusted terminal sessions.
“Decision sent” confirms delivery only, not execution or success. Monitor failures
are displayed explicitly. Pending observations live in memory, not a database,
and disappear when the dashboard server restarts.

For private orchestrator chat and approval buttons, see [Telegram setup and watchdog](TELEGRAM.md).

### Work continuation watchdog

`node ops/work-watchdog.js` checks both registered coordinators every 30 seconds.
It only considers active/ready/review tasks owned by that exact agent, without
blockers or unfinished dependencies. A session must report idle and its empty
terminal prompt must remain unchanged for two minutes. Approval menus, drafts,
running turns, changed PIDs, browser control, and visible stop/pause requests
prevent delivery. The server rechecks the terminal fingerprint before entering
an ordinary `[Work watchdog]` message; it never sends approval keys or slash commands.

Policy lives in `ops/work-watchdog.json`. Local overrides belong in
`scratch/work-watchdog/control.json`: use `{"paused":true}` to pause all wakeups,
or `{"pausedTerminals":["claude-launch-ux"]}` to pause one coordinator. Agents
must record intentional user pauses here as well as in their task state.
Heroes II timing/music tasks are excluded while the laptop owns that work.

Nudges have a 15-minute cooldown. Two nudges without a change in the owned task
records produce a stalled status requiring inspection. This is a safety net for
idle turns, not a replacement for native Goals/loops or a hung-process killer.
It does not restart agents, clear drafts, resolve blockers, approve commands, or
deploy releases. Task/ownership changes reset the attempt budget.

State and append-only events are plain JSON/JSONL in `scratch/work-watchdog/`;
`GET /api/work-watchdog` exposes status. Install the system service from
`ops/hosting/wine-work-watchdog.service` on the box. It survives disconnects and
reboots independently of Telegram, which remains responsible for message delivery.

### Game release readiness

EXE corpus has independent release filters: **Unreleased games**, **Ready for
release**, and **Unreleased · gameplay reviewed**. The last includes games with
remaining blockers. Candidate details show gameplay, input, correctness,
performance, distribution and package gates, their evidence, and the next step.
This view does not publish games.

`ops/release-readiness.json` records the dated public desktop snapshot and explicit
per-game reviews. Production membership comes from the archived deployed
`DESKTOP_APPS`, with source and index hashes verified on read; local registry
membership is separate. Missing or invalid provenance leaves membership unknown.
Refresh the archived public index/apps and snapshot together after a deployment.

Ready requires an explicit review tied to a reviewed gameplay run, current
runtime source hashes, all required gates passed, and no associated open blocker.
Only the performance gate can be marked not-required, with a documented reason.
New failed gameplay or source changes invalidate readiness. A short instrumented
logical-frame sample remains distinct from release performance qualification.
To review another game, add a record following the existing records and retain
exact evidence paths and package-specific limitations.

**Ready for desktop** (`#release`) lists one row per game whose verified
production membership is `no`: the reviewed gameplay screenshot, the gameplay
run's recorded build (`rev · dirty · wasm`, each "not recorded" when absent),
the recorded rate with its own metric label and review state (or "Rate unknown"),
the input gate, sound ("not recorded": no gate or run field holds audio
evidence yet), every unmet gate with its status and summary, recorded blockers,
and why a recorded review is not current (`staleReasons` from
`release-readiness.js`). Rows sort ready first, then reviewed gameplay, then
fewest blockers and unmet gates. Logic lives in `release-model.js`, shared by the
page and `release-model.test.js`. Games with unknown membership are counted, not
listed.

Above the list: **Playable unreleased** (reviewed gameplay screenshot and a launch
route available now), **Review needed** (status review-needed) and **Ready**
counts, each a filter; and, separately, a notice naming the recorded release
reviews that are stale and why. Sound and deploy evidence are shown as not
recorded; they are not gates and add no approval requirement.

Launch links carry `&build=<wasm sha256>` of the module the emulator route
serves (`emulatorBuild` in `/api/state`: `rev · dirty (N tracked files) · wasm`,
read from the live tree and cached 30 s). If `build/wine-assembly.wasm` changes
before the click, `/emulator/` answers 409 naming both hashes instead of running
another build; an unavailable app answers 409 listing its missing files. The
Ready view compares the served module with the reviewed gameplay run's recorded
wasm (match / differs / unknown); commits are not compared, only module hashes.

### Launch from EXE corpus

Use **Launchable now** above the corpus list to show entries with an available
local route. Each registered route with its declared files present has a **Launch in emulator**
link on the corpus card and in its details. It opens `/emulator/?app=ID` in a new
tab using this box's runtime and files. Missing routes show the missing paths;
availability is separate from gameplay verification. **Open production** points
to the public site only for an app in the verified production desktop snapshot.

The private emulator uses the dashboard's existing authentication gateway. Its
GET/HEAD handler serves only runtime resources and registered asset closures,
including file manifests, shared DLLs and CUE dependencies. It supports byte ranges
and cross-origin isolation for Workers. The private entry enables local candidates
without changing the production desktop source. Arbitrary repository files,
private configuration and other symlink targets are not served. The route catalog
refreshes after 30 seconds; backend code changes require the scoped dashboard
service restart described in the dashboard handoff.

## Telegram blocker parity

`/blockers` reads the same `/api/state` snapshot as the dashboard and uses the shared `blocker-model.js` for primary blockers, dependent tasks, ordering and live approvals. It lists the next action, reason, owner and dependent titles without changing tasks or answering approvals. `/approvals` remains the command for reviewing an orchestrator approval. The bot menu and `/help` are generated from one command catalog in `telegram-core.js`.

### Daily agent analytics

`#analytics` reads `GET /api/analytics`: daily UTC tokens (fresh input, cache read/write,
output), API-equivalent cost estimates, observed time distribution and attributable
Git commits, per Codex/Claude session. Children have their own rows. Dollar amounts
are **not subscription charges or invoices**. Rates and source links live in
`ops/analytics-rates.json`; unknown models stay unpriced.

Accounting reads full logs for the same project sessions discovered by the dashboard
(up to 100 recent logs per provider), and shows 14 UTC days. Incremental offsets,
deduplication state and daily aggregates are readable JSON in `scratch/analytics/`.
Delete that directory to rebuild it; no database or external telemetry is required.
Changes to rates take effect after restarting Ops and rebuilding the cache.

Time is inferred from event boundaries: model response, pending tools, test/benchmark
commands, idle between observed turns, and unknown. Silent model gaps over five
minutes and tool gaps over thirty minutes become unknown. No time is extrapolated
after the last event. Concurrent sessions overlap; these are not CPU hours. Commit
attribution requires a git-commit tool result plus a matching local Git hash. Missing
or ambiguous attribution remains visible in the project total.
