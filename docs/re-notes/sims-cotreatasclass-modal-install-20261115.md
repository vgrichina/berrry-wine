# Sims CoTreatAsClass and native modal qualification — 2026-11-15

Continues [the child initialization result](sims-child-mount-modal-install-progress-20261115.md),
published feature `3e9771de91ec339ea8cf372d729186cca205efc5` and report
`8c61fdd5acba2f8291629864a599564a002b9fc3`. That original attempt is closed.
This task has one fresh ordinary-original authorization after publication and
qualification. TIM799706 then Q3layout916770 release source/build/runtime before
this worker may enter heavy work; direct closure must be personally verified.

Evidence: `scratch/runs/20261115-sims-cotreatasclass-modal-install/`. Git plus
binary patches records source; media and retained native overlay are referenced
by path/hash. No source archive, media copy, WASM/frame bundle, worker or box.

## Contract and observed prerequisite

[Microsoft CoTreatAsClass](https://learn.microsoft.com/en-us/windows/win32/api/objbase/nf-objbase-cotreatasclass)
requires a registered old class, changes its TreatAs registration, replaces an
existing mapping, removes it for CLSID_NULL, and uses AutoTreatAs when old and
new are equal. Target registration is not required. Read/write database failures
and invalid arguments must remain failures. A NULL pointer is distinct from a
pointer to the all-zero CLSID.

[CoGetTreatAsClass](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cogettreatasclass)
returns S_FALSE and copies the original CLSID when no mapping exists.
[TreatAs](https://learn.microsoft.com/en-us/windows/win32/com/treatas) and
[AutoTreatAs](https://learn.microsoft.com/en-us/windows/win32/com/autotreatas)
are REG_SZ default values in class subkeys. The existing emulator registry uses
HKCR. Supported activation consumers must use the mapped class identity, also
when invoking the real guest class factory. Unsupported COM directions retain
their guards. These contracts describe OLE class emulation, not fabricated
application-installation state.

The [legacy-compatible CLSID registration contract](https://learn.microsoft.com/en-us/windows/win32/com/clsid-key-hklm)
identifies HKEY_CLASSES_ROOT as the compatibility form of the Classes tree and
separately lists 16-bit/32-bit server and handler registrations. This change
uses the existing HKCR backend and supported activation paths; it does not
implement other server directions, AutoConvertTo, or OLE object-format
conversion. The genuine legacy installer import and static calls establish
applicability here; the current API page's supported-platform floor does not
establish a new minimum for the original media.

The retained unchanged IKernel is referenced by its existing path and SHA-256
`985eb55ecb750da812876b8569d5f1999a30a24bcc54f9bab4d3fc44dfedb931`.
Static CoTreatAsClass IAT `0x46c364` has call sites `0x4318cc` and `0x431949`.
Both use old class `{8c3c1b17-e59d-11d2-b40b-00a024b9dddd}`; the former passes
CLSID_NULL, the latter `{22d84ec7-e201-4432-b3ed-a9dca3604594}`. The retained
runtime trap proves the API boundary, without identifying which static site ran.

## Genuine ownerless message box

Retained API #1344 explicitly records `MessageBoxA(hwnd=0, ...)` for the
InstallShield error. The handler passes the owner unchanged into native window
creation. [Microsoft MessageBoxA](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-messageboxa)
specifies that NULL produces no owner. Default application modality and
MB_TASKMODAL are legitimate; the latter disables the calling thread's top-level
windows when owner is NULL. An ownerless window alone grants no input authority.
No owner will be fabricated, and the old attempt is neither retried nor rebound.

New ordinary native controls are prepared for both application/task MessageBox
calls, exact same-process/thread/current-native-modal identity and finite
Cancel → IDCANCEL → guest ExitProcess. Existing owned-modal controls remain
required. Native execution and original installer outcome are pending the
predecessor releases; generated inputs alone prove neither.

## Prepared checks and predecessor closure

The light candidate passes 26 host-registry controls and 41 policy controls
(existing owned-modal 18 plus new NULL-owner 23). These run against candidate
text in memory; they are not native execution or publication. Generated native
clients call the imported OLE32 exports and ordinary ADVAPI registry APIs.
Contracts cover canonical GUID bytes, overwrite/delete, CLSID_NULL versus NULL
pointers, same-CLSID AutoTreatAs, malformed values, missing old registration,
missing target activation, child registry import/merge, and independent-process
isolation. An actual guest DLL rejects an unmapped original CLSID, so successful
factory calls will require passing the mapped identity. A builtin activation
chain and cycle guard are also prepared.

TIM released at 10:23:51 UTC. The read-only personal verifier checked release
SHA `c1259a400ab9483dfaf4e59491ed6058280aa27c5da71a4e265b191b9fe7d87d`,
120 named waits with hash readbacks and actual wait/both EOF, and current absence
of all 124 recorded PIDs/process groups. The first verifier rejected the
named-wait dictionary schema; the corrected verifier passed, and both the
premature board claim and its correction remain append-only. Q3 entered heavy
work at 10:27:16 UTC; its live predecessor wait is a start condition.

## Implementation and first native results

The real OLE32 export handlers now use the existing registry backend. The getter
and supported activation consumers resolve actual TreatAs state. Redirected
activation retains the original input and uses a private stack GUID/frame,
then delegates to the existing builtin, loaded DLL or registered-factory path.
A bounded cycle refusal is an explicit malformed-graph guard, not support for
additional server directions. The compiled C contracts, actual child overwrite
and parent merge, isolated new process, and guest-DLL/builtin activation all
returned native ExitProcess(0). Both modality variants passed 18 native tests
in the shared view, including Cancel returning IDCANCEL followed by guest exit.
The existing owned route passed its 12 native controls.

The first locked build stopped at the existing callback census's expected
producer hash changes. Its foreign primary JSON is unchanged. The gate now
accepts separately reviewed revisions anchored to the primary producer hash;
these may revise only the expected hash, never producer shape, kind or pending
ownership. Fourteen negative/positive controls cover invalid anchors, unknown
producers, duplicate reviews, shape changes and ownership assertions. Existing
census mutation tests retain exact diagnostic expectations with those reviews.
This is a source review lock, not an invocation-safety claim.

The first real-owner COM regression used a generic zero-return import stub for
the newly added resolver. Zero means a successful mapping, so that fixture
entered an invalid redirect. Forwarding the import to its existing real storage
instance fixed the fixture; all original exact frame, nesting, retry and
owner/shadow assertions pass. No runtime frame expectation was weakened.

Q3's explicit release SHA is
`56ceaa98ede3ae89d03f33ea2325b14ba261e97b61d326928a987f63b54ee374`.
Personal readbacks verified its 58 named actual waits/both EOF and current
absence of 182 PIDs and process groups. Both locks were free. Heavy work began
at 10:43:01 UTC, after both predecessor verifications. All 15 pinned foreign
or inherited source/metadata files remain unchanged, including op5/data-span
and the primary callback census. Full shared and committed-HEAD-plus-whole-owned locked builds and focused
qualification passed. The final compiled fixtures also cover nested redirected
activation. Both native modality variants pass 18 cases each, and the existing
owned route passes 12. Final closure seals 975 actual waits with both EOF and
1088 recorded PIDs/groups absent. The fresh original remains pending publication.

The current [RegDeleteKey contract](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regdeletekeya)
is NT-oriented for descendant keys. The archived Microsoft Win32 reference
([MSDN mirror](https://techshelps.github.io/MSDN/WINBASE/devdoc/live/pdwbase/regapi_1po9.htm))
explicitly distinguishes Windows 95 recursive removal from NT's leaf-only
removal. The implementation removes the TreatAs subtree under the selected old
class, consistent with the existing Win9x registry backend, and preserves
unrelated class state. No NT registry-security or separate registry-view support
is inferred from this change.

The public activation ownership regression also had a pre-existing reduced
closure missing the current CPU diagnostic dependencies. It now compiles the
real diagnostic-off pending-gap helpers, with explicit traps for unsupported
armed/failing diagnostic paths. All original activation/ownership mutations
pass. The production CPU/cache and all pinned foreign files are unchanged.
