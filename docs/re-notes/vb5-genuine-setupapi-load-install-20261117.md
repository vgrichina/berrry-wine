# VB5 CCE: genuine SetupAPI dependency and native loading

Run: `scratch/runs/20261117-vb5-genuine-setupapi-load-install/`.

The existing original installer is SHA-256
`022af94b651cd9d31e0676a6819dd5085940893f1ecc4abaa85b48c30de6f318`.
Its already supplied SetupAPI is SHA-256
`51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159`.
Neither file is modified. The preceding original pipeline stays closed.

An authored native client reproduces `LoadLibraryA("SETUPAPI.DLL") == NULL`,
`GetLastError() == 126`, with those exact SetupAPI bytes mounted at
`C:\setupapi.dll`. Its import graph requires CFGMGR32.DLL and imports 39
Configuration Manager functions. That companion is absent from the prior VB
media directory and VFS. The native dependency walker consequently refuses
the load before SetupAPI is mapped or its entry point runs. The prior generic
`DllMain=0x1ab824a` success does not establish a SetupAPI attach.

The existing pinned DirectX package supplying this exact SetupAPI also supplies
the genuine 41,984-byte CFGMGR32.DLL:

- Package: `test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe`
- Package SHA-256: `564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189`
- Companion SHA-256: `572387372791a7bc8d336fbbb6af6a9651a627124599f862ac2bd235145b7b80`

The runtime helper validates the package, extracts only that member into a
sealed anonymous descriptor, validates its size and hash, and explicitly
mounts it at `C:\cfgmgr32.dll`. The media directory stays unchanged. Native
dependency loading, export binding, entry points and unload run normally.
There is no system-DLL manifest exception, API success stub, binary edit,
installer configuration change or clock change. Inspection found no required
production loader correction: supplying its real dependency fixes this load.

`test/test-vb5-genuine-setupapi.cjs` builds authored clients, never launches the
original installer, and tests the genuine DLLs on the main instance, actual
CPU Worker and spawned child process. The negative cases omit CFGMGR32 and
assert NULL/error 126. Positive cases resolve all 15 exports ADVPACK requests,
open a Win4 INF with the genuine parser, find a line and verify its actual text
output, open/close a native file queue, close the INF, unload SetupAPI and
refuse its retired handle and the retired companion module. Missing exports return NULL/error 127. Actual
parent, Worker and child exits are joined; child native state is merged only
after the child's completion. The test verifies the original file hashes.

`native-lifetime-final/` is the final native proof, using module SHA-256
`33ef36c2de1c86ca1302b5659f02bb48f1794dfc4e20945821251198f04cb03e`
from exact Git plus the recorded owned helper/test patch. Foreign WIP is
excluded. The preliminary child oracle wrongly accepted the child's marker
after the parent reached the default short stuck threshold; this is retained
as a limitation of that preliminary test. The final test disables that
threshold within its fixed deadline and requires the parent's own marker and
normal guest exit, in addition to the actual child wait and parser output.
Every required export must also point inside the genuine SetupAPI image;
nonzero generic API thunks cannot satisfy the test.

Publication and the sole fresh original pipeline outcome are recorded in the
run's final `result.json`; native loader conformance alone does not establish
installation, IDE startup, sample execution or ordinary IDE Quit.

Material repair `7c84a0ae08088267e63a1b152173f672b65cc18c` was published after
the required canonical build and five native cases passed. The first canonical
attempt failed on unrelated media-size metadata; its owner corrected that
metadata, and the required subsequent build completed with exit 0.

The sole fresh original used a recorded composition: published native core
`e9ee194a20b3ec7754c6465b999bd65dd0252e95` plus the byte-verified published
helper/test from `7c84a0ae0`, producing the exact previously qualified module
`33ef36c2...`. It did not test the entire later main tree. Git identities,
owned helper patches, source hashes and the actual module are retained;
unchanged predecessor control proofs were reused by exact consumed hashes.

The original accepted Yes and its license, extracted its files, loaded genuine
CFGMGR32 at entry `0x1ac21f1`, then attached SetupAPI at entry `0x1af5b40`
(`mapped base 0x1acc000 + RVA 0x29b40`), each returning EAX 1. It displayed the
default `C:\Program Files\VB5CCE` destination dialog. Its reviewed OK click
completed in 191 ms including independent physical UP and observation.

The subsequent create-folder question reached a new boundary: reviewed capture
refused `context: ["modal.ownerless"]`. The already retained public observation
shows no main HWND, destination DialogBox `0x10012`, and native MessageBox
`0x10018` genuinely owned by `0x10012`, with matching live process/thread
identities. The scene validator's pre-main MessageBox branch requires owner 0;
this is an owned nested MessageBox, not another SetupAPI load failure.
That refusal permanently closed the endpoint. No later HTTP, capture, input,
rebind, replay, second original or IDE/sample launch occurred. The refused
capture has no screenshot; the last personally viewed complete image is the
default destination dialog.

Identity-checked SIGTERM requested local shutdown after UNKNOWN. The CLI logged
orderly shutdown and flushed 87 overlay records and 78 registry entries, but
the outer process exited 143 before native wait, watchdog wait and descriptor
release receipts were published. Those receipts remain explicitly missing.
The remaining owned watchdog was terminated; supervisor, native process and
watchdog are absent and both control ports are closed. This establishes cleanup
observation, not a native Quit or successful join. Installation, IDE and sample
execution remain unproven. Future work needs the nested MessageBox provenance
boundary and reliable outer shutdown receipts; this closed pipeline must stay
closed. No boxes were created.
