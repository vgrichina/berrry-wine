# Original Half-Life 2 demo: package and native startup prerequisites

Evidence is in `scratch/runs/20261117-halflife2-original-demo-startup-gameplay/`.
The original installer and installed game have **not been invoked**. There is no
Half-Life 2 menu or gameplay claim.

The coordinator's download receipt was inspected before reading the existing
`scratch/media/half-life-2-demo-original.exe`. A fresh streaming hash confirms
787,701,212 bytes and SHA-256
`24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.
No second installer or ZIP was downloaded or copied.

`tools/halflife2-original-package.cjs` inspects that exact package without running
it. Its PE32 image is 28,672 bytes; its overlay starts at file offset `0x3a00`.
The Wise stub reads length fields followed by CRC-protected raw DEFLATE streams.
Both compressed lengths and output CRCs independently agree for its initial
bitmap, metadata and two bootstrap DLL streams. The genuine `WISE0132.dll` is
165,376 bytes, SHA-256
`a87f19f9fee475d2b2e82acfb4589be6d816b613064cd06826e1d4c147beb50a`;
the stub loads it and resolves `WiseMain`. The inspection retains only this
necessary bootstrap DLL for the authored loader fixture, with a recovery recipe
from the original package. It does not unpack game content.

Further small CRC-checked streams contain an **Internet Connection Required**
dialog that instructs users without Internet to cancel. A 1,208,320-byte PE
contains the Valve Steam registry path and `Steam.exe` strings. Its role as a
Steam client is an inference from those bytes. The independently CRC-verified
14,849-byte installation script establishes the normal target separately:
`%PROGRAM_FILES%\Valve\Steam`, six `SteamApps\*.gcf` files and Steam shortcuts
and final launch targeting `%MAINDIR%\Steam.exe`. It does not establish game
content completeness, an actual installed launch or authentication success.
The installer title alone is not their proof.

The authored fixture uses ordinary x86 `LoadLibraryA`, `GetProcAddress`,
`FreeLibrary` and thread/lifecycle APIs through `test/run.js`. It loads the
genuine Wise DLL, resolves its export, and unloads it successfully. It **never
calls WiseMain**, loads the original EXE or performs installation.

The first successful fixture (`probe2`) ran on the main guest thread. Its
initial proof incorrectly described `--threads` alone as actual Worker coverage;
`coverage-correction.json` explicitly supersedes that field. A subsequent
fixture uses `CreateThread`, joins through `WaitForSingleObject`, verifies
`GetExitCodeThread` and observes actual Worker creation and exit. Its sealed
runtime is published Git `5df4bcb0f9ed85dc970421e025a1470b5f1b1ebf`, module SHA-256
`f1dd81b43b94bdab0783e0de2a4616d7b19bb0dd7165c43b295b3068b763e831`.
Only the two owned inspection/test helpers are overlaid in memory; all runtime
sources are Git bytes. Native and independently prearmed watchdog waits and
pipe EOFs are recorded separately. A preliminary invalid invocation-token
attempt and a later incorrect log-assertion failure are retained as harness
failures, separately from successful guest execution.

Original invocation remains conditional on current native route/capture/input
and lifecycle qualification. The VB worker owns the modal actor fault discovered
in current native qualification and its repair; the GL worker owns the parent
process lifecycle repair. Those changes are not adopted from the shared WIP.
No closed or UNKNOWN endpoint is queried, rebound or retried. No external Steam
service, content or account is invented, and no success stub or media/config/clock
edit is introduced.

The fresh full native route qualification on that sealed module passed all
normal-exit, transport, context/button guard, progress state/dialog/refusal,
pointer mapping, DialogBox and controller suites. The canonical locked build
also passed. This does not substitute for the material modal actor follow-up or
the independently owned lifecycle repair; those must be qualified before an
original. Package checks include the standard CRC-32 vector and independently
corrupted/truncated stream, wrong output size and compressed-boundary controls.

The fresh installation script initializes REQUIREDSPACE to 10,000 and adds
900,000 for absent Half-Life 2 content, 5,000 for the demo, 80,000 for the engine,
1,300,000 for materials, 500,000 for models and 1,200,000 for sounds: **3,995,000
installer free-space units**. Its missing-space display divides by 1,000 to
report MB. These are the genuine installer's declared requirements, not an
independently measured installed footprint. Current `/home` has less than
2 GB free, of which 1.5 GB must remain free. That cannot accommodate the
declared normal installation. No substitute storage, box, content editing,
disk-space success override or attempted partial install is used. Both one-shot
original stages remain unused. The next step is sufficient compliant local disk
headroom and the published, freshly qualified material actor/lifecycle fixes.

Recovery uses Git plus the recorded owned-helper patches and the original media
path/hash. No source tree archive, capture bundle or duplicate installer is made.
No box was created: ID null, state NOT_CREATED, expiry null, stop receipt N/A.
