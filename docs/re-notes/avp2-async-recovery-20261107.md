# AVP2 asynchronous key recovery

Evidence: `scratch/runs/20261107-avp2-async-recovery/` (ignored).

Recovered the interrupted `avp2-async-world-2154` edits. Its retained event
stream ends after launching the local Worker regression and focused tests;
there is no allocation or original boot command, allocation artifact, result,
final message or release. The before/after local Chrome and driver PIDs and
ports are absent/closed, and the predecessor board watcher is absent.
`predecessor-lifecycle.json` and `predecessor-cleanup-audit.json` record this
audit. The reported launcher/session termination was 143. No retained signal
sender audit identifies its cause, or proves a cross-group SIGTERM. The
launcher has no kill instruction. The inspected Puppeteer cleanup targets its
owned browser PID group with SIGKILL, which does not establish the SIGTERM
sender. Historical process-group membership is unknown.

The production guest Worker regression executes ordinary x86 imports of
GetAsyncKeyState through the shipped host/Worker path. Before repair, trusted
Enter DOWN/UP with an undrained queue produced `0x8001, 0x8000`, despite physical
release. After repair, that case and the drained case produce `1, 0`; a held
key produces `0x8001, 0x8000`. The low bit remains a pressed-since-query latch,
consumed once. GetAsyncKeyState now reads the existing physical key state for
its high bit, independently of the queued message snapshot. Message ordering,
modifier ownership, physical reset and per-query consumption remain covered
by the focused 55 tests. The reviewed host-file census seal was refreshed;
callback ownership remains pending.

The permanent browser regression records PID, parent, process group, session
and start ticks and checks that Chrome owns a distinct cleanup group. Runs
are launched in detached, precisely owned sessions; no substring/group kill
of shared processes is used. A new locked build attempt stalled after the
region allocator printed success. Its exact Node PID 2738355 was waiting in
shutdown futexes; retained strace records this without attributing the earlier
worker interruptions. Only that verified owned PID received SIGKILL and the
build was rejected. The allocator exits normally with `--v8-pool-size=1`;
the complete locked build is rerun with that host-tool option.

Run controller release checks retain trusted DOWN/UP, independent UP, owner
identity and sticky UNKNOWN. They retain `_asyncKeys` as diagnostic message
state and use the non-consuming physical high-bit accessor for release.
Neither an unconsumed low bit nor an older queued message means physical hold.
The qualified Gate, independent-UP and entry-identity helpers remain unchanged.

Retained original captures show mission selection and black/white loading
shapes, without recognizable Marine world or proved movement/attack. Draw
submission, native rendering and fences alone do not explain those pixels.
No rendering change is justified by those captures alone.
