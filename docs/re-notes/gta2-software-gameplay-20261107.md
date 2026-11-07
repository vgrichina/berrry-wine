# GTA2 software qualification blocker — 2026-11-07

No fresh GTA2 software gameplay proof was obtained. Qualification failed before
any original or generated guest launched; no walking, native Enter vehicle entry,
driving, owning software completion counter or absence of GPU draws is established
by this attempt. Existing WebGL proof `27fdd86e9` remains separate evidence.

Evidence: `scratch/runs/20261107-gta2-software-gameplay/`. One fresh separate boat,
`bx_td4y7qra`, was created with a UUID Idempotency-Key persisted and fsynced before
the request. No local runtime/source/build lane, nested worker, old403 resume,
retry, source/media archive, public deployment or guest/media/config/save edit.

The first blocker is an incomplete run-specific qualification inventory.
At 01:57:59.224 UTC the generated guest-x86 public COM/vtable control exited 1:
`ENOENT ... /tools/protected-writer-entries.js`, required by
`test/render-artifact.js` while identifying harness inputs. Its trace is empty:
the control never reached COM calls. This is a staging failure, not a demonstrated
emulator defect. Production vtable tails therefore remain unqualified here.

A shell sequencing mistake allowed the separate generated browser preflight to
start after that failed control. It terminated at 01:57:59.885 UTC on
`AssertionError: /null`, HTTP 404 versus expected 200, before spawning Chrome.
The copied dependency pin recipe constructed `/null` from `dllPath('mss32.dll')`;
the app-local Miles DLL has no global registry URL. Its actual registered media
path is present and pinned. Neither preflight was retried; no original was started.
A future attempt must finish and check the staged harness dependency inventory,
use the actual app-local dependency URL, and stop shell sequencing on failure.

Local run-specific atomic transport controls (nine cases), executor/recovery
controls (seven cases), balanced production-renderer/DirectInput keys and invalid
duration controls passed. Durations 0, 49, 2001, 3500, -1, NaN and 100.5 refuse
before publication/admission/events; accepted bounds are 50–2000 ms. These are
generated controls, not original-app input evidence. The remote sequence stopped
at the COM prerequisite before its key controls; native Chrome key pairs and
the native COMCTL property sheet were not executed or reviewed.

Source staging SHA is `c0b3d06ad55e7076fbcc094f2077d65724424c17`.
`runtime-pins.json`, `relevant-source.patch`, the new-source patch and
`owned-inputs.patch` preserve identity without archiving the checkout. All 653
staged pins match before/after. Existing standard/compat modules are hashed in
that inventory; no module executed, so there is no actual loaded-module identity
and no clean-build claim. No production code changed or production build ran.

All 69 registered media paths plus EXE and Miles DLL were present and hashed.
The installed EXE is 2,893,824 bytes, SHA-256
`97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3`;
Miles is 331,776 bytes, SHA-256
`0974b244354a5d13e0711db15430c05f7949dc279b63897146f304d1401153fc`.
The historical 73-payload distribution and absent upstream provenance were not
reconstructed. Exact retained local bytes, rather than upstream provenance,
identify this supplied fixture.

All 20 remote run artifacts were retrieved or verified against retained local
bytes. The generated controller PID 6748 is absent, no matching runtime/profile
process remains, and the profile and writer lock are absent. The controller
closed its temporary HTTP server normally; Chrome and its debug endpoint were
never created. The HTTP port was not recorded before the early assertion, so
no numeric-port refusal is claimed. The final network tables are retained.
The generic cleanup string `pending: "UNKNOWN; never replay"` describes the
template's terminal policy, not an original command outcome: no commands existed.

Delegated normal stop `stop_3dc02ec3e30692c2` completed with `forced=false` and
`error=null`; the boat is archived with active expiry null. Allocation through
retrieval and completed stop was under two minutes, within the 35-minute limit.
Local disk remained above 2 GB. No automated safety flag occurred.

Findings only. The next step is a newly authorized attempt after correcting the
qualification staging recipe. No combat, audio, FPS, parity or full27 claim.
