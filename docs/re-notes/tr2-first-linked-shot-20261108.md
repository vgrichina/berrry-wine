# TR2 first-shot consumer repair — 2026-11-08

Completed the assignment's permitted **substantive causal tested repair** before
allocation. No box, UUID, browser, original game or gameplay input was created.
The first linked original shot return remains unqualified. Evidence R:
`scratch/runs/20261108-tr2-first-linked-shot-2019/`.

The actual [1940 consumer](tr2-mapped-weapon-original-20261108.md) passed only
`weapon` to `observedHold`; even a command requesting `untilShot:true` silently
selected the default first-weapon-return behavior. The new exact-consumer test
reproduces that omission. The owned consumer now requires explicit
`actionObserver:true, weaponObserver:true, untilShot:true` for its sole requested
1900ms Control hold, forwards `weapon:true, untilShot:true`, and refuses missing,
false, numeric or string options before dispatch. Movement/orientation and combo
commands are refused. A consumed observation attempt, including UNKNOWN,
prevents any later input; capture and quit remain available. Tests observe the
actual dispatch block, rather than just testing a duplicate options object.

The inherited browser also used raw JSONL appends, raw Chrome stdout/stderr,
and a close path that could acknowledge cleanup without a terminal wait.
The owned adaptation directly imports the published gzip logger, readiness and
close helpers. Chrome uses pipes; every stored log append is a complete gzip
member. Cleanup joins actual Chrome terminal/stdio close and compressed-stream
EOF before profile removal or quit ACK. Failed drain retains UNKNOWN and the
profile. Concurrent close callers share one completion promise. Startup retains
its 30-second absolute subcap and reserves cleanup inside the immutable run cap.

Selected published provider hashes, independently checked against Git:

| Provider | SHA-256 |
| --- | --- |
| Observer, f1e9c852a | `d018d80647104c21538529d421b7e4ce24afd09c61be68470084bf5f90fe4b01` |
| Kernel, 252888061 | `e36d34990d738e616611ce8a8f4309548abcb751bd5ef5ec119d20e561c49360` |
| Command logger, 252888061 | `979b3a8bbd8625ef6bffb009650778736e20ade2d781918b83f59d9944c88f5e` |
| Readiness | `9ba9ae8b94ebd8a134045608074403d81f68d3cfdf6c0e3f9dbcb875e0632c1b` |
| Close | `1f4fe08b501ed27c90f4256e85574a788e7dd8adff60638f2c69d6a3ca2ea9b2` |

The newer published kernel is explicitly selected because d8573b542's
`5fb6488e…` lacks command-output gzip. No peer kernel/test/logger source was
edited. The launch checks selected provider hashes before importing the kernel
or forking. Positive selection passes; the old kernel hash is refused.
Both kernel journal and command compression are explicitly gzip. The adapted
exhaustive inventory/retrieval has no extension filter and checks transport and
decoded-original hashes, including the kernel command log.

Validation: 27 Node checks (nine own consumer/selection/readiness checks plus
18 shared helper checks), observer57, weapon150, three inventory/retrieval
checks, and `flock /tmp/wine-build.lock bash tools/build.sh` pass. Two actual
launch controls execute `/bin/true` and 262,173 bytes of binary stdout/stderr;
each has a prearmed independent observable seven-second PID/start watchdog.
Both retain complete kernel drain, actual supervisor/watchdog terminal waits0,
empty remaining/unreaped sets and an empty outer child set. Neither watchdog
fires. Gzip/EOF/original SHA and byte counts are independently verified; no raw
command log exists. These are local process controls, not Chrome or gameplay.
CLONE_UNTRACED and nonleader-exec limits remain; absence is not substituted for
an actual terminal wait. The locked build retains CPU
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.

R retains exact Git SHA, empty relevant tracked diff, small owned-input patches
and predecessor path/hash references. Media/modules are referenced by existing
path/hash. New test/build/browser-substitute/kernel logs are gzip from their
first stored bytes. No source-tree archive, media copy, old-run deletion,
peer-WIP edit, local Chrome, guest write/private call, configuration/backend/
binding/clock/seed change, public deployment or subworker occurred. Sampled home
free space stayed above 1.5GB; no continuous-floor or RAM-gate claim is made.

This is a tested small consumer repair, **not a completed remote provider closure
or staging/lifecycle integration**. A successor must finish that selection and
prearm the independent immutable 25-minute box watchdog before one idempotent
create, then qualify current graphics, owning WebGL2/module/HTTP authority and
review upright/full-health/drawn-pistol pixels before the sole Control hold.
The unchanged observer bounds remain2500ms/32 records with actual-retired and
caller-remainder guards. Stop at the first linked shot return, inspect its
poll/Action/full-input/caller-ESP/weapon/shot links and raw result/ammo/target/
health/readiness before any further action. `pendingWeapon:true` is expected
there; `pendingShot:false` is required. The five-cycle type2/zero-ammo fixture
return0 is not original production proof. The 1940 frame0→1 result remains
early readiness, not ineffective firing. No shot, aim, hit, kill or effective
firing claim follows from this repair.

Box **NONE / NOT_CREATED**, expiry NULL, stop receipt N/A. No old box was
resumed/deleted. Intel versus SystemInfo SwiftShader remains unresolved;
Full27/parity/audio/FPS remain open. Release owned paths and STOP.
