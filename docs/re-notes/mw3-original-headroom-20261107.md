# MW3 original browser runtime — 2026-11-07

The original registered `mw3` route reached a visually reviewed main menu,
but the qualified driver refused input because the guest Worker never started.
No cockpit, movement, turn or fire evidence was obtained. This is incomplete
staging closure, not a demonstrated emulator defect.

At 14:00:24Z, `/lib/host-import-sigs.generated.json?v=dev` returned HTTP 404.
The owned staging manifest retained the fixture's JavaScript files but omitted
that generated JSON. `host.js::_maybeStartGuestWorker` requires it; its catch
path falls back to cooperative execution. At 14:01:59.104Z the retained driver
terminated with `guest Worker readiness timed out: mw3`. Identity and freshness
checks stayed strict. No command or native input was dispatched;
`retrieved/original/native-input.json` is empty. There was no UNKNOWN replay.

Other staging omissions were `src/api_table.json`, `lib/vendor/tweetnacl.js`,
and `lib/vendor/webaudio-tinysynth.js`. The missing TweetNaCl dependency caused
the first uncaught page exception. Complete those browser dependencies before
another authorized runtime. `build-info.js` was also absent in the shared
checkout; optional shell-image/auth/bundle 404s are retained separately in
the HTTP log without being promoted to emulator defects.

The reviewed `retrieved/original/passive-original.png` shows Campaign, Training,
Instant Action, Multi Player, Options and Quit over the original textured MW3
menu, plus “isolated · worker did not start.” It is a passive diagnostic capture,
not a qualified bound capture authorizing input. SHA-256:
`32aeb0da193276d29db14da2c16e156416cb2b0b32223b8838822a49c8033fbf`,
381,236 bytes. State confirms `guestWorker:false`, `Win98Renderer`, and isolation.
Chrome reports ANGLE/Vulkan SwiftShader. Gameplay D3D backend, FPS and parity
remain unmeasured; menu rendering does not establish gameplay.

Evidence: `scratch/runs/20261107-mw3-original-headroom/`. Staging source commit:
`d5d4f01d262528c237d3206aa39e592cb959901c`. Relevant tracked and new-input
binary patches and individual runtime pins are retained. HTTP proves delivery
of the 2,182,493-byte module with SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Executing-module identity never qualified; served bytes are not Worker binding.

The owned driver copy enabled only the original route
`/index.html?debug&candidates&no-log&gl-renderer=webgl&app=mw3` and raised its
disk monitor to 2 GB. Its 18 identity fields, module-byte checks, pixel freshness,
numbered exact ACKs, sticky UNKNOWN closure and independently scheduled UP
were preserved. Controls qualified by `ccdf141cc` were not repeated. All 289
staged file hashes/lengths were verified remotely before boot. The browser
verified all 33 original registry resource HTTP bodies. Authentic MSVCP50,
Mech3Msg, MSVCRT and MFC42 loaded; normal config, memory and clocks were not
edited. No handler calls, fixture runtime, source/media archive, production
edit, build, PBO analysis or held-risk retry occurred.

Disk initially measured 2,225,197,056 available bytes, fell to 1,458,192,384
during read-only preparation, and recovered before allocation. The initial
disk-blocker draft was superseded on recovery; `disk-blocker.json` retains
the earlier measurements and an above-floor finalization sample. Allocation
and staging occurred above the owner's 2,000,000,000-byte floor. No disk
recovery mutations were performed.

One UUID-keyed `POST /sandboxes` created `bx_jhm4zg6k` at 13:59:53Z. No resumes
or second runtime attempts occurred. The single immutable deadline ran from
14:00:22.241Z to 14:25:22.241Z. Following readiness failure, Chrome exited
normally with code 0, the HTTP port closed, and its profile was removed. All
25 small unique evidence files (461,340 bytes total) were retrieved with
SHA-256/length verification. Under explicit shutdown delegation, normal stop
was requested at 14:02:19.520Z and completed at 14:02:19.873Z, `forced:false`.
Final state: **archived**. Original scheduled expiry: 14:59:53.422Z; the archived
state has `archiveAfter:null`. No old boat was stopped or deleted.

Next: complete original browser support-file closure, including generated JSON
and vendor scripts, then use a newly authorized fresh runtime to obtain bound
original pixels before ordinary native menu input. This bounded assignment
ends at the demonstrated startup/admission failure.
