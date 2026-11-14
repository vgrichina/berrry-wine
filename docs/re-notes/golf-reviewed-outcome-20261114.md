# Golf: one reviewed original deal, 2026-11-14

**One untouched default deal reached the native loss “Game over - 2 cards
left” after 33 personally verified tableau removals and 16 ordinary stock
draws. Native Game → Exit then ended the process with exit code zero.**
The remaining cards were Q♣ and 10♥. This is a native loss, with no win claim.
Evidence: `scratch/runs/20261114-golf-reviewed-outcome/result.json`.

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
followed those predecessors, the full doubly locked build (35.408 seconds),
and publication of controller/tests at `55b720c9c434789e70424310c0dbda32236d2c78`.

## Personally reviewed original

The complete default board appeared automatically. No Start, New, Backup,
reset, redeal, configuration change or second deal was used. Permanent native
PID 4110805/start token 274425434, main HWND `0x10001`, and 800×600 scene were
bound once from `baseline.png`. Initially the seven exposed cards were
7♥, A♠, A♣, 5♣, 8♦, 4♠, A♥; waste K♠; stock 16.

Every move below was chosen personally from the current complete pixels and
its consequence was personally inspected. This is a retrospective evidence
table, not a generated or submitted action list. Column numbers run left to
right. “Empty” means no underlying card remained. No covered rank or suit was
counted as verified until exposed. All removal choices were adjacent in rank
to the visible waste.

| Removal | Column | Card moved to waste | Newly exposed |
|---|---|---|---|
| 1 | 6 | 4♠ | 8♠ |
| 2 | 4 | 5♣ | 3♠ |
| 3 | 1 | 7♥ | 9♠ |
| 4 | 5 | 8♦ | 10♣ |
| 5 | 1 | 9♠ | 7♠ |
| 6 | 5 | 10♣ | 3♣ |
| 7 | 6 | 8♠ | 7♦ |
| 8 | 1 | 7♠ | 4♣ |
| 9 | 7 | A♥ | 8♣ |
| 10 | 4 | 3♠ | 4♥ |
| 11 | 4 | 4♥ | 8♥ |
| 12 | 5 | 3♣ | 2♦ |
| 13 | 5 | 2♦ | Q♣ |
| 14 | 2 | A♠ | Q♠ |
| 15 | 3 | A♣ | J♦ |
| 16 | 7 | 8♣ | 2♣ |
| 17 | 6 | 7♦ | Q♥ |
| 18 | 4 | 8♥ | J♠ |
| 19 | 7 | 2♣ | K♥ |
| 20 | 1 | 4♣ | 6♥ |
| 21 | 2 | Q♠ | 10♦ |
| 22 | 3 | J♦ | 9♣ |
| 23 | 2 | 10♦ | 5♦ |
| 24 | 3 | 9♣ | 10♠ |
| 25 | 3 | 10♠ | 7♣ |
| 26 | 4 | J♠ | Empty |
| 27 | 6 | Q♥ | 5♥ |
| 28 | 7 | K♥ | 10♥ |
| 29 | 2 | 5♦ | 6♠ |
| 30 | 2 | 6♠ | Empty |
| 31 | 6 | 5♥ | Empty |
| 32 | 1 | 6♥ | Empty |
| 33 | 3 | 7♣ | Empty |

The sixteen personally inspected stock cards, in actual draw order, were
5♠, Q♦, J♣, K♦, 3♥, 6♣, K♣, 9♦, 2♠, 4♦, 2♥, 9♥, A♦, 3♦, J♥, 6♦.
Every draw was justified by the then-visible exposed ranks, including the
King blocks; no draw skipped an available legal removal. After the last draw
the stock disappeared. Subsequent legal removals continued until the native
status line in `remove33.png` explicitly declared “Game over - 2 cards left”.
Q♣ and 10♥ were visible; waste 7♣; five tableau columns were empty.

Some personal reviews expired before the five-second gate and were rejected
before an intent or input was sent. They did not renew or replay any sent
gesture. One rejected early review also supplied an incorrect manual identity;
the actual binding was never changed, and subsequent review geometry used the
capture's exact identity metadata. All 51 submitted clicks had distinct nonces
and independently prearmed UP; 49 gameplay clicks, then Game menu and Exit.
Earlier clicks used 400ms, later ordinary clicks 120ms. No live input fault or
UNKNOWN occurred in the original.

## Native shutdown and limits

The current complete native Game dropdown visibly offered Exit in
`openquit.png`; the reviewed Exit click was consumed. The native process
exited normally before final UP. That release is **OWNER_EXITED with
physicalUpACK false**, verified against the exact native wait; no physical
UP acknowledgement is fabricated. Native Exit via visible UI is separate from
host teardown; no host-close command was used in the original.

Native PID 4110805, watchdog 4110804, supervisor 4110801 and outer caller
4110800 all have actual zero waits, both EOFs and absent exact PIDs. The
watchdog ended unfired; the control port closed and heavy ownership released.
The CLI reported 418.488 seconds. One held main critical section was logged
at exit, so this is not a claim that all thread resources were clean.
All 336 runtime/media/read-only pins matched at release. Git SHA and relevant
binary patches record source provenance; no source tree, media or WASM copies
were archived. Ten selected, individually named original PNGs are retained;
65 unselected original/fixture captures were pruned with hashes and metadata.
No frame bundle, automated board reader, solver, private-card access, browser,
worker, deployment or new box was used. Box ID/expiry are null; state
NOT_CREATED; stop receipt not applicable. The bounded task ends here.
