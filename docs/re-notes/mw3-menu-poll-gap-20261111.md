# MW3 menu polling boundary

The failed `20261111-mw3-ready-observed-throttle-0255` target delivered 16
trusted motions totaling `[-128,-23]`. Renderer coordinates changed from
`[320,240]` to `[192,217]`; the game's software cursor remained `[320,240]`.
All four completed mouse reads preceded motion. This establishes an absent
standard mouse-read stream during the target, with the recorder's existing
binding, capacity and entry/exit checks clean. It does not establish input loss.

The retained dispatch trace has 60,950 matched API entries/exits, four
`com:1093` entries and four mouse completions, zero non-mouse GetDeviceState
entries, four `com:2864` Poll calls and 14,509 `com:1094` GetDeviceData calls.
The old recorder did not decode callers/devices for GetDeviceData or record
game gates. Its aggregate categories have no interval timestamps. Consequently
the trace cannot identify what closed the original mouse polling path. The
active mouse reads themselves identify `this=0x082220a0`, type 7/deviceType 2,
standard relative size 16, state buffer `0x600f68`, caller `0x4fa56c`, HRESULT 0.

Static evidence comes from `mech3demo.exe`, SHA256
`df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc`:

- Dispatcher `0x4fa160` calls mouse wrapper `0x4fa500` only when byte
  `0x5fc8fe == 1` and unsigned word `0x5fc904 > 0`. Joystick and keyboard
  have separate flag/count pairs at `0x5fc8fd/0x5fc902` and
  `0x5fc8fc/0x5fc900`. Bit 2 of a flag suppresses its polling path even
  while bit 1 remains set. Routines `0x4fa040` and `0x4f9fe0` set/clear
  the mouse's bit 2; increment/decrement routines manage its word counter.
- Mouse routine `0x4fa510` checks the game's acquire flag `0x600f84`, may
  reacquire through `0x4fa450`, then calls the device stored at `0x600ac8`.
  Vtable offsets `0x64` and `0x24` call Poll and GetDeviceState, returning
  to `0x4fa55f` and `0x4fa56c`. A successful state read leads to
  `0x4fa640`, which scales/truncates relative deltas using
  `0x5b6d70/0x5b6d74` and updates/clamps `0x600f90/0x600f94`.
- Actual buffered keyboard code calls GetDeviceData at `0x4f76c5`, returning
  to `0x4f76c8`. Continued keyboard polling alone cannot prove the mouse
  gate stayed open. Cooperative flags `0x5b6d78 == 5` alone cannot prove it
  either. The original failure's flag/count/acquire values remain UNKNOWN.

`mw3-live-mouse-observation.cjs` now accepts an optional `decision` decoder.
`mw3-menu-poll-decision.cjs` supplies a read-only decoder for this exact game's
gates. It records DirectInput method, caller, device identity/type/flags and
mouse/keyboard gate values. A byte signature checks the authentic mouse gate
and its call instruction before sampling. Existing full media, module and
Worker identity checks remain necessary. Named and ordinal dispatch are covered.

Identical entry samples aggregate into a bounded map (default 64, maximum 256)
with count and first/last wall/monotonic timestamps. Overflow increments drops
and stops the recorder; decoder failures also stop it. The existing 45-second
ceiling, logging restoration, completion matching and input admission remain
unchanged. Entry samples are diagnostic evidence; they cannot authorize input
or substitute for completed reads. Aggregates expose observed gate states but
cannot reconstruct every transition's timing.

For the next separately authorized controller preparation, serialize `sample`
into its pre-instantiation Worker prefix, alongside `attachDispatch`, and pass
`decision: sample` in the existing `attachDispatch` options. Require
`snapshot.decisionEnabled === true`, retain `snapshot.decisions`, and preserve
the original Worker/module binding and all completion/drop/pending/error checks.
The old generated prefix must be regenerated and repinned; merely updating the
Node module cannot change its already embedded function. No original or new
box is authorized by these instructions.

The compiled regression runs byte-identical game dispatcher, mouse read/cursor
and buffered keyboard functions with synthetic objects, thunks and caller.
It verifies the full media SHA before taking these small read-only slices.
On the exact failed-run WASM and the current build, flag 1/count 1 polls both
devices; flag 3, flag 0 or zero count leaves keyboard polling active and mouse
reads absent. Shared physical deltas remain queued. Reopening only the game gate
restores actual completed reads and the authentic game's scaled cursor update.
This reproduces a causal mechanism; it does not assign that mechanism to the
unobserved original gate. No emulator or controller gameplay behavior was changed.

Evidence: `scratch/runs/20261111-mw3-menu-mouse-poll-gap-cause-0335/` retains
the raw failure, verified prior-path/source references, disassembly, exact Git
basis/patches, bounded-command actual waits and separate stream EOF. The next
missing prerequisite for a runtime repair is a same-identity gate/caller sample
during an actual gap. No timeout extension, replay or cockpit attempt follows
from the current evidence.
