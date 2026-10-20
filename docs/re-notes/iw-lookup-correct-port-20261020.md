# FindWindow corrected selective port — 2026-10-20

Base: remotely verified origin/main a54049d11955307d06309e146e85c1aca3196657.
Task branch: task/iw-lookup-correct-port-oct20. No main integration.
Review input: 9ba5f550ae36828644070996b4c053a9e1dc7770 and its 102-check report/helper.

## Change

Selectively port the desktop query from 9ef79f697 and the WAT/import/signature
connection from 692c9c43c. No historical ancestry or entire production files
are replaced. c27e6776b contributes the separate-memory/destruction test
objective; its full render/worker regression is not imported or claimed run.
Four production paths change: lib/host-window.js,
lib/host-import-sigs.generated.json, src/01-header.wat,
src/09a-handlers1-user.wat.

A desktop query result of zero now returns zero immediately. Only -1 (desktop
unavailable) permits the local-table fallback. A destroyed desktop record can
therefore no longer be rediscovered from a disagreeing local row after a
successful desktop search. Registered class atoms resolve through the caller's
class name; built-in atoms retain stable names. Class and title encoding bits
remain independent for W calls with ANSI registered class names.

Unresolvable class atoms still take the existing local matcher path: no
successful desktop query occurred in that case. This preserves the existing
local table contract; it does not establish a foreign class identity.
A present empty desktop is authoritative even for synthetic local-only
records. The existing test/test-find-window.js installs only local rows, so its
fixture now explicitly disconnects its host renderer to test the real -1
fallback. Its full render harness was not run under this source-only admission.

Host ownership, SendMessage, and destruction implementation are byte-preserved;
the helper checks the entire host file minus the added lookup and the entire
USER fragment minus the modified core against admitted main. No aliases,
launch redesign, laptop game changes, or unrelated dependency commits.

## Reproduction and evidence

From this sparse checkout or an object-complete checkout containing the retained
commits and admitted main:

```sh
node docs/re-notes/iw-lookup-correct-port-20261020.js . /absolute/path/tests.json
```

The helper reads unmaterialized dependencies from exact Git blobs.

173 recorded checks PASS; this count includes source assertions, expected
rejections, and gate results, not 173 full-VM cases. Actual compiled handlers,
core, matching and Z-order functions exercise A/W/ExA local and foreign class,
title, combined filters, registered and built-in atoms, direct child versus
descendant selection, after traversal and invalid after, no match, stack cleanup,
empty desktop, no desktop, and destruction. Separate WebAssembly memories share
the actual host query's renderer dictionary. The actual host destruction method
removes records; A/W/ExA tests deliberately retain stale local rows and verify
that authoritative zero suppresses them.

Nine expected rejection checks include missing foreign lookup on main, the
retained stale defect, disabled matching/after/class/title filters, and restoring
the retained zero-fallback to the corrected core. Restoring that fallback
reproduces the retained compiled hash exactly. The complete updated
test/test-host-window-related.js runs with actual CommonJS dependencies loaded
from Git in memory (no replacement host stubs). The unchanged import generator's
--check passes for all 290 imports; unchanged fragment checks pass for both
modified WAT files. JavaScript syntax and git diff --check are publication checks.

Corrected extracted closure: 982 bytes, SHA-256
08e782dbaef029200602258f18b169a13d87fbdafa3780bd7ee4379ce4b30509.
Main control: 841 bytes, 3f612ee20fa82c74c6c40d154c006c87851a40effacd8d5687f3101c70634199.
Retained control: 988 bytes, 01b70374eb25a4ea888e979dc451d00a63faf2535723b03e8c947ea78bf96d23.

Harness development encountered a trailing-newline comparison mismatch and a
CommonJS wrapper shebang parse error; both were helper issues corrected before
the final passing run. No production code was weakened to pass tests.

## Limits and next review

These are actual extracted source/compiled-slice tests with controlled class,
window-table, address translation, and string-helper imports. They do not
qualify the full guest class registration/encoding implementation, full
CreateWindow/DestroyWindow callback chain, reentrant destruction reachability,
Unicode beyond controlled comparisons, a complete build, browser runtime,
real Worker RPC, CLI cross-process IPC, launcher handoff, or gameplay. The
existing full render fixture adjustment has syntax/source review only, pending
a permitted full-VM run. No FindWindowExW handler is added or claimed tested.

Independent review should assess the authoritative-desktop compatibility
boundary, atom resolution and real creation/destruction publication, then
serialize integration with other isolated source changes. Later permitted
runtime work must verify current-build Worker RPC and original launcher/game
handoff. Runtime resume403 remains binding; no runtime retry, full build,
Boat/SSH commands, benchmarks, Claude, deployment, or workers were used.

Evidence: scratch/runs/20261020-iw-lookup-correct-port-oct20 contains preflight,
tests.json, receipt, change.patch, remote-ref evidence, and SHA256SUMS.json.
Exact eight sparse paths were configured before checkout; object alternates
are read-only dependencies. Shared HEAD/index/config seals are rechecked
before publication. Allocation cap is 8 MiB; gates conservatively reserve the
entire 8 MiB at every write (required 2,277,507,072 bytes = floor 2,210,398,208 +
reserve 33,554,432 + concurrent caps 25,165,824 + 8,388,608). Receipt records
measured allocation and remote identity. Ignored evidence is not a Git backup;
the committed helper and report are its recovery recipe.
