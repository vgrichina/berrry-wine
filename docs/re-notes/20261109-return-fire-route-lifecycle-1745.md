# Return Fire: A1 flag route and detached box lifecycle

Offline run: `scratch/runs/20261109-return-fire-route-lifecycle-1745/`.
No Chrome, gameplay, box API, allocation, guest writes or workers were used.
The November 9 objective1727 supervisor exit143/missing joins remains **FAILED**.

## Concrete destination from shipped originals

The retained `objective1727/retrieved/original/bunker-map.png` matches **A1.WRL**.
This is a static inference from the original pixels, not a guest filename trace:
the 128×128 map begins at screenshot `(257,152)`; assigning the modal RGB to
each WRL tile leaves **12 pixel exceptions** of 16,384. Best other-world fits:
B1 242, A2 338, B2 338. Neighboring alignment controls are worse. The twelve
exceptions are the four surrounding green target-marker pixels and eight surrounding
home-marker pixels. `route-analysis.cjs/json` retain the calculation and hashes
of the original map, help, EXE and all four worlds. `map-4x.png` is a nearest
neighbor inspection crop; the original remains in its existing location.

Coordinates below are zero-based tiles, x east/right, y south/down:

| Location | Tile | Original-data meaning |
| --- | --- | --- |
| Home `(47,66)` | 57 | Loader entry `[90,0,0,1]`, bunker registration callback 1, player index 0 |
| Target `(55,56)` | 220 | Loader entry `[0,22,1,2]`, **BNO_FLAG**, owner index 1, flag registration callback 2 |
| Other building `(40,46)` | 201 | BNO_BLDG_S, owner 1; no flag claim |
| Northwest `(35,55)`, `(45,39)` | 215 | BNO_WTOWER_NE, owner 1 |
| West `(36,55)` | 205 | BNO_BNKR_S, owner 1 |

These names come from the shipped executable, not building appearance. In
original DEMO.EXE (SHA-256 `b3407ec82d5e8d181116d2bb7a4998ff180773f3b6f91e98e7156979f3859a63`),
`0x4049b0` loads the WRL. Width/height are header words +8/+10, and the tile
offset is header dword +0x48 (`80`). `0x404af2` indexes the four-byte table at
VA `0x464960` by tile. `0x404b13–2d` creates its named building; byte 2 becomes
the fourth argument to `0x40cb40`, which writes owner bits 14–15. Building
records at `0x463578` have stride 56; record 22 points to `BNO_FLAG` at
`0x4650f8`. Byte 3 dispatches through `0x464d20`; callback 2 (`0x404860`)
registers flag-building candidates by owner. A1 has exactly one such entry.
The retained narrow disassemblies and analysis assertions cover this chain.
These are original PE VAs, not emulator memory addresses.

## Next original assignment route

1. In the bunker press **J** and compare the fresh map with A1. Home marker
   center is `(47,66)`; the flag building is **8 tiles east, 10 north**, at
   `(55,56)`, screenshot `(312,208)` in the retained original. Reconcile any
   different map before moving. The roadside building's appearance alone
   supplies no identity.
2. Choose tank/ASV for the attack. A road route is `(47,66) → (47,68) →
   (50,68) → (50,58) → (55,58) → (55,56)`: south to the lower road, east to
   its vertical spine, north to its upper intersection, then east and north.
   Those road tiles are present in A1; vehicle clearance is still untested.
   Alternatively the helicopter can take the short northeast inland route.
   Use reviewed captures/radar and bounded inputs at each waypoint; no timed
   coastal search or open-water extrapolation. Check vehicle information/control
   mode because the help distinguishes screen-direction and vehicle-relative
   movement. WASD and H ground fire are shipped controls.
3. Attack the source-identified flag building and capture the actual exposure
   consequence. Return over the bunker and press a fire key when its light
   comes on. Deploy the **jeep** only after flag exposure: the shipped help
   specifies jeep retrieval and its green/chiming enemy-flag direction beacon,
   with red pointing home. Retrieve and return the exposed flag through ordinary
   controls. Destruction, exposure, pickup and return remain gameplay proof to
   obtain; none occurred in this offline task.

RFIRE.HLP's Land Navigation says the bunker map includes all flag buildings,
turrets and discovered flags; its full map is available only in the bunker.
The help warns against leaving the assigned sector. The fresh read-only decode
is retained as `help-text.txt`.

## Production lifecycle entry and use

