# MW3 buffered keyboard path — 2026-11-07

MW3's keyboard path is **buffered DirectInput `GetDeviceData`**, not the
`GetDeviceState` completion watched by the previous observer. Read-only PE
inspection identifies the keyboard device, format, buffer configuration and
game-loop calls. A focused regression now exercises that path through an actual
Node OS Worker, production Worker RPC, WAT handlers, renderer and host imports.
It preserves both Digit5 edges when release occurs before the first poll.

This repairs a diagnostic API/record-layout mismatch. It does **not** establish
an emulator input defect or recover consumption evidence for the earlier
UNKNOWN original pulse. No original was run, no box allocated or contacted,
and no guest trace, binding, setting, clock or memory was changed.

Evidence: `scratch/runs/20261107-mw3-keyboard-path/`. The previous original
remains in `scratch/runs/20261107-mw3-stable-runtime-gameplay/`; its logs and
initialized Worker identities were read, never modified.

## Static path in the retained executable

The existing `mech3demo.exe` is 1,844,224 bytes, SHA-256
`df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc`.
`static-path.py`, `static-path.json`, PE imports and disassembly excerpts retain
the checks. Addresses below are guest addresses in that exact executable,
not emulator region addresses or authorization to inject memory.

* `0x4f729f`: `CreateDevice` uses the GUID at `0x5986a8`, verified as
  `GUID_SysKeyboard`, and stores the device at `0x5fc90c`.
* `0x4f72bb`: cooperative flags `0x0a`; `0x4f72d5`: `DIPROP_BUFFERSIZE=128`;
  `0x4f72ed`: keyboard data format at `0x578990`; `0x4f7300`: Acquire.
  The format has 256 one-byte key objects, each offset equal to its DIK.
  Digit5 is object/offset **6**. The event array pointer is at `0x5fc910`.
* `0x46a9cc` calls input dispatcher `0x4fa160`. Its keyboard branch calls
  `0x4f7690` at `0x4fa1aa`, subject to the game's keyboard-enabled/count gates.
  `0x4f76c5` calls device vtable offset **0x28**, `GetDeviceData`, with
  **16-byte records**, request **128**, flags **0**; return **0x4f76c8**.
* A one-record drain at `0x4f7add` returns to **0x4f7ae0**. An initialization
  flush at `0x4f73fa` returns to **0x4f73fd**. These callers have different
  purposes; an initialization flush is not gameplay action evidence.
* The sole direct `GetKeyboardState` IAT call is `0x4f7c9c`, inside optional
  character conversion `0x4f7c30`, followed by `ToAscii`. It is not a frame-wide
  throttle-state poll. `GetAsyncKeyState` and `GetKeyState` are absent from the
  static imports. These are static findings, not a claim that every conditional
  branch executed in the retained cockpit.

