# Independent legacy caps bootstrap review — 2026-10-20

Reviewed `7b6335dd8fb144d9533da603f2e42540db6a3d84`
(`origin/task/legacy-caps-early-exit-oct20`). Accept the fixture correction;
no blocking defect or production correction found. This review performs only
offline verification of saved execution evidence, with no build or runtime
repeat and no main integration.

The actual diff adds one functional call, `e.init_dx_com_thunks()`, immediately
after successful `load_pe`, plus read-only terminal/object observations and a
report. The PE generator, oracle and synthetic controls are byte-identical.
Canonical source `1262cbfcf8b5881543f2fb18c0f80b4bd9429306` calls the same helper
after PE loading in `host.js:3787` and `test/run.js:5482`. The fixture requires
the export directly, appropriate for its pinned module; normal launchers guard
the export for compatibility.

The generated initializer (`src/09b2-dispatch-table.generated.wat:22509`)
constructs real method tables, beginning with IDirectDraw's 23 slots at API
978. `init_com_vtable` (`src/09a8-handlers-directx.wat:1591`) allocates tables,
writes dispatch thunks and updates the shared registry. DirectDrawCreate
passes that initialized global to `dx_create_com_obj`, which writes lpVtbl.
This is ordinary runtime bootstrap, not fixture-specific result injection:
it does not write expected HRESULTs, descriptors, callback counts or oracle
records. Its heap allocation also explains the changed entry stack address.

The baseline observation has DirectDrawCreate success and object `0x08221000`
but lpVtbl/slot20 zero, terminal EIP zero, incomplete guest and untouched
record-four poison. Stack return address `0x403087` and the saved x86
`call [eax+0x50]` at `0x403081` support the null-target diagnosis. Poison is
not an API HRESULT. The corrected observation has vtable `0x41986c`,
slot20 `0x75001d8`, completion 1 and terminal ESP `baseEsp+4`.
The original oracle independently replays successfully on all 47 call
records, 45 descriptors, 55 guard pairs and callback counts 3/3/2/1.

Evidence identity:

| Item | Pin |
| --- | --- |
| Production module SHA-256 | `bc5412c1ba338ec5b385ff77eca1aa213c156cd5d0693e1cdcbf850867f7ecd4` |
| Unchanged guest PE SHA-256 | `3f9b8e369226c2c3dd88e47125b41b20f9f04f00a65ec65bdb7c4e7439224637` |
| Candidate fixture SHA-256 | `d017eabdf1798b48e17de9a237dc8810b0e8e39ca562ba9d433586019afbffd0` |

`scratch/runs/20261020-legacy-caps-bootstrap-review/{review.js,tests.json}`
preserves the independent replay recipe and receipt. It checks 35 existing
artifact/reference hashes (including actual saved module bytes), candidate
bytes against Git, all 6,441 staged-source OIDs against the canonical tree,
26 recorded host dependencies against canonical Git bytes, observation
addresses/metadata against the unchanged manifest, syntax, scoped diff, and
1,053 synthetic negative controls. All pass. The source manifest is a staged
subset of 6,898 Git entries; the 457 omitted entries include assets and notes,
but no `src/`, `lib/` or `host.js`. An initial overly broad reviewer assertion
that the staged manifest equaled the entire tree was corrected accordingly.
Historical pre/postflight receipts report unchanged remote sources and 29,620
prior files; this review does not independently rescan that remote filesystem.
Recorded execution is Node v24.18.1, one diagnostic and one corrected run.

Qualification is a real x86 public COM API fixture executed in the full pinned
emulator module with production host imports and `renderer:null`. It covers
public discovery/creation/QI, Device1/2/3 GetCaps at 172/204/252 bytes in aligned
and unaligned storage, fixed 236-byte Device7 descriptors, selected line and
triangle texture/filter/address masks, and live EnumDevices descriptor copies.
It is not a direct WAT helper-only test or Windows-native execution.

Remaining coverage gaps:

- Legacy 3/3/2 callbacks reach final HAL; cancellation there is indistinguishable
  from exhaustion. D3D7's first-of-two cancellation is discriminating.
- Only selected descriptor fields are asserted, not every captured word.
  Enumeration canaries protect copied buffers, not internal driver buffers;
  earlier software-device descriptors are not qualified by the final HAL copy.
- Release execution/stack cleanup is checked, not exact reference counts or
  complete lifetime correctness. Nonvolatile register preservation is not
  independently asserted by this oracle.
- No invalid-size/null/error matrix, cube allocation rejection, texture-format
  enumeration, mip storage, sampling, rendering, backend parity or gameplay
  qualification. Other modules/engines/browser workers remain unqualified.
- No screenshot, per-instruction trace or engine-native disassembly exists.
  The diagnostic uses block-boundary observations plus guest bytes/stack.

Reproduce only the offline review with
`node scratch/runs/20261020-legacy-caps-bootstrap-review/review.js`.
Its referenced evidence is `scratch/runs/20261020-legacy-caps-early-exit`;
that directory's `RECOVERY.md` pins reused module/helper/source dependencies
in the preceding native-run bundle. Keep these references together; no large
artifact was copied. Historical runtime commands are not rerun authorization.
