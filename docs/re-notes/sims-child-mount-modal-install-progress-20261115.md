# Sims child initialization and untitled owned-modal input — 2026-11-15

This continues the [Worker-safe original installer](sims-worker-safe-original-installer-20261115.md).
Its feature `a30b71d01` reached genuine Sims/InstallShield UI and installed a
614,532-byte IKernel.exe, then failed initializing the ordinary child with
`Missing NE image COMMCTRL` and parent error `0x80040154`. The untitled main
also prevented reviewed input binding. Host SIGKILL was not native Quit.

The preparation worker wrongly stopped while Q3 was live. The owner continued
this task with one unused original authorization. Four released uncommitted
WIP paths were reclaimed at 09:42:42 UTC. Q3's live run was an expected wait.
After its explicit 09:45:24 release this worker personally verified all 103
named hash-matched actual waits with both EOF, including native, watchdog,
supervisor child and launcher; all 340 PIDs/groups were absent. Ancillary
UNKNOWN was preserved. TIM acknowledged Q3 → Sims885263 → TIM799706.

Evidence is `scratch/runs/20261115-sims-child-modal-through-original/result.json`.
`predecessor-reference.json` verifies the preparation run
`20261115-sims-child-mount-modal-install-progress`, its four file/patch hashes,
six host waits and retained partial references without copying its artifacts.
Evidence uses Git SHAs/binary patches, compact logs, source/host/media pins,
selected result PNGs and direct waits. No source-tree or media/WASM/frame
bundle is created. No worker or box is created.

## Explicit files before child initialization

The native baseline confirmed the timing failure: the parent DllMain read
succeeded, while the ordinary child DllMain returned FALSE before VFS-tree
mounting. The fix forwards only explicit files into the child's early mount
pass. Exported current native bytes take precedence over original host inputs,
preserving guest writes. Deleted inputs are not resurrected. Host paths resolve
in the parent's asset-root context; argument order preserves last-mount
precedence; relative installed names retain the C: mount root. Nested children
propagate the same rule. Provider exclusion in `saveVfsToHost` is retained;
no whole disc is exported. Ordinary explicit `setLazyFile` entries can be
exported, so initializer timing is broader than provider exclusion alone.

Host controls cover paths, nested arguments, precedence, writable bytes,
deletion and lazy exclusion. Native generated controls exercise ordinary
CreateProcess/WaitForSingleObject/GetExitCodeProcess, parent/child/nested DllMain
reads and an actual NE initializer. Positive chains reach guest ExitProcess(0).
Absent/wrong inputs remain failures. A parent overwrite to wrong bytes remains
wrong in the child's initializer, proving original host bytes do not replace
native writable state. That deliberately failed-child negative requires bounded
host teardown, separately recorded from native Quit.

`test/test-sims-child-mount-native.cjs` supplies small generated inputs and
recipes. The predecessor's prepared file/NE/untitled-modal inputs are reused.

## Exact untitled main and owned modal

CLI snapshots expose native live records, HWND generations, process,
owner/parent, native modality, focused control identity/top-level ancestor,
capture, physical-UP state and executable identity. Empty main titles require
the exact reviewed live owned modal in the same process and focus inside it.
The endpoint independently compares identity and current complete-canvas PNG
hash before binding. A reviewed binding is permanent.

The guard retains renderer/queue/device/actor references and additionally
checks native main/modal generations and modal renderer identity. Focus/capture
must stay inside the modal. Independent physical release uses original refs.
Sticky UNKNOWN, finite holds, independent UP and no capture during held gestures
remain. The existing titled-main route is retained.

Eighteen policy controls cover admission. An ordinary generated PE creates an
untitled main and calls MessageBoxA with its genuine owner. The old committed
policy refuses that actual native scene. Fixed binding reads native button
controls and delivers one finite Cancel gesture with independent UP.
MessageBox returns IDCANCEL and the guest reaches ExitProcess(0), with actual
native wait and no host-cancel request. Native negatives cover wrong owner,
sibling, stale generation, foreign process, unowned/hidden modal, changed focus,
held input, stale paint/review and native destruction/replacement after queued
admission. Failed endpoint admission permanently refuses rebind. Fixture
consequences do not establish original installer behavior.

## Qualification and one original

Both shared-tree and committed-HEAD-plus-whole-owned views run the locked full
build, focused/native controls, existing HTTP/bootstrap/production tests,
FT/LS32/NE/GDI/native-Quit regressions and CLI ownership/guard regressions.
Foreign WIP is preserved. Actual desktop authority/client Workers qualify the
exact source/mapped-host preloads; omitting either hook is refused. Publish
the complete feature on main before the original.

Both complete views passed: full locked build, 18 modal policy controls,
12 actual native UI cases, five native mount cases, 24 existing policy and
12 HTTP controls, three bootstrap and 13 production controls, twenty
FT/LS32/NE/GDI/Quit suites and both CLI input suites. All thirteen inherited
foreign code pins remain unchanged. `final-qualification-checks.json` and
`qualification-final-closure.json` retain individual results and direct waits.

Retain `test/binaries/sims-complete-collection/installed-overlay`. Its pre-run
index SHA-256 is
`209641d4b739f61d44a2c6b4085995e16699912d9e06e5a44d617afb6e85d9b2`.
The engine `blobs/f1ad4bb2-e744-4e50-99c0-c2d87e3a5204.bin` has SHA-256
`985eb55ecb750da812876b8569d5f1999a30a24bcc54f9bab4d3fc44dfedb931`.
The prior native-output manifest supplies recovery references.

The one authorized original is unchanged Nova four-disc
`D:\\Setup\\Setup.exe`, SHA-256
`fe95a9fc8b2cdb5add76fbd326b1a11801eaa43c7d908f20cbdf413fd4d8dfde`,
with unchanged selected COMCTL32 and genuine companion
`test/binaries/sims-native-common-controls/kommctrl.dll` mounted as
`C:\\Windows\\System\\COMMCTRL.DLL`. Keep native partial state, qualified hooks,
real ticks/defaults, 900 native seconds, prearmed independent 920-second watchdog
and 180-second Quit reserve. Freeze source/module/build during the original.
Every input requires current personally reviewed complete scene, fresh
intent/nonce, 80–1400 ms hold and independent UP within 1750 ms. Written UNKNOWN
permanently closes input, with no replay/rebind or second original. Installation
files/UI and native Cancel/Quit must be distinguished from host shutdown.

Original authorization is unused at qualification. No original installation
advancement or native Cancel/Quit is claimed yet. Box ID/expiry null,
state NOT_CREATED, stop receipt NOT_APPLICABLE.
