# Genuine ISetupServiceProvider proxy/stub — 2026-11-16

Genuine support remains blocked before factory execution. Original-media
inspection identifies the correct non-Automation component: **objectps.dll** in the
original Sims Disc 1 InstallShield cabinet. No provider implementation,
Automation mapping, replacement engine, or game-specific registry value has
been introduced. QueryService success has not been demonstrated by this task.

## Original component and recovery

`test/test-sims-genuine-provider-proxy-stub.cjs --inspect-original DISC1BIN HDR`
reads the original MODE1/2352 image, resolves its ISO directory records, and
inflates only cabinet descriptor 2 into memory. It executes no project helper,
guest module, factory, registrar, installer or browser. It writes no media or
DLL copy. The expanded length and MD5 must match the original descriptor.

Inputs are the retained
`test/binaries/sims-complete-collection/discs/Disc1/Sims, The - Complete Collection (USA) (Disc 1).bin`
and `test/binaries/sims-complete-collection/static/Disc1/setup/data1.hdr`.
The freshly streamed and verified Disc 1 SHA-256 is
`298dedb913aa31d71d38adc984892f07908910ed0f7ca4a30498725dc49b041a`;
the image is 788886672 bytes. The header's current SHA-256 is
`d668ca753ed8939c34837ffa51e5bf5933f9eb3a9fbede4645b692574d549cdc`.

The ISO `setup/data1.cab` extent begins at logical byte 164433920 and has
1209173 bytes. Descriptor 2 names `objectps.dll`, volume 1, compressed offset
36269, compressed length 4483, expanded length 32768, compressed flag 4.
Its original MD5 is `8f02b204853939f8aefe6b07b283be9a`; the matching expanded
bytes have SHA-256
`32c6ad91dc66bc12e1273b1e13eb7a15d6e8f63b93447909ca2163dd21b22998`.
No other game's similarly named DLL is a substitute.

The authored recovery command is
`node test/test-sims-genuine-provider-proxy-stub.cjs --stage-original-dependencies RUN_DIRECTORY`.
It requires the run's ordered heavy-admission record before media I/O, verifies
both complete source image hashes and the recovered DLL hashes, and refuses
to overwrite different existing bytes. Its destinations are the original
engine's expanded `objectps.dll` asset path and the isolated
`test/binaries/sims-native-rpc-runtime/rpcrt4.dll` asset path, with explicit
guest mounts. The worker must claim those clean asset paths before invoking
it. The command ran after admission and recovered both exact dependencies;
its missing-admission refusal also passed. Subsequent native loading is
recorded below; it fails in the original RPC runtime initializer.

The original PE exports DllCanUnloadNow, DllGetClassObject, DllRegisterServer
and DllUnregisterServer, at RVAs 0x3040, 0x3000, 0x3090 and 0x30d0 respectively.
Its preferred base is 0x10000000. Its provider IID bytes occur at file offsets
16948 (NDR type format) and 17304 (interface IID). These are static original
file coordinates, not runtime addresses or emulator memory placements.

The pinned original ProxyFileInfo list at RVA 0x5000 points to RVA 0x4260.
Its first entry names ISetupServiceProvider, IID
`{f4817e4b-04b6-11d3-8862-00c04f72f303}`, with six vtable methods and generated
method RVAs 0x1000, 0x13c0 and 0x1740. The second entry names ISetupObjectClass,
IID `{9b697780-dbbc-11d2-80c7-00104b1f6cea}`, with five methods. This also
identifies the registrar's default proxy class as the provider IID, derived
from the original first entry rather than a manually chosen mapping.

Disassembly of the genuine DllRegisterServer shows it passing the module,
its ProxyFileInfo list and the first interface IID to NdrDllRegisterProxy.
DllGetClassObject passes that list and its real static factory storage to
NdrDllGetClassObject. The component imports the CStdStubBuffer operations,
IUnknown proxy operations, NdrProxyInitialize/GetBuffer/SendReceive/FreeBuffer,
NdrStubInitialize/GetBuffer, NDR pointer/structure/interface routines and RPC
exception support. Executing registration alone cannot establish these APIs.

## Registration contract

