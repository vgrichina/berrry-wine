# Quake II passive sparse binding reader, 0505

The passive reader now covers the actual0450 binding pointer topology without
raising its direct ceiling. Production changes are confined to
`tools/quake2-passive-attack.cjs` and its focused test. Evidence is in
`scratch/runs/20261109-quake2-passive-sparse-bindings-0505/` (R).

## Cause and read contract

Read the [0450 note](quake2-persistent-native-combat-0450-20261109.md) and
retained `review/startup-binding.json`. Its pointers are Enter=`0x08ff1a10`,
Control=`0x08ff1f30`, Mouse1=`0x08ff1630`, all in guest page `0x08ff1`.
The old reader rejected all three before reading their bytes because
`va+128 > 0x04000000`. Their image-relative linear candidates also exceed the
CPU's actual direct window: sparse translation is required, rather than a
larger direct check or VA-as-offset.

`src/03-registers.wat` supplies the contract: `$g2w_slow` uses
`$guest_page_translate` after the direct and DIB cases miss. An atomic i32 PTE
at `GUEST_PAGE_TABLE + 4*(va>>>12)` carries PRESENT=`0x800`, PAGE_* in bits0..10,
and the backing page in bits12..31. Publication, clear and protect are atomic.
`lib/mem-utils.js` corroborates this translation and warns that adjacent guest
pages can have noncontiguous backings. Allocation/query records are not a
fallback translation mechanism. Neither reference implementation was edited.

The observer constructs its table view from the exact admitted process's
shared memory buffer, requiring the complete table within that buffer.
It follows each crossed page separately, over the complete bounded128-byte
candidate span, before applying the existing printable-ASCII/NUL policy.
PRESENT is mandatory. Readable private PAGE_READONLY/READWRITE/
EXECUTE_READ/EXECUTE_READWRITE, optionally NOCACHE, are accepted; guard,
NOACCESS, execute-only and malformed protections are UNKNOWN. Each entire
backing page must fit both the owning buffer and the pinned sparse backing
arena `[0x08000000,0x1a000000)`. Emulator-private/cache/table/DIB/RPC backing,
extensions outside this supported arena, missing pages and wrapped guest
ranges are UNKNOWN. The unsupported portion of the CPU's larger direct window
and spans overlapping its DIB special case stay UNKNOWN.

The seven canonical EXE windows remain mandatory and are rechecked. Process,
endpoint, Worker, module, renderer, canvas, memory wrapper and buffer identity
are checked before/after sampling. The reader compares two binding-pointer/
decoded-string samples and two five-word latch samples, retaining and finally
rechecking every observed PTE including protection bits. Observed changes or
mixed invalid bindings make the overall row UNKNOWN. The wrapper now pins the
first identified memory even when its binding result is UNKNOWN, preventing
a later replacement from repairing custody. The page table is never sourced
from a page global or another process's cached table.

This is a point sample with consistency checks, not an atomic transaction or
proof excluding undetected ABA between samples. Native source lifetime remains
REVOKED; all-writers and edict ABA remain UNKNOWN. Latch equality proves neither
event consumption, usercmd execution nor weapon effect. No RPC, CPU export,
guest write, rebinding, mapping change, browser, box, original or deployment
was used. Shared custody, caller, Warcraft and Super code were untouched.

## Regressions and validation

`comparison.json` and `comparison.log` run the actual historical reader from
Git base `78af6db8b288191abc6da6408815a8e6d59b3a5c` and the new production
reader against the same canonical-window/owner fixture, using the exact
retained pointers. OldFAIL: all three texts null with the direct-window
UNKNOWN. NewPASS: authored strings decode through an owning PTE whose backing
differs from both VA and image-relative offset. The retained sample contains
no decoded strings or PTEs: the test does not recover or assert actual0450
binding contents. Fixture backings and text are explicitly authored.

The focused test passes noncontiguous cross-page strings; an unmapped second
page even after an early NUL; invalid/unreadable protections; all private/
out-of-buffer backing controls; changed translations and permissions between
samples and at final PTE validation; pointer/string/owner races; stale table
globals; actual memory replacement after a valid or UNKNOWN first sample;
unchanged direct limits; DIB overlap and address overflow; all seven canonical
windows; existing owner/memory negatives; bounded ASCII/NUL; and a complete
before/after shared-buffer SHA proving zero reader writes. Offsets also agree
with the actual JS translator. Existing composed capture/progress decoration,
strict startup source and physical-UP failure controls pass.

Commands: `node tools/quake2-passive-attack.test.cjs`, R/`compare.cjs`,
`node tools/quake2-native-driver-composition.test.cjs R/composed-fixtures`, and
`flock /tmp/wine-build.lock bash tools/build.sh`. All pass. The composed-driver
test runs eleven Node-only close/input/cancellation scenarios, with no Chrome
or game. An initial invocation omitted its required output-directory argument;
that routine offline error was corrected and the full assignment continued.
An existing test's invalid-pointer mutation was restored before its later
valid-snapshot assertion, consistent with the new fail-closed overall status.

The final build is still CPU SHA256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
2,185,596 bytes. Published custody remains
`4341b87723a7d56bc98223215cca4cdc878fcae2`, checked against its retained
SHA/size; no custody or cap changes were needed. Strict all-caps observation
flags, zero-entry startup gates and existing work/ACK/close/hold/freshness caps
remain unchanged.

R holds the exact Git base plus a small owned-file binary diff (including this
new note), stored SHA/sizes and gzip CRC verification. Referenced media/modules
stay at existing paths; no source archive or repeated media/module is stored.
Free /home remained above1.5GB. Box ID=null, state=NOT_CREATED, expiry=null,
stop receipt=null; no box watchdog or lifecycle action was needed offline.
Next is a separately authorized fresh original to sample its actual PTEs and
bindings. This task stops after authenticated publication on main.
