# TR2 clear ordering: complete source handoff — 2026-11-08

Completed a substantive generic production repair, locally tested with the
actual dispatcher, native WAT swap/page watches, observed export facade,
RGB565 decoder and canonical compositor. The regression reproduces both clear
invalidation and a newer completion on the same descriptor while the actual
upload still owes serial 445. It displays **red / serial 445**, preserving that
owed identity, then an actual next upload displays **blue / serial 446**.
This is not a new original-game validation or a gameplay/FPS claim.

Evidence: `scratch/runs/20261108-tr2-clear-order-repair/`. The exact Git
baseline `efae2c6d3` fails the same integration's qualification assertion
(**0 instead of 1**), after logging both ordering conditions. Baseline modules
are loaded directly from Git into memory; no checkout copy or worktree exists.

## Repair and authority

`host.js` gives the production observation journal four bounded complete-source
slots, each holding up to 2 MiB of RGB565 pixels, plus control words. The
production render owner copies a complete source after its actual completed
flip. Its original seal still requires sole stable unpoisoned writer coverage,
unchanged host version and native page proofs. A new check also verifies the
native pages across the copy. Only then does it atomically commit the retained
generation and publish the immutable journal record containing its exact
request, owner, layout and generation.

Each slot is reserved before reuse. Readers acquire its generation, copy to
private reader storage, and verify the generation again. Decoding and
composition also require the retained generation to remain committed. An
expired, incomplete or rejected source cannot authorize publication. Storage
is bounded at 8,388,672 bytes per armed observation; other formats, oversized
sources and disarmed execution keep their existing paths.

The native complete-layer decoder alone can request the retained source. Its
selection still requires the actual upload's worker slot, surface slot/front,
descriptor, serial, endpoint, owner generation, observation generation and
matching supported layout. It decodes the private retained pixel copy, never
the newer live DIB under an old proof. The ordinary GDI decoder cannot opt into
this handoff. Original live-source host/page checks remain in place; the new
source has its own complete storage lifetime. No clear whitelist or writer
classification changed. Unsupported synchronous calls still poison/retire
observation. Live writers, poison, wrong window memory, altered layer tokens,
unsupported scenes and retired owners still prevent qualification.

## Integration and tests

The same native/nonempty-client-rectangle fixture runs the production
`legacy-call / 0x20004` dispatch and production software adapter, verifies the
host invalidation, completes serial 446 without uploading it, and changes the
old source through a real observed native page-watched write. The actual owed
upload remains serial 445. The repair publishes its retained red pixels, not
the live blue/green alternatives. A later real upload of 446 publishes its
own blue pixels. Both records qualify exactly once: **raw 2, qualified 2**.
The same result passes with odd pitch through the decoder's byte-load path;
both its word-load and byte-load paths consume the retained source.
This local fixture establishes transport ordering and complete-source decode;
it does not claim native WebGL clear rasterization or an original game run.

Sixteen new negatives reject expired storage, reserved storage, poison,
wrong worker/serial/descriptor/window owner, unsupported synchronous calls,
live writers, menus, missing tokens, changed layer ownership, and overlap,
page changes, host changes or poison during the production source-copy seal.
The four capture failures leave the retained generation uncommitted.

The complete DirectX layer suite passes, including the existing 29 native
metadata/compositor negatives, original live-source host/page/old-request
negatives, canonical scene/provenance checks, nonempty client rectangles and
the accepted two-independent-writer hold/retry fixture. Affected integration
paths were rerun; retained native controls and media were hash-verified and
reused without another original launch.

Also passed: clear observation and unsupported-call/adapter-failure controls;
source lifetime; transient writer and scene; producer/publication identity
including the actual standalone Worker pre-notification pause; host rAF and
Worker presentation; process retirement; and actual Manager queue admission
with the new bounded shared storage plus malformed-storage refusals.
`flock /tmp/wine-build.lock bash tools/build.sh` passed. The compiled native
module remains the accepted
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.

Retained development failures include the initial absent software adapter,
the fixture incorrectly marking both buffers as primary, the first baseline
module resolver, and initial assertions from older repairs. Two older
producer-identity assertions expected ordinary repaint during an active writer;
they now assert no publication until drain, then correct 90/68 red pixels and
continued refusal of the changed source. The older menu-only baseline is now
correctly expected to pass because the already accepted composition-entry
admission covers its scratch writes. Its branch/exclusion/poison tests and
the actual full-admission baseline failure remain. No guard was relaxed to
make these expectations pass.

## Exact native successor recipe

This assignment is LOCAL. No original allocation, box creation/resume/delete,
native inputs, remote provisioning or deployment occurred. Box ID/state/expiry
and stop receipt are **not applicable**. Local runtime locking covered local
focused execution only and was released afterwards. Full27, parity, audio and
FPS remain open.

1. Recover `successor-runtime-pins.json` and verify it with
   `python3 scratch/runs/20261108-tr2-clear-order-repair/successor-preflight.py REPAIR_COMMIT`.
   The evidence pins the exact published repair commit after commit/push.
   It retains the previous 612-file closure and changes only published
   `host.js`, `lib/host-imports.js`, `lib/render-worker.js` and
   `lib/d3d-render-worker.js`. Keep the accepted renderer, WAT, module, media
   paths/hashes and helper bytes. Verify all 226 accepted control references,
   all 23 media references and JS/CJS/Python syntax before allocation. This
   preflight already passed locally. Exclude peer WIP and source archives.
2. For a separately assigned native successor, bind new small lifecycle/helper
   inputs to a fresh owned run and UUID; inherited run paths are recovery
   references, never live command queues. Revalidate their closure before the
   single permitted create attempt. Prearm an observable independent 25-minute
   watchdog and immutable overall/cleanup deadlines, require launch disk
   >=5 GB, and hold the successor's remote lock before provisioning through
   runtime/drain. Hold no local runtime lock during remote supervision.
3. Use the unchanged original route
   `index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl`.
   Verify actual parsed host/renderer/import/worker hashes and both actual
   native module hashes, then the owning WebGL2 identity. Use current reviewed
   native menu/input evidence with independent releases. Preserve sticky
   UNKNOWN and do not replay inherited input/capture failures.
4. Arm the ordinary bounded production publication observation. No private
   handlers, guest writes, forced scenes, configuration/clock/seed changes or
   alternate identity adoption are part of this recipe. Require an actual
   qualified row whose `canonicalRead.retainedSource` is committed and whose
   request equals the actual owed upload. Require correct visible pixels and
   continued ordinary display before separately reviewed movement/weapon
   work. Account for ring expiry rather than borrowing the latest request.
5. Retrieve unique artifacts and independently hash them before delegated
   normal shutdown. Verify all owned parents, descendants, custody/adopted
   children, endpoints, ports, profiles, writers and held inputs drained;
   retain failed attempts. Stop promptly and report final ID/state/expiry and
   normal stop receipt. No undocumented descendant exception is authorized.

Recovery uses exact Git SHAs and `relevant.diff` for owned changes, a small
patch for the new preflight helper, and existing media references. Evidence
contains no source-tree or media archive.
