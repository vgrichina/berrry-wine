# Independent Ricochet final writer acceptance: REJECT

Candidate `93fce294621b5f40a1a23f6711c555dc5159e554` is rejected unchanged.
This orphan branch contains a report only. Never merge its whole tree.

The first behavioral gate ran the exact pinned production-commands.py CLI using
runpy as __main__. Only its outer subprocess launch was intercepted. All four
actual dispatched argv matched the supplied transformed producer receipts;
their exact writer prefixes ran in owned fixtures. Payloads, timeouts, polling
and no-replay tails remained unchanged. The late exists()/symlink race rejected
without changing retained content. Each original writer changed retained
content under the same race, so these controls discriminate.

The new strict counterexample mutates continue.json in place immediately before
its second read-open, inside the final enumeration validation. The initial
version has size2, the final opened version has size33, and the inode is the same.
The candidate returns an accepted inventory and lastBytes=25174016 rather than
rejecting. This happens before sample() returns, not after return.

Cause: _walk compares the final stat version to control_versions, then calls
_file. _file checks inode identity but does not compare the reopened control's
version with control_versions, nor compare all control observations for version
consistency. The hook changes only an owned fixture file; production code and
all assertions are unmodified. It reproduces an interleaving inside validation,
without implying that any bounded observation is a filesystem quota.

Exact accounting SHA256:
580a0fa000c2784f3bbfdb91ad100a6c91c1b1a558729b27756727d183f558de

`evidence/final-reopen-mutation.py` is the strict reproducer. Recreate an owned
TASK/{ops,repo/tools/ricochet}, copy that script to ops and the exact source from
inputs/tools/ricochet/runtime-accounting.py to repo/tools/ricochet. Set
RICOCHET_ACCEPT_OPS=TASK/ops and TMPDIR=TASK/ops/fixtures before running Python
-B -S under the documented pool and trusted supervisor controls. Expected
current-candidate exit1 and AssertionError are the rejection, with exact causal
stdout, stderr, command and limit receipts retained here. No API command runs.

The earlier rejection a679a43e16ca71a761a2368a41784c4371c4a3b1 remains valid
historical evidence. Its unchanged strict link/publisher assertions are retained
in inputs/test; candidate checkpoint retains the original failures and incident.
This worker never imports a predecessor harness with default ops paths.

After the counterexample, remaining acceptance groups and executable integrate.py
closure staging were stopped. The original candidate successful receipts are
referenced and source-pinned, not rerun for packaging or promoted to independent
acceptance. The full24MiB reserve remains inside the unchanged256MiB runtime cap.
Repair and a fresh bounded acceptance are coordinator decisions. Main integration,
authorized runtime/startup/input/gameplay and ordinary Quit remain closed gates.
No candidate fix, main integration, public deployment, API, guest, Boat or Node
operation occurred. No box is assigned; coordinator retains lifecycle ownership.

See checkpoint.json for pins, limits, incidents, scope and reusable receipt IDs;
manifest.json binds every retained payload. Initial display overflow and the
implementer's prior overwritten diagnostics incident are retained truthfully.
