# Golf: one reviewed original deal, 2026-11-14

Route: `lib/apps.js` registered `golf`, using the existing local
`test/binaries/entertainment-pack/golf.exe` (23,824 bytes,
SHA-256 `498937a1379c613a50735ca3ed49e4b09c81596f7540abc92499c981fcd550f9`)
and `cards.dll` (157,456 bytes,
SHA-256 `38caf8318e9a11f1f1d323a4b20544c76a2a6b29827aaf5ea178caed837f19e0`).
The registry declares exactly that DLL and no extra files, with cooperative
runSlice 25000 / compat 100. No media download or replacement is involved.

## Rules reviewed before gameplay

The local native EXE is the rules authority. Its static function at
`0x010023f0` first checks that the selected tableau column is nonempty
(`0x010023f9`–`0x01002426`). At `0x0100242b`–`0x01002478`, it masks
the waste card's suit bits with `0xfffffffc` and rejects rank encoding
`0x30`, using native string resource 1002, “Can't play card on King”.
At `0x0100247d`–`0x010024bb`, it shifts both card encodings right two,
takes each remainder modulo 13, and requires the absolute rank difference
to equal one. Failure uses resource 1003, “Not adjacent to card on pile”.
The acceptance branch starts at `0x010024f4`; an actual removal advances
the waste and decrements the selected column's exposed-card index.

Thus there is no Ace/King wrap. King blocks subsequent tableau removals;
ordinary stock draws remain the way to replace the waste. This inspection
does not read live card memory, a deal seed, or any hidden card. Full static
disassembly is retained in the run directory. Ranks and legal choices during
the original are to be read personally from each fresh complete scene.

## Controller and evidence

`tools/golf-controller.py` supplies one mouse click per invocation, a permanent
PID/start/window owner, fresh complete scene reviews (5 seconds for removal
or stock, 30 seconds for menus), one optional ordinary bootstrap Start, and an
irreversible 180-second Quit reserve. Each click independently prearms a
1750ms fallback UP, accepts a finite pulse at most 1500ms, checks the exact
nonce/owner/epoch receipt, and waits for release before audit or capture.
UNKNOWN, mixed identity, cancellation, child death and late ACK are terminal.
No solver, card recognition, move generation, action queue or private deal
inspection is included. Synthetic tests establish transport behavior only.

Run evidence: `scratch/runs/20261114-golf-reviewed-outcome/`. All 17 policy,
9 HTTP and 10 actual CLI controls passed. These include real endpoint
UNKNOWN after a consumed click and dropped reply, cancellation, replaced
window identity, late ACK, child death before DOWN, parent death, independent
1750ms fallback, stock click release, and capture only after UP. The initial
CLI fixture duration was incompatible with the reserve guard and failed before
input; the fixture recipe was corrected to 240 seconds without weakening the
guard. Failed fixtures have actual native/watchdog/supervisor waits and both
EOFs; their unjoined ancillary wrapper waits remain unknown. The successful
rerun joins its wrappers too. Orphan release-child waits in parent-death tests
remain explicitly unknown.

SkiFree's native/watchdog/supervisor waits were all zero with both EOFs and
released heavy ownership. The GL lifetime original has native exit 1,
watchdog/supervisor zero, both EOFs, released heavy ownership and absent exact
PIDs; this is termination evidence, not successful GL gameplay. ThreadSentinel
`9b8b7f3f` was source-ready with explicit no-original. The sole Golf original
follows those predecessors, its own locked build and explicit publication.