`tools/return-fire-native-lifecycle.py` replaces the run-local 1727 supervisor
launch. The old `lifecycle.py` actually started its supervisor inside a tool
session; both delegates inherited that session. The new `arm` command starts
a supervisor with `start_new_session=True` and regular-file stdio, and that
supervisor starts the sole normal-stop/deadline delegate in another session.
The caller waits until both identities and independent delegate readiness are
observable. There is no new generic lifecycle framework and no browser code
change. The existing native-deadline-watchdog's detached launch, immutable
in-memory deadline, monotonic cap and write-once records informed this entry;
that watchdog alone covers driver/Chrome, not box stop.

For the next separately authorized runtime, with absolute run directory `$R`:

```sh
python3 -B tools/return-fire-native-lifecycle.py arm "$R" "$R/remote.py" DEADLINE_EPOCH
python3 -B tools/return-fire-native-lifecycle.py status "$R" UUID
# Create exactly one new box using the returned UUID as its idempotency key.
# boat-created.json must include idempotencyKey: UUID, shutdownDelegated: true,
# and box.id (plus returned expiry metadata). The entry does not create boxes.
python3 -B tools/return-fire-native-lifecycle.py bind "$R" UUID "$R/boat-created.json"
# Only after unique remote evidence has been retrieved:
python3 -B tools/return-fire-native-lifecycle.py complete "$R" UUID "$R/retrieval-final-verification.json"
python3 -B tools/return-fire-native-lifecycle.py join "$R" UUID
```

Supply the original absolute deadline, no later than 25 minutes from arming
and no later than the allocation's requested expiry. Never re-arm the same run
or extend a deadline. Allocation UUID/delegation must match before binding;
`status` exposes PID/start ticks/boot ID/session, configuration hash and the
frozen wall/monotonic deadlines. Configuration/bound-ID mutations are refused
while the original in-memory deadline and box remain in force. Use a fresh
run's `remote.py` exposing the same bounded `t.access.api/sanitized` interface
as 1727; no preexisting box should be bound.

`complete` replaces the old `verify-and-stop.py`: it independently rereads every
manifest artifact for containment, size and SHA-256, then creates a UUID-bound
normal request. The sole delegate handles both completion and expiration and
issues one normal `POST sandboxes/ID/stop`, never force-stop, resume or delete.
The durable exclusive stop-attempt and flock prevent duplicate attempts; an
uncertain API error remains FAILED and is not retried. Confirmation requires
an API archived/stopped state; stop result and final state are retained.

`watchdog-terminal.json` is the delegate's own outcome.
`watchdog-reaped.json` is written only by its actual parent after `communicate`
has observed **waitpid and both stdout/stderr EOFs**. `supervisor-terminal.json`
records the supervisor's completed child join. The `join` CLI observes these
records and requires successful stop/child exit; it does not claim a waitpid
on the already detached supervisor. SIGTERM/HUP/INT do not forward to the
delegate. Supervisor SIGKILL cannot write a terminal/join record, but also
cannot kill its independent delegate: expiration still performs the stop.
That degraded case must report missing supervisor records, never fabricate a
historical join. Killing the watchdog itself or an enclosing cgroup is outside
the demonstrated survival scope; this offline test does not qualify a live box.

## Validation and remaining scope

The focused test launches the actual entry in real sessions and kills the
launcher process group. A fake API records every method/path. Cases cover
expiry after launcher death, verified completion with supervisor SIGTERM and
actual child reap/EOF, supervisor SIGKILL with deadline survival, wrong UUID,
duplicate binding, corrupt evidence refusal, immutable deadline/UUID and bound
ID mutation, wrong request UUID, and uncertain API failure without retry.
The SIGKILL case explicitly asserts absence of supervisor terminal/reap records.
All real test delegates terminate; no runtime box is created.

An additional actual tool-session check prearmed/bound this production entry
against the fake API, then terminated the launching tool's real session group.
The tool returned **143**. Its independent delegate subsequently expired,
performed exactly one normal stop, and supplied successful terminal, actual
reap and both EOF records through the surviving supervisor. These are fresh
records in `actual-tool-session/validation.json`, not replacements for 1727.
All six focused scenarios and `flock /tmp/wine-build.lock bash tools/build.sh`
passed; full build output is retained as `build.log`.

Evidence records Git base plus small patches, not source/media archives.
Historical failed143 remains FAILED. Next is the separately assigned original
gameplay attempt along the A1 route, using this fresh lifecycle and its genuine
stop/terminal/reap/EOF records. Box ID/state/expiry/stop receipt for this task:
**NOT_CREATED / N/A / N/A / N/A**.
