# Hexen II observation context and strict input closure

Run: `scratch/runs/20261120-hexen2-observation-context-difficulty-level/`.

`quake2-native-consumption-input.cjs`, used by Hex's explicit manual-context
path, now uses the released bridge's `snapshot.readiness.observationReady`
only for `context()`. The bridge alone supplies the exact predicates. Older
bridges without that diagnostic still require `ready`. All private reference,
import, document, viewport, authoritative capture, owner, scene and slot checks
remain. Observe, prepare, equivalent preparation and status still require
strict input readiness. No timestamp renewal or duplicated identity predicate.

Focused controls: Hex 42, Quake authoritative capture 44, including expired
observation versus input, old-bridge fallback, retired/replaced owners and
zero queued application. The existing registered test suite runs its strict
fallback assertion when the optional released diagnostics are absent. Full
`flock /tmp/wine-build.lock bash tools/build.sh` passed. The shared diagnostic
implementation is a separate author's working-tree change and was read only.

Actual registered `hexen2_demo` used the pinned d3c95bc2 module, 305 imports,
18 existing media references and private whole 800x600 capture. CPU and render
module bytecodes were independently read back once each. Previous native300
and independent UP/early transport proof were referenced, without calibration.
PREBIND passed unchanged; this does not establish a cause or fix for the older
timeout. One deliberate Enter300 returned native USER token 1 and independent
UP. The settled Single Player menu with New Game selected was personally
reviewed. A subsequent context read passed with only `fresh=false`, age635ms,
all fourteen structural predicates true, before its ordinary native observation
advanced. This is actual original old-rejection/new-acceptance evidence for
nonadmitting context, not authority to send input.

At 2026-11-20T14:14:52.396Z, the next action's strict `prepareEquivalent`
check refused `authoritative owner no longer ready`. The failing prepare read
did not retain its exact predicates: the specific cause remains UNKNOWN.
The second DOWN was never published; its independent participant reported
`cancelNoDown=true`. Scope permanently closed, zero later endpoint requests.
A later operator capture attempt was refused locally before creating a command.
No restart or replay. Class, difficulty, level, movement, enemy and native Quit
were not achieved in this run. Historical Paladin credit belongs to the prior run.

Runtime, release, host-UP, browser and display joins completed with EOF receipts;
finite supervisor reported no leaks and tracked processes were checked offline.
Profile/tmpfs were removed after unique evidence retrieval. Box ID null,
NOT_CREATED, expiry null, stop receipt null; actual owned cleanup delegated and
completed. Git/diff/owned patches and media references recover source and inputs;
there are no source-tree snapshots or game-media copies.
