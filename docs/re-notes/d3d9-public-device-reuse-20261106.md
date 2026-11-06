# Public D3D9 same-identity device recreation

PASS on both shipped modules, 2026-11-06 19:12:39–19:12:57 UTC. This closes
the explicit device-incarnation gap in
[the accepted public Reset run](d3d9-public-reset-recovery-20261106.md).
That run's old-identity rejection remains accepted as a separate result.
No emulator mismatch was reproduced; only the generated regression changed.
This covers renderer lifecycle recovery, not gameplay or whole-corpus crash
freedom. No original guest program was analyzed or changed.

Static review established that normal public allocation can reuse an address.
In `src/09a8-handlers-directx.wat`, `dx_alloc_locked` first scans for free,
never-used slots. Once all 16,384 slots have wrappers, it scans freed slots
from a rotating cursor. `dx_create_com_obj` maps each slot to its fixed
wrapper address; `dx_free` clears the type while retaining that wrapper.
Final public device Release reaches this free path. Host
`deviceGenerations` survives `devices.delete` and increments on a new entry
at the same identity. Two creations do not exercise the recycling tier.

The generated PE creates/releases an ordinary padding `IDirect3D9` immediately
before the first device's surface/device allocations. After the failed device
is retired through its public Release, a loop creates/releases ordinary
`IDirect3D9` parents until a returned address equals the padding address.
The loop is capped at 16,384 pairs, with one filler parent alive at a time and
no filler render endpoints. It checks ESP and EBX/ESI/EDI/EBP for every new
Create9 call and public COM Release. It does not read or alter allocator
cursors, slot records, wrappers, receiver maps, or the guest's device identity.
The next ordinary CreateDevice allocates its surface then device normally.
The test requires actual identity equality; failure cannot fall back to the
old-identity result.

Both modules needed 16,341 pairs. Public device address **136454168** was
retired at generation **1** and recreated at generation **2**, with a fresh
host entry and endpoint on the surviving physical render Worker. The original
producer retained its exact error and generation. Native public GetBackBuffer,
GetDesc and LockRect readbacks proved a fresh purple asymmetric triangle and
the unchanged blue peer before the transport control. Across eight frames per
module, 576 independent safe-pixel comparisons passed, plus full-frame peer
equality. All 16 retained readbacks were personally inspected.

The separately labeled stale-generation transport control followed a completed
current-generation FENCE: device 136454168, generation 2, submitted/consumed/
completed sequence **6**, no error or inflight work. Its malformed descriptor
used the **same current identity**, **old generation 1**, and **next sequence
7**. The owning receiver rejected it with `stale or unordered render worker
command`. Its sequence was valid, so ordering alone cannot explain rejection.
The producer independently rejected the old generation without changing its
current queue. Public retirement and a fresh green peer redraw then passed;
the same physical Worker survived. No producer error was cleared, receiver map
overwritten, pointer rewritten, private release substituted, or arbitrary
Worker terminated.

Reproduce: `node test/test-d3d9-public-reset-web.js`, optionally setting
`D3D9_RESET_EVIDENCE` to retain readbacks and browser evidence. The fixture
retains its ordinary PE/COM preflight and independent scalar pixel oracle.
Validation passed: locked full `tools/build.sh`; PE/ABI preflight (505 COM call
sites); public browser regression; `test-d3d9-reset-presentation.js`;
`test-d3d9-worker-reset-recovery.js` (both modules, shared and legacy);
`test-d3d9-worker-survives-draw-failure.js`; and
`test-d3d9-shared-render-worker.js`.

Evidence: `scratch/runs/20261106-d3d9-public-device-reuse/`.
`tested-source.json` records Git **56e1c2683314638f4438cdacf1abdb69ba32ed0b**,
the relevant binary diff and source hashes. Shipped and actually loaded module
SHA-256 values match: standard
`2fa9f377dde5e477eb811baceb64032889fbe9b27a664b213477e84627e5eb94`, compat
`3dd82e987c0683b45f28860748b6a19151b6623f578f10d70d201b798baf2a6a`.
Actual served bridge/receiver/executor hashes also match reviewed source.
`browser/result.json` retains native readbacks, fences and refusal diagnostics;
`capture-review.json` records image inspection. One run-local gate path-labeling
setup error was corrected and retained before tests or production edits.
The coordinator granted 19:11:09–19:56:09 UTC including cleanup; independent
predecessor checks passed before execution. Final cleanup and publication are
recorded in the run; no boxes, original-program runs, archives or deployment
were used.
