# Mad Bomber WinMM error-text source review — 2026-10-20

Task: `MADBOMBER-WINMM-ERROR-TEXT-20261019`.

The implementation is already present in fetched main
`d3c332ab8f186564db28226f6484a95be8ae1674`, introduced there as `7fd352855`.
Its host implementation, WAT handlers and two tests are byte-identical to
preserved WIP `a3f67fc5b6638a8ff420a463fab88d124397a008`. No source defect was
found in this bounded review; no production code was changed or merged.
The original `/tmp/wa-setlocaltime-oct19` worktree remains clean at that WIP.

This review used a fresh file-only sparse worktree at
`/tmp/wa-wave-error-text-oct20`, branch `task/wave-error-text-review-oct20`,
under 5 MB. Shared HEAD/index and unrelated laptop work were not edited.
No workers, builds, guest execution, browser, remote sandbox operations or
configuration probes were used.

## Contract and source review

[Microsoft's waveOutGetErrorText documentation](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-waveoutgeterrortext)
specifies character capacity, truncated NUL-terminated descriptions, successful
zero-capacity no-op, and `MMSYSERR_BADERRNUM` for out-of-range codes.
It does not prescribe exact English wording. The implementation supplies
English descriptions for common `MMSYSERR` 0–21 and `WAVERR` 32–35,
all below `MAXERRORLENGTH` (256). A writes single-byte ASCII; W writes
UTF-16LE. Truncation reserves one character for NUL; capacity 1 writes only
NUL. Unknown codes return 9 without changing output. A non-null output with
capacity zero returns 0 even for an unknown code.

Null output returns `MMSYSERR_INVALPARAM` (11), including capacity zero.
This precedence follows the
[Wine implementation](https://github.com/wine-mirror/wine/blob/master/dlls/winmm/waveform.c),
not an explicit Microsoft guarantee for invalid pointers. The host also rejects
a written prefix outside its ArrayBuffer without partial writes. This is a
host-pointer bounds check, **not** proof that arbitrary non-null invalid guest
pointers return 11: guest accessibility remains the existing translator's
responsibility. This review does not introduce a new guest pointer policy.
Exact localized Windows resource wording is not implemented or claimed.

The actual host contract is `createHostImports` spreading
`createAudioHost(ctx, shared).imports`. `wave_error_text` is synchronous, reads
`ctx.getMemory()` only when writing, and uses the existing optional
`ctx.exports.page_watch_write` notification convention. It neither opens a
voice nor invokes device playback. Internal mode 2 returns the needed character
count without a buffer; WAT limits the gathered span to the smaller of that
count and the unsigned caller capacity, then scales by 1/2 for A/W. Consequently
`UINT_MAX` capacity does not cause a huge copy or overflow.

`guest_span_in` provides either direct storage or a gathered noncontiguous
span; `guest_span_writeback` scatters and releases the latter and notifies
writes for the direct case. The handler pairs these operations. Both handlers
return MMRESULT in EAX and pop the return address plus three stdcall arguments
(16 bytes). They contain no LastError setter. Actual compiled dispatch,
noncontiguous writeback, LastError and stack behavior still require full-VM
validation.

Both API entries remain at **4590/4591**, three arguments, stdcall. Main has
4593 entries versus WIP's 4592; the entire WIP prefix is unchanged. Dispatch,
hashes and import signature mirrors are current. Nothing was renumbered or
regenerated.

## Evidence and checks

Self-contained evidence:
`scratch/runs/20261020-madbomber-wave-error-text-review/`.
`receipt.json`, `verification.log`, `source-identities.json`,
`source-review.txt`, `verify.js`, copied full-VM test, prior caller note and
prior original output are retained there with `SHA256SUMS.json`.
Artifact references are local to that folder. No screenshot or gameplay result
is inferred from source tests.

Passed:

- Existing `node test/test-wave-error-text.js`: real host A/W descriptions,
  recognized/unknown ranges, truncation, NUL, canaries and unsigned capacities.
- Additional 48 real-host cases: null/zero precedence without memory access,
  exact-end writes, overflow rejection without mutation, signed Wasm `-1`
  capacity, whole-buffer comparison and unchanged voice map.
- `node tools/gen_dispatch.js --check`.
- `node tools/gen_api_table.js --check`.
- `node tools/check-api-table.js --base=d3c332ab8f186564db28226f6484a95be8ae1674`.
- Repository `gen-host-import-sigs.js --check`, executed unchanged with
  read-only `git show` backing for manifest source reads to avoid checking out
  broad directories: all 284 signatures current.
- `node --check test/test-wave-error-text-native.js` and `git diff --check`.

Reproduce the additional checks with
`node scratch/runs/20261020-madbomber-wave-error-text-review/verify.js CHECKOUT`.
It requires this repository's Git objects and the selected source files;
it compiles or executes no Wasm. The existing host test and generator checks
also run directly in a normal checkout.

## Remaining prerequisite and stopping point

`test/test-wave-error-text-native.js` is preserved unchanged and has **not**
been executed in this task. A newly authorized runtime with sufficient disk and
memory must first build the exact reviewed source using `bash tools/build.sh`,
retain the source manifest and resulting module SHA-256, and run:

```sh
node test/test-wave-error-text-native.js --wasm=build/wine-assembly.wasm --sha256=EXACT_MODULE_SHA256
```

The harness uses the real production module and host imports, public
LoadLibrary/GetProcAddress, distinct A/W thunks, stdcall cleanup, LastError,
valid/unknown errors, capacities through UINT_MAX, null buffers and split
noncontiguous guest pages. Its fixture uses a 512-MB shared memory; unsupported
engine features or fixture failures must be reported, not replaced with mocks.
A normal build must pass its full source gates; this sparse review is not a
substitute.

Only after that qualification may the coordinator separately authorize an
original Mad Bomber observation with complete original assets and boot closure.
The prior observation (`f75d53311`; copied note/log in this evidence folder)
showed original CRT DllMain returning 1 but SDL returning 0 after the missing
waveOutGetErrorTextA lookup. It did not establish gameplay. No diagnosis or
original run was repeated here.

The stopped `bx_b7sxrkh9` resume-403 restriction remains untouched. No retry,
credentials or alternate route was attempted. Current source is review-ready;
compiled/full-VM compatibility and original SDL progression remain unvalidated.
