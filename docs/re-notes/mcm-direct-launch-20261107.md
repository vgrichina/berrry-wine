# MCM direct browser launch — 2026-11-07

The production direct route is qualified and reaches the original **Enter Name**
screen. Race movement and steering remain untested. The first terminal blocker
was a run-specific input-harness mistake: `Rider` was passed to a helper accepting
only `/^[A-Z]{1,12}$/`. It threw `bounded uppercase name` at
02:19:16.356 UTC before emitting any character events. The worker should have
checked this helper contract before the original. No emulator defect is shown.

Evidence: `scratch/runs/20261107-mcm-direct-launch/`.

Before allocating, seven generated/mock DOM controls executed the **actual
production direct-launch IIFE extracted from index.html**, with its exact source
and index hash retained in `readiness-controls.json`. They cover filtered-out
`mcm` and `dx_boids`, delayed registry restoration and DOMContentLoaded, wrong
ID, cancellation during restoration, a present option, sign-in resume, and the
explicit `shell.launchApp(wanted, {directIntent, startedAt:0})` arguments.
The filtered dropdown remains Notepad when launching an absent option. No public
catalog, selector option, production source, guest media or config was changed.

On fresh boat `bx_rfkb8473`, the real URL
`/index.html?debug&threads&d3d-renderer=webgl&app=dx_boids` launched the generated
DirectX sample in a guest Worker. Its actual renderer Worker
`EE716A5533D4ED10C77A40312D7DEF25`, session
`045BE26B2B7CF8A4A0123F55AA42BEEF`, owned legacy/WebGL endpoint 1.
Completed fences advanced **44 → 59**, with control error 0, adapter present,
no endpoint failure and guest fallback count 0. The reported renderer was
ANGLE / Mesa Intel UHD Graphics 620 (KBL GT2), WebGL 2.0. The startup capture
was personally reviewed; it shows the sample boundary lines, not a game race.

Native Surface4/7 guest COM/vtable-tail checks passed on the boat, using a
prepared and then consumed retained `com-preflight.wasm` and identity manifest.
Balanced renderer/DirectInput keys, invalid-duration zero-event controls and
five trusted native Chrome keydown/up pairs passed. A separate generated PE
called real COMCTL32 PropertySheetA. Its ordinary property sheet and label were
personally reviewed; a balanced native click on OK dismissed it, also reviewed.
This fixture used a scratch `generated_property` registry entry and explicit
shell launch, without altering the dropdown or the original registry entry.
Both generated browsers exited normally before the original.

Exactly one original launched at 02:17:39.023 UTC through
`/index.html?debug&threads&d3d-renderer=webgl&app=mcm`. The initial video-memory
prompt was reviewed. Later captures lost that native prompt's pixels while its
log and modal focus remained; one ordinary balanced Enter accepted the default
OK and reached the fully rendered Enter Name menu. That transient paint
observation is not diagnosed as an emulator defect. No profile was created,
Single Player/track/rider/Start was not reached, and no original owning race
WebGL completions, throttle translation or steering is claimed.

One attempted name command was refused as stale **before dispatch, effects 0**.
The allowed refresh obtained a new capture. The subsequent mixed-case name
command then hit the uppercase helper assertion; the transport reported runtime
first fault with no successful ACK. The original closed immediately and was not
retried, renamed, resumed or replaced. The worker also mistakenly attempted to
retrieve nonexistent post-command captures after the refusal/fault; these
read-only retrieval failures are retained separately and caused no guest input.
The terminal name request is not presented as a successful zero-effect ACK.
A future fresh attempt needs pre-original coverage of the chosen name and its
validation before marking dispatch, then the remaining ordinary menu route.

Staging pins main `185f3eea3598b49dff3a6d54b366d95dcbfa8ff6`, relevant dirty
patches and the untracked wininit-boot source patch. All **936 staged pins**
matched remotely before execution and at cleanup. The existing standard module
actually captured from guest and renderer Workers is SHA-256
`f18229189ae8e50fe938baaa6f2fe2821ee60c297acf7116f5cfeb8529915eaa`
(2,181,162 bytes), equal to the pinned staged standard module. This identifies
executed bytes; it does not infer a fresh build provenance from staging HEAD.
Chrome was 151.0.7922.108, V8 15.1.206.16. No local runtime/source/build ran.

All **311 registered MCM inputs, 45,460,823 bytes**, match before/after.
Their URL hierarchy and installation-root VFS paths were preserved, including
working directory; no scene was duplicated at C root. MCM.EXE remains SHA-256
`f0370d1d526be46eaf6ea5f941f185a393a8432baec695e1529f8672a314a71b`.
Staging includes protected-writer-entries dependencies and actual app-local
URLs. Local HTTP pin checks passed; 1,499 complete remote HTTP 200 responses
were verified against current exact bytes, with no unmapped successful response.
Identified non-200 requests were build-info, auth-user, favicon, sample/MCM
icons and the optional font bundle endpoint; individual font loads succeeded.
HTTP availability does not establish race execution. Guest media, config and
save inputs were unchanged; no source/media archive or deployment was made.

All **137 remote artifacts** were retrieved or matched to identical local bytes,
with repeated modules deduplicated and mapped in `retrieval-verification.json`.
All three browser/controller pairs, six ports, three profiles and writer locks
were verified absent; Chrome exits were 0. Delegated normal stop
`stop_0d110e8508c0aacf` completed at **02:19:54.692 UTC**, forced false, error
null. The boat is archived, active expiry null. Allocation through retrieval
and completed stop took about **277 seconds**, within 35 minutes. Local disk
remained above 2.7 GB. No safety flag, held-risk retry, nested worker or second
original occurred. Next work is a new bounded original attempt after qualifying
the name-input contract; this run adds no gameplay claim.
