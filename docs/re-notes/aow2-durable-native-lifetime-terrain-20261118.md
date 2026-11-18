# AoWII durable native lifetime, 2026-11-18

Evidence: `scratch/runs/20261118-aow2-durable-native-lifetime-terrain/`.

The prior original's actual outer command was `exec_command` running
`bash -lc` and `node lifecycle.cjs run original`, with an initial 1000ms
yield and no explicit timeout argument. That Node process directly owned
native-supervise and its independent watchdog. Native-supervise used
`setpriv --pdeathsig KILL` and a detached process group for the native
controller, which owned Chrome and the driver. The configured native deadline
was 900 seconds and cleanup was 920 seconds. The command completed with 124
at 179.53 seconds; the supervisor recorded incoming SIGTERM before its own
deadline, while the watchdog recorded no trigger. These facts do not identify
the historical first sender. The driver label claiming watchdog SIGTERM is
not sender evidence. The old scope remains closed.

The AoWII launcher now detaches the receipt custodian from the submitter,
using the already established FoxBear/BloodII custody pattern. It retains
native-supervise containment, real PID/start-token/PGID identities, native
waits, both Chrome/driver pipe EOFs and the independent watchdog's actual wait.
The original's native deadline remains 900 seconds, independent cleanup
backstop 920 seconds, with 180 seconds reserved for ordinary reviewed Quit.
No native supervisor or kernel containment code is changed.

An authored browser/native WASM control reproduces loss when TERM reaches
the old supervisor-owning submitter: execution after the gate is lost, the
driver exits 124, and native-supervise records supervisor SIGTERM. In the
corrected controls both submitter TERM and KILL precede successful renderer
WASM execution and pixel readback. Separate controls kill the submitter before
the real authored x86 PE executes with genuine AoWII packages; both then
reach `Native VariantInit returned vt=0`, bind the exact older module and pass
their required transfer assessment. These controls prove protection against
the tested parent-signal mode, without claiming the unknown historical sender.

Transport oldfail/new32, retained ERR_ABORTED, native191, collector129 and
real negative controls are reused unchanged. The older coherent source graph
is `0a823095c` plus its retained patch, `81ad6c802` manager, `87ef39648` module
and 435 media pins; it is explicitly different from current main. The passive
Device7 observer, covering-red/narrow-strip and unchanged-memory controls are
also reused. No DLL, media, clock, registry or guest-state substitution occurs.

The single fresh original is permitted only after focused tests, the locked
build and publication of this lifecycle correction. Original results follow
in the final findings update; no terrain or army effect is claimed here.
