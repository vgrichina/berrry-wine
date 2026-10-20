# Army Men paired observer ABI correction

Bounded diagnostic change from origin/main
`8580f3aac0fac2b15e932c931620e0491d86b8a8`.
No emulator, renderer, generated API table, original game, runtime or build
changes. No merge to main. Native paired capture remains pending.

The actual original run reported by
`7cf6ab2a9a7338f5db37ab4d4fdec3b0529eb8fd` reached Boot Camp with all
419 nonplaceholder file hashes verified, but rejected eight pixel records.
Its 24 underlying API records contain five arguments, ESP delta28, expected
delta24, unchanged dispatch EIP, yieldReason0 and raw EAX0.
No surface dimensions, pitch, RECT contents or pre/post pixels were captured.

The original call bytes at 0x4074f1 (ret 0x407506), already documented in
`army-men-paired-observer-20261020.md`, push flags0x10, RECT, source, y, x,
and destination **this**. COM stdcall therefore has six stack arguments.
The WAT `handle_IDirectDrawSurface_BltFast` reads flags from ESP+24 and
cleans 28 bytes including the return address. Its five argument parameters
plus `name_ptr` are an internal handler signature, not the guest COM ABI.
The generated table's nargs5 is unsuitable for this observer.

`tools/army-bltfast-observer.js` now passes an explicit, nonmutating
six-word/stdcall diagnostic metadata copy to the owning observer, and uses
the same ABI for adapter validation. It reports both tableNargs and effective
ABI. Unexpected metadata (missing/duplicate row, different convention, counts
other than legacy5 or corrected6) fails closed. This deliberately leaves the
production table/generator untouched; correcting those globally needs separate
dispatch review. ESP must still advance28, EIP must remain unchanged and
yieldReason must be zero. Pixel and nesting validation are unchanged.

The old fixture supplied a fabricated nargs6 row, masking the bug.
The pixel suite now loads the real repository table. It covers ordinary
overlapping copy, 8/16/24/32-bit pitched samples, missing/wrong return cleanup,
failed HRESULT, changed surface, invalid bounds/backing/pitch, nested calls,
nesting beyond the eight-pair quota and repeated calls. Reverting the adapter
to the original version makes the ordinary fixture fail at acceptance.

`tools/fixtures/army-original-bltfast-20261020.json` is the byte-identical
original paired.json, SHA-256
`4f41d0b3a54de1c33829188449d05a1c8e6f445594050c89f19256aab62cd6ca`.
The captured ABI test replays all24 records' CPU and partial stack metadata:
legacy nargs5 fails28-vs24; corrected nargs6 fails without the missing word;
adding the explicitly **code-inferred**, not captured, flags0x10 permits ABI
pairing; a24-byte cleanup still fails. Adapter replay still rejects absent
surface memory and supplies no pixels. This is not a new game capture or
evidence that any actual pixels copied correctly.

Source-only commands:

```
node tools/army-bltfast-observer.test.js
node tools/army-bltfast-captured-abi.test.js
node tools/army-bltfast-preload.test.js
node tools/jig-owning-api-observer.test.js
git diff --check
```

## Bounded tracing for a separately assigned capture

Supersede the earlier broad trace recipe. Keep the reviewed ordinary input,
matching source/module/region map, unique output, controller log/storage cap,
90-second and750-batch bounds, but replace the API trace argument with:

```
--quiet-api --no-threads --trace-api=__army_bltfast_observer_only__
```

This sentinel matches no API name in the table. In test/run.js, TRACE_API
keeps `apiLogOff` false and installs log_api_exit, while TRACE_API_FILTER
prevents per-API text formatting. The observer selects BltFast independently
by resolved ID and return address. It retains at most eight pixel calls,
24 raw calls and256KiB serialized output. Do not use --trace-api-paused:
that disables dispatch hooks until explicitly enabled. The sentinel bounds
API trace text to zero; unrelated runner logs still require the controller
cap. Source predicates were checked; no runtime log-volume claim is made.

Self-contained replay/source evidence and the remote commit receipt are in
`scratch/runs/20261020-army-observer-abi-fix`. Initial corruption remains
unknown; terrain-stripe causality, native COM/full-VM and actual pre/post pixel
capture remain pending a separate runtime assignment.
