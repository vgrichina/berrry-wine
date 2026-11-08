# Darkstone BAT response: shared disk floor stopped preparation

The requested first ordinary response to the live BAT remains **unfulfilled**.
Shared `/home` free space reached **1,499,185,152 bytes**, below the owner's
1,500,000,000-byte floor, during provisioning. The sole fresh box was drained
and stopped **before Chrome or the original launched**. No gameplay input,
new native save, current-state review, combat consequence or production repair
is claimed. Improved disk headroom reported later did not restart this attempt.

Evidence R: `scratch/runs/20261108-darkstone-bat-response-1940/`.
Predecessors: [final1910 recovery](darkstone-bat-continuation-20261108.md) and
[close repair](darkstone-close-escalation-20261108.md).

## Selection and checks completed

The fresh selection retained the exact historical browser SHA-256
`2535a4fea2ad1acbc245d10fd00cc6c583913095aacdc9cd92462c4d6b346a2f`.
Its launcher invokes `node tools/darkstone-browser-driver.cjs NEW/browser.cjs`.
Before allocation, the cheap adapter check exercised repair of those exact
bytes, rejection of changed bytes, and inspection of the repaired launch path.
It did not launch Chrome.

The 550-provider selection contains 42 relocated helpers, 505 unchanged
nonhelpers, the updated kernel, and these two additional selected providers:

| Provider | SHA-256 |
| --- | --- |
| tools/darkstone-browser-driver.cjs | aa3952294bdb93a403574580080d8538100f04bbb9fc644ed6aed3202e11f8ef |
| tools/native-browser-close.cjs | 1f4fe08b501ed27c90f4256e85574a788e7dd8adff60638f2c69d6a3ca2ea9b2 |
| tools/native_kernel_custody.py | 04a3598c7e23966d57173df5f42ba740fd36106ca4e8f78c84c435f49451221d |

The kernel was independently matched to Git commit `e1a413983f`; its supported
`--journal-gzip` option was selected without rewriting kernel source. Two
focused bootstrap controls passed: changed bootstrap refuses before upload or
start; actual clean bootstrap exercises kernel lineage, nested WNOWAIT and
actual terminal drain using gzip journals. The final control observed three
owned/reaped tasks; the separate unlaunched remote custody result below has
one. These are not game or normal-Chrome proofs.

Local production HTTP manifest verification passed: 1,246 bytes, SHA-256
`112a41aa474e3a9f876e724652e95422c1304dd06c0bbc492fedd20326df425a`.
Physical helper closure, helper syntax, selected provider fallback hashes and
68 accepted proof hash rereads passed. Accepted fixtures and the already
accepted locked build were not rerun. No tracked production code changed.
Remote provisioning acknowledged **475/550** providers before local cancellation;
full remote source verification, HTTP, loadFiles, VFS and native preview were
not reached. The in-flight next media upload outcome is unknown and was not
replayed. Its interrupted local process has an actual terminal-wait result 143.

## Exact pair preserved

Only final1910 was decompressed for temporary staging and independently hashed:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,316 | 4762ae9c0d7d048595433d121629a87d5a1aa24e7c3ebe84c7605006e3c10baa |
| game641d_6af0ca48.sav | 3,204,341 | 5e898dc9d6f7a13350c939bf5b712eccfff95ef1072c93023103705999f84ffc |

After cancellation, the canonical predecessor gzip streams were independently
reread against original hashes/sizes before unlinking only this run's two
regenerable decompressed copies. R/staging-release-recovery.json records exact
source paths and recovery: `gzip -dc source > checkpoint/name`, then verify the
table above. The canonical gzip pair remains retained and was not loaded.
Earlier pairs remain superseded. Historical last numeric LIFE 16/35 is not a
current-state reading for this attempt. Historical1910 Chrome SIGKILL / normal
UNPROVEN and its separate 357/357 actual reaps remain unchanged.

## Custody and final stop

UUID persisted before create; ID and original expiry were persisted before
remote custody. Observable independent watchdog roles were prearmed, with
immutable API-stop cap **20:04:43.419 UTC**, original expiry **20:05:43.584 UTC**.
No original launch request was created. The unlaunched custodian released the
remote lock and the kernel consumed **1 owned / 1 actual terminal reap**, exit
zero; remaining, unreaped, unresolvedPtrace and unresolvedLineage were empty.
Kernel supervisor and recorded PID/start identities were absent. There were
no Chrome profile, game ports or held input to drain. Accessible FD census found
no runtime writers; permission-denied processes are explicitly retained in the
receipt. Census is not exhaustive; CLONE_UNTRACED and nonleader exec remain
unaudited. Absence is separate from the actual kernel terminal-wait receipt.

Ten unique remote evidence references were recovered and independently reread
before requesting normal API stop. Custody journals were gzip from first
production, with original stream size/hash verified after decompression. Small
local lifecycle heartbeats initially used the inherited JSONL writer and were
compacted only after those roles ended; they were not gzip from outset.
Source recovery uses Git SHA, relevant binary diff and small owned helper
patches. Existing media/module paths and hashes were reused. No tree archives,
peer WIP, old-run deletion, local Chrome, old-box resume/delete, guest writes,
handler calls, configuration/binding/clock/seed/backend changes, deployment or
subworkers occurred. No continuous shared-disk-floor compliance is claimed.

Box **bx_pzb6x4sx** is **archived**, expiry **null**. Stop receipt
**stop_c53faff061481d9c** completed **19:44:08.509 UTC**, forced **false**, error
**null**. Normal and watchdog roles have actual supervised exit-zero receipts;
supervisor terminal lists no children. This is API stop of an unlaunched box,
not a normal-Chrome result.

Next requires a separately assigned fresh attempt with sufficient sustained
headroom, the exact final1910 pair, current native health/BAT review, and one
bounded ordinary response followed by immediate New Save recovery. Full27,
parity, audio and FPS remain open. RELEASE and STOP.