Microsoft documents one buffered record per key transition, with the key's
format offset in `dwOfs` and press/release in bit `0x80` of `dwData`.
See [Buffered Keyboard Data](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416238(v=vs.85))
and [DIDEVICEOBJECTDATA](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416611(v=vs.85)).
The [Wine DirectInput header](https://github.com/wine-mirror/wine/blob/master/include/dinput.h)
also identifies the GUID and interface method order.

## Diagnostic correction and regression

`tools/mw3-keyboard-completion.js` decodes a verified **GetDeviceData** completion
after its 24-byte stdcall adjustment. It reads the returned count through
`pdwInOut` and four DWORDs per legacy record. It binds device, data/count
pointers, caller, keyboard kind/format and acquired state, bounds the count,
and rejects failure/overflow. Only successful consuming reads can establish an
ordered press/release pair; repeated peeks and mismatched devices cannot.

This is a decoder, **not an installed CDP observer**. Its caller must retain the
existing module/body/breakpoint, Worker owner, epoch and freshness checks before
calling it. It does not relax or replace any of the previous 18 identity fields.
Original instrumentation must identify executable completions in the actual
loaded module; source-order function indices are insufficient.

The old observer is pinned specifically to the GetDeviceState body and assumes
a 256-byte state array. `previous-observer-negative.log` demonstrates its
validator rejecting an actual production-path buffered result (`16 !== 256`);
the new decoder accepts and checks the same record semantics. The previous
original's zero keyboard and eleven other-device GetDeviceState completions
remain unchanged. They say nothing about buffered keyboard calls or returns.

`node test/test-mw3-buffered-keyboard-path.js` passed. Before DOWN it arms an
independent 60 ms UP timer. The real OS Worker polls only after both edges have
arrived: physical state is already zero, Win32 messages remain queued, but
buffered records contain `[6,128]` then `[6,0]`, with increasing sequences and
arrival timestamps. Repeated peeks preserve both records without qualifying as
consumption; partial consuming reads return each once, followed by empty.
Seven decoder negatives, missing-release, overflow, peek-only and different
device controls pass. The fixture uses synthetic device/stack memory and a
compiled production fragment with explicit trap-only unrelated dependencies;
it does not execute MW3 or a browser/render Worker, and provides no original
gameplay consumption claim. It does not repeat the GetDeviceState fixture as
proof.

The existing buffered-keyboard `--rpc` regression and actual OS Worker acquire
regression passed, as did test-tier validation. The mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` passed, including after the
last source change. The full built module remains SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`, matching the
retained original module. No emulator behavior was changed.

## Next boundary and custody

The next original diagnostic must observe **GetDeviceData**, starting passively
at normal caller `0x4f76c8`, and retain both the request and returned count,
HRESULT, device/format and returned records under current initialized identities.
First qualify that observer against the executing module and local production
Worker path. The retained UNKNOWN pulse must not be replayed. No new original
gameplay command is cleared by this task: original buffered returns are absent,
so neither a consumed throttle pulse nor an emulator blocker is demonstrated.
The concrete remaining blocker is installation/qualification of observation at
the identified buffered completion, followed by separately scoped original
evidence. Inferring an emulator fix from the old empty state observer would be
unsupported.

The evidence records the preparation Git SHA, relevant tracked/new-file binary
patches, hashes of referenced original logs/identities/module/media and focused
test/build logs. No source/media archive was made. An initial static check used
an incorrect GUID literal and was corrected against the executable and header;
an initial evidence-log parser tried to parse compiler banners as JSON and its
failure is retained before the successful filtered parse. Neither affected
production code or guest state. Sampled free space stayed above 2 GB.

No box was assigned to this worker. The predecessor's **bx_ga6esek2** was already
archived, with `archiveAfter:null` and retained-data expiry unknown in its saved
lifecycle record. This task performed no stop, delete, resume or other lifecycle
action; no box ownership is retained.

## Native16 render wait repair — 2026-11-10

Run `20261110-mw3-native16-loaded-poll-repair-0040` isolates the later loaded
failure in `20261110-mw3-direct-firefly-consequence-0020`: its 3822.65 ms real
render wait spanned the unchanged two-second Space hold. Native16 storage took
3064.92 ms over 2048 conversions; both buffered edges were consumed after UP.
The input queue retained the edges correctly, but the compiled guest could not
poll while its render completion was outstanding.

Large unblended full-color native16 draws now submit ordered groups of at most
32 primitives, with a full native conversion and real GL error check after
each group. With blending disabled, fragment operations do not read destination
color, so conversion commutes with later replacements, including overlaps,
depth rejection, alpha testing and fog. Full stores also normalize untouched
clear pixels. Blended, masked and small draws retain per-primitive conversion.
An error stops submission at the failing storage boundary; a grouped draw does
not promise a particular partially rendered image after a GL failure.

The original e18abd221 native16 test passed unchanged before extension (96
exact DIB/RGBA snapshots and real GL failure checks). The extended test also
compares 128 snapshots against that exact Git control, including 67-primitive
tails, textured alpha/fog, clipping, subsequent blending and a real error at
the third grouped storage boundary. Run it with
`NATIVE16_LARGE=1 NATIVE16_CONTROL=e18abd221 CHROME=... node test/test-d3dim-native16-storage-web.js`.
Native point pixels and focused renderer/device/keyboard tests passed, as did
the locked build.
The separate NFS roof-edge browser test fails on both the candidate and the
exact e18abd221 source with the same `65535 !== 0` top-edge assertion; its
two-triangle blended draw never enters this repair's grouped path. That
preexisting failure is retained, not counted as a passing renderer check.

One private box, `bx_2du7xk6x`, ran normal, exact-e18 loaded and repaired loaded
controls with the same 2048-triangle workload and independent two-second UP.
Actual loaded render waits were 1335.14 ms before and 942.855 ms after; draw
submission elapsed was 1208 ms before and 249 ms after, with 2048 versus 64
stores. The compiled repaired poll returned `[57,128]` before UP; normal polls
also consumed the press during the hold. The DIB SHA-256 for both versions
and the earlier failing trace is
`ecd459a013d9599b8b91c356abc9274a1aa422a0ace82f81bf2fc6199f83aae8`.
The full compiled module remained SHA-256
`75ecda5701c15f6fe2c269455ead4e15457b90653733df15d35674b08e8849d5`.

The fresh baseline was faster than the previous box and did not reproduce
exclusion for the entire hold. These results prove the causal storage-work
reduction and actual in-hold polling on the measured normal/loaded controls;
they do not establish an upper latency bound under arbitrary host contention
or original MW3 gameplay. No original game, guest edit or fabricated poll ran.
The inherited normal harness initially rejected a valid poll that began after
trusted DOWN but before its CDP acknowledgement; the corrected harness uses
the actual trusted event timestamp, preserving the hold and consumption checks.

All 37 recovered artifact mappings were independently reread and SHA-verified
before delegated normal shutdown and rehashed after archive. The deadline
watchdog was armed before allocation. Box state is archived, expiry null;
`stop_01eae3e82195d507` completed at 2026-11-10T23:30:25.022Z, forced false,
error null. No box is retained. Exact patches, small inputs, actual parent
waits/EOF, before/after timing and pixel evidence are in the owned run.