Microsoft documents that [RegisterTypeLib](https://learn.microsoft.com/en-us/windows/win32/api/oleauto/nf-oleauto-registertypelib)
registers dispinterfaces and Automation-compatible interfaces. The predecessor
observed genuine ISetupServiceProvider with typeFlags zero and a real
RegisterTypeLib success followed by REGDB_E_IIDNOTREG. These observations do
not justify assigning the provider to PSAutomation.

The documented [proxy DLL registration contract](https://learn.microsoft.com/en-us/windows/win32/com/building-and-registering-a-proxy-dll)
uses the generated DLL's self-registration and class-object exports.
[NdrDllGetClassObject](https://learn.microsoft.com/en-us/windows/win32/api/rpcproxy/nf-rpcproxy-ndrdllgetclassobject)
returns its IPSFactoryBuffer using the actual ProxyFileInfo and factory
storage. The original media supplies such a DLL; the next runtime experiment
must call its actual registrar and factory, then exercise the actual proxy
and stub across the authenticated existing byte channel.

A static dependency inspection also located the original Windows 98 SE
system RPCRT4 in the already retained
`scratch/media/win98se-oem-x05-29232.iso`, WIN98_40.CAB, `rpcrt4.dll`.
The freshly verified system ISO SHA-256 is
`2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607`
(655591424 bytes).
PRECOPY2.CAB/layout1.inf records `rpcrt4.dll=40,,339968`. In-memory cabextract
produced 339968 bytes with SHA-256
`f5719c28ce60526cb4873332073c21148ce4c74427197aa6a4438c2951af9c5a`.
The initial inspection retained only PE logs; subsequent native runs loaded
the original dependency and trapped during its initializer. Its imports include
MakeCriticalSectionGlobal and AllocateLocallyUniqueId, absent from the current
API table. A complete table comparison additionally finds the Win98 names
Process32First and Process32Next, while their A-suffixed APIs exist. All 40
RPCRT4 names imported by objectps.dll exist in the pinned original system DLL.
MakeCriticalSectionGlobal is now an actual main and Worker failure. The other
three missing imports remain static findings; their reachability is unknown.
Native system NDR requires the Win9x global synchronization contract before
its registrar or factory can run.

Original IKernel embeds an SLTG typelib, beginning at file offset 553464.
The new inspector reports lexical names only; it does not infer Automation
flags or provide metadata to the runtime. The predecessor's actual native
ITypeInfo result remains the provider's typeFlags-zero evidence.

The retained unchanged public clients are pinned without copying them:
main `live-kernel-client.exe` SHA-256
`4c2d21907d3a117f026f79a9604fc0c561bf9ce980a29cad96d4eef785b8634f`,
Worker `live-kernel-client-worker.exe` SHA-256
`681f62b7052636a0e7715eee61ce2a6fe57dfcf946bb3c8b302a11104120ce0f`.
The authored bootstrap adds original-provider registration and real,
unconnected factory probes before the retained system registrar and child
client. Its factory probes are not a server-call or QueryService success.
The bootstrap additionally checks the original proxy's 40 RPCRT4 import
bindings against the pinned native system module and verifies the native
NdrDllGetClassObject and NdrDllRegisterProxy export coordinates. This code is
compiled and has not executed as guest code.

Separate authored controls retain the genuine server and obtain its provider
through the same public activation and QI path. They check canonical IUnknown,
balanced AddRef/Release, unsupported QI, QueryService's three null pointer
positions, unsupported output IID and guarded output cells, then make the
normal service call. They do not replace the unchanged primary client. A
separate native metadata diagnostic targets ISetupInfo rather than modifying
the public-call run's registration state. All six bootstrap/control/metadata
fixtures compiled successfully; their guest execution remains unrun.

Native RPCRT4's NdrInterfacePointerBufferSize resolves
[CoGetMarshalSizeMax](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cogetmarshalsizemax)
from OLE32. That export is absent from the current API table. The interface
pointer marshal/unmarshal routines also resolve the existing standard
marshaling exports. A size implementation must validate the actual object and
requested interface and account for the chosen OBJREF format; reporting a
size must not create a persistent export or bypass the actual proxy factory.
Custom IMarshal has its own header/class contract and cannot receive standard
bytes by default. These are design requirements, not implemented behavior.

The missing RPCRT4 imports have not been called here.
MakeCriticalSectionGlobal is reached through an import thunk; its sole direct
wrapper caller is at original RPCRT4 RVA 0x1365. AllocateLocallyUniqueId has a
direct call at RVA 0x20dd4. Static call sites do not establish that the provider
path needs either API. Native execution must determine the next required API
before introducing an implementation or drawing a runtime boundary.

## Execution and source boundaries

Evidence is in `scratch/runs/20261116-sims-genuine-provider-proxy-stub/`.
Git SHA plus relevant binary patches preserve source; no source/media archive
or WASM copy is stored in the run. Original ignored assets are recoverable
using the pinned media recipe above.

Heavy work began only after ROOT_REMOTE_MERGE_DONE and the ordered
GTA2WorkerComplete2694975 and GLPointRaster2727799 FINAL releases. Personal
reviews verified their artifact hashes, actual waits with both EOFs and
current PID/group absence. A temporary root handoff finished the then-running
build normally, stopped and joined the watcher, and preserved the owned patch
and original input pins. No native COM call ran before that handoff.

The fresh base is `1deb961f3182353690bdefbec424d635f508ef71`, following root's
`1afae7796c` merge of `fc0ae1bce`. Personal review checked twelve root artifacts,
nine actual waits with both EOFs, current PID/group absence, free locks and
unchanged owned source/original DLL/compiled input pins before resuming.
Refreshed GL/census patches and source pins remain foreign and unadopted.
`lib/guest-thread-host.js`, D3D and GL WIP were not edited. No additional
worker or box was created.

The minimal loader policy permits explicitly mounted native RPCRT4 while
retaining the builtin fallback when no native file is supplied. The isolated
original assets were recovered and six fixtures compiled. The policy remains
uncommitted WIP; the diagnostic/recovery tool and this note do not provide a
working provider implementation.

The unchanged public client sequence, actual system registrar/PSAutomation and
ISetupMedia, both required Worker preloads, legal real 60-second deadline,
canonical identity, leases, cancellation and ABI controls remain required.
The four known storage/fixture failures remain unwaived. No original installer
attempt occurred or is authorized. Input/capture guards remain separately
unqualified.

## First native execution and remaining boundary

On the freshly merged `1deb961f3182353690bdefbec424d635f508ef71` base,
`implementation-build-shared-v2` passed the complete locked build. The exact
original DLL inputs then ran in `native-genuine-main-v1` and
`native-genuine-worker-v1`, with the two required preloads present and an
independent deadline armed before each child was admitted. Both runs exited
with failure, and each actual child/watchdog wait recorded both pipe EOFs.
The selected top-level EXEs were the new provider bootstrap fixtures, not the
original installer. The harness's generic media-launch log does not identify
the actual selected EXE; the recipe and entry pin do.

The first native failure is `MakeCriticalSectionGlobal`, reached from original
RPCRT4's DllMain. Main EIP is 0x00511e4b with native return 0x0050936a; Worker
EIP is 0x00611e4b with native return 0x0060936a. These are relocated versions
of the original thunk RVA 0x9e4b and caller RVA 0x136a. The loader correctly
refuses the initializer trap. Neither original DllRegisterServer nor
DllGetClassObject ran; public provider QI and QueryService were not reached
by these new bootstrap runs. No failed endpoint was retried.

The [Wine kernel32 reference implementation](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/sync.c)
creates a semaphore when needed, converts its handle to a global handle,
then clears the critical-section debug allocation. That is evidence of a
real synchronization operation, not a no-op. Current Wine-Assembly
`ConvertToGlobalHandle` in `src/09a-handlers1-user.wat` returns its input number
under an obsolete one-process assumption. `lib/thread-manager.js` and
`lib/host-imports.js` store semaphores in process-local tables. The existing
cross-process named-event authority does not provide a global semaphore
handle contract. Reusing that identity stub or storing a local semaphore in
LockSemaphore would not implement the observed Win9x dependency.

The fault stack exposes the argument address (main 0x006630b4, Worker
0x007630b4), but no retained memory dump establishes its contents, allocation
kind or actual cross-process sharing. The static disassembly alone does not
prove the section needs to be shared between processes.

The next native-runtime work must first trace that actual public argument and
allocation/ownership contract. Implementing the global API then requires real
semaphore promotion, lifetime and ownership, integration with teardown and
waits, and main/Worker/multiple-process qualification where applicable. This
extends beyond
the clean COM/typelib/registry paths assigned here; host/guest-thread foreign
WIP remains untouched. Other known static dependencies are
AllocateLocallyUniqueId, the Win98 unadorned Process32First/Process32Next names,
and dynamically resolved CoGetMarshalSizeMax. None is masked or claimed
implemented. The authored maximum-size candidate remains unapplied.

An alternative is a generic standard RPCRT4 NDR implementation that consumes
the original ProxyFileInfo and executes the original generated proxy/stub
methods, including actual interface-pointer marshaling. That implementation
does not exist in this task. Merely reading the original metadata, assigning
PSAutomation, installing a substitute DLL, or manufacturing a factory result
would not qualify it. The original registrar/factory/server call, marshaled
QueryService output and all required provider control matrices remain open.

The fresh shared regression sweep passed 16 of 20 commands, including
all 53 predecessor remote-QI controls. The four existing failures remain
unwaived: storage EOF, extracted child-mount fixture, callback concurrency
fixture and callback token fixture. No provider implementation is published
on the strength of this sweep.

`--verify-native-boundary RUN_DIRECTORY` verifies the two recorded native
failures against their actual entry EXE, original DLL hashes, module recipe
pin, required preload hashes, joined child/watchdog/supervisor waits and
unreached registrar/factory/service markers. It is a negative evidence check,
not an implementation or service acceptance test. The minimal three-line
RPCRT4 loader policy remains uncommitted WIP because this native route cannot
yet complete initialization. The original ignored DLL assets remain pinned
at their recovery destinations; no binary or media is committed.

The HEAD whole-owned build also passed; its focused sweep has the same
16 passes and four unwaived failures. Both source views passed all six retained
native OLEAUT cases (four owner combinations, parallel clients, retiring
server). These include the predecessor's real server QI, canonical identity,
ABI and deep BSTR/interface checks. They exercise the existing Automation
contract, not the blocked non-Automation provider.

Four fresh deadline runs (shared main/Worker and HEAD main/Worker) completed
the existing real 60-second wait, returned 0x80080005 with null output, and
the two shared launch counts were personally observed as one before the
post-run loss below. The HEAD launch counts were not reviewed before that
loss and remain unqualified. Each retained endpoint has
actual native/child/watchdog joins with both EOFs. Neither required preload
can be omitted: both omission controls refused before guest execution.

## Unexpected post-run file loss

After the final shared restoration build passed, the next command exited 2
before launching: own launch.py and the pinned predecessor supervise.py were
missing. Inspection then found all 25 indexed client EXEs, the new compiled
C inputs, own Python run scripts and deadline protocol JSONL files absent.
The worker did not perform this cleanup; its cause is unknown. Other workers
reported similar fresh-file losses on the board. No reconstruction, native
retry or substitute input was used.

The original seven dependency assets, source/test files, relevant Git patches,
actual wait records, first native fault logs and saved four deadline reports
remained. The new default refusal checks pass. The boundary verifier refuses
on its first missing pinned EXE, as required; it is not marked passed. Missing
protocol files prevent current verification of launch-count evidence; only
the two shared counts had been personally reviewed before the loss. Exact
HEAD launch counts remain unqualified. No full provider acceptance or complete
post-run reproducibility claim is made.

The remaining task is genuine Win9x synchronization support with actual
argument/ownership evidence, then original registrar/factory/server/output
qualification, plus recovery of missing inputs/helpers and preservation of
unique runtime evidence. The original installer and game input remain out of
scope. The loader policy stays uncommitted WIP.

Only this note is published. The new diagnostic/recovery test and minimal
loader policy remain uncommitted WIP, with their exact binary patch in
`final-owned-source.patch`. Missing pinned inputs prevent completing the new
evidence-verifier qualification; no unqualified implementation is committed.
