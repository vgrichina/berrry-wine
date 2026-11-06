# D3D9 GetBackBuffer selectors and resource ownership

Reproduced and repaired on both shipped modules on 2026-11-06. Ordinary
generated x86 PE calls through public device, swap-chain and surface COM
vtables demonstrated 34 unexpected successful invalid requests: 17 per
module. Every unexpected success returned the current implicit buffer's
identity and acquired a reference that made the following Reset fail with
D3DERR_INVALIDCALL. Public Release of that unexpected successful acquisition
restored Reset eligibility.

The device route ignored chain, buffer and type selectors. The swap-chain
route already rejected nonzero buffer indices but ignored type. The repair
validates the device selectors and swap-chain type before wrapper lookup or
AddRef. Successful calls retain the existing implicit-buffer lookup and
resource lifetime helpers. The production change is confined to
`src/09ad-handlers-d3d9.wat`; no resource helper, renderer or creation policy
changed. Existing valid-call guest memory accesses and unimplemented fail-fast
handlers retain their paths.

The public topology was established before applying validation:
GetNumberOfSwapChains returned one, GetSwapChain(0) succeeded, and
GetPresentParameters reported one actual back buffer for requested creation
counts 0, 1, 2 and 3. Both getter routes agreed on valid buffer-zero identity.
For those configurations, device buffer-one requests previously returned the
same buffer-zero identity while swap-chain buffer-one requests failed.
Multiple-buffer presentation remains unsupported; accepted larger creation
requests continue reporting one actual buffer. This repair introduces no new
creation rejection or additional-chain implementation.

The contract is documented by Microsoft's
[device GetBackBuffer](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-getbackbuffer),
[swap-chain GetBackBuffer](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3dswapchain9-getbackbuffer),
[back-buffer type](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dbackbuffer-type),
and [presentation parameters](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dpresent-parameters)
references. Buffer indices are bounded by the actual count, MONO is the valid
D3D9 type, and successful acquisition requires Release. The cited getter
contracts do not specify failure output contents. The regression records those
contents for diagnosis and never asserts that failure clears or preserves the
pointer; it never releases an output from a failed request.

`test/fixtures/d3d9-reset-fixture.js` now emits a 197120-byte PE32 with 111202
code bytes and 487 statically checked COM call sites. Public slots and argument
counts are checked against the production API table before Chrome starts.
Every executed COM call verifies ESP and EBX/ESI/EDI/EBP preservation, with
distinct nonzero initial register seeds. The existing raw-code and incorrect
GetBackBuffer-slot controls remain rejecting preflight checks.

`node test/test-d3d9-public-reset-web.js` executes the same generated PE in
the production owning CPU Worker and shared WebGL Worker on standard and
compat modules. Each module records 25 invalid selector cases, including
out-of-range and large unsigned chain/buffer indices, LEFT/RIGHT and an unknown
type, device/swap-chain parity, and the actual-count boundary for all four
requested creation counts. The baseline completed its guest assertions and
cleanup on both modules, then correctly failed the selector oracle. The fixed
run returns D3DERR_INVALIDCALL for all 50 requests, followed by 50 successful
Resets without releasing failure outputs.

Public controls also verify subsequent valid identity, description and owner;
two successful acquisitions plus explicit AddRef/Release block Reset until
the last external surface reference is released; a successful surface keeps
its released parent device usable through GetDevice, Clear and two literal
LockRect pixel witnesses; and final surface Release retires that parent.
GetRenderTarget verifies an independent RT0 binding before and after implicit
buffer lookups. A peer device preserves all 64 literal pixels through the
selector sequence. The existing 516 safe-pixel comparisons across 14 rendered
readbacks, healthy Reset, strict executor refusal, failed Reset, supported
recreation and peer isolation still pass. Baseline and candidate successful
frames and contact-sheet PNGs are byte-identical; both sheets were personally
reviewed. These are generated regression controls and previews. Original-game
behavior, historical27 completion and broad crash freedom remain unproved.

Validation passed:

- `flock /tmp/wine-build.lock bash tools/build.sh` before reproduction and
  after the production repair.
- `node test/test-d3d9-public-reset-web.js` on both shipped modules, with the
  expected baseline selector failure retained and the repaired run passing.
- `node test/test-d3d9-color-surfaces.js`
- `node test/test-d3d9-reset-presentation.js`
- `node test/test-d3d9-worker-reset-recovery.js`
- `node test/test-d3d8-unavailable-probe.js`
- `node test/test-d3d8-16bit-mode.js`

Evidence: `scratch/runs/20261106-d3d9-backbuffer-selectors/`. Baseline and
candidate source records pin Git commit
`05ee8c9851f9aaf9d98b15179f47af01be6a3fbf`, relevant binary diffs, new-file
patches, source hashes and retained distinct module bytes. The candidate
standard module is
`41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f`;
compat is `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a`.
Actual browser-loaded hashes matched those files. `baseline-summary.json`,
`comparison.json`, both browser result files, command logs and the generated
PE retain the executed reproduction and repair evidence. No source archives,
game-media copies, original-game execution, boxes or deployment were used.

The ordered Conan0350, KKnD0400 and AoW0410 final releases and their resource
cleanup were independently checked before shared edits, builds or execution.
`gate.json` fixes the local execution window at 05:29:17.917742–06:14:17.917742
UTC. All test execution finished at 05:32:22 UTC. Final source identity and
owned-process/port/profile/lock cleanup records accompany the result, which
is published last. No test boxes were assigned; box ID/state/expiry are N/A.
