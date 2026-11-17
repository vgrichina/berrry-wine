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
