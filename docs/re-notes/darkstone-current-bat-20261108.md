# Darkstone: streamed FINAL1910 restore, one healing response, new save recovered

One fresh remote original restored only the canonical FINAL1910 pair. Current
native pixels established **LIFE 14/35**, **BAT** and its red health bar. One
brief, independently released right-click targeted the visible red belt vial.
The first consequence capture showed **14 → 11/35** with floating damage;
encounter actions stopped. The already queued response subsequently consumed
the vial and showed **35/35**. Native **New Save** created a new game file and
updated character file, both recovered and independently hashed before the
immutable deadline, without reloading.

Evidence R: `scratch/runs/20261108-darkstone-current-bat-2025/`.
No production code changed. The run has a **quit transport failure**, described
below; successful repaired-driver quit/profile cleanup is not claimed.

## Restore and actual runtime closure

The run reuses the accepted
[streamed transaction](darkstone-streamed-bat-response-20261108.md), including
canonical gzip source selection, absolute deadline, exclusive fresh remote
destination, sticky quarantine and no replay. **525 providers** passed the
actual uploaded startup barrier. Local `require_accepted` and remote barrier
`require` both preceded the single original launch. Read-only VFS observation
then found exactly these two original files, with matching sizes and hashes:

| Original file | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,316 | 4762ae9c0d7d048595433d121629a87d5a1aa24e7c3ebe84c7605006e3c10baa |
| game641d_6af0ca48.sav | 3,204,341 | 5e898dc9d6f7a13350c939bf5b712eccfff95ef1072c93023103705999f84ffc |

There was **no local raw checkpoint stage**. The physical runtime closure uses
only its active helpers, replacing the inherited collection of unused helper
scripts. Exact existing paths/hashes and immutable Git blobs supply selected
bytes when the shared working files differ. The native Load a Game preview
showed the sole LEVEL 1 continuation, and its reviewed OK loaded that save.

`consumer.cjs` first invokes the published browser adapter's exact
**2535a4fe…** source guard over the unchanged run-local `browser.cjs`. Its
anchored changes use published logger **979b3a8b…** for browser JSONL and
Chrome stdout/stderr from their first bytes, preserve stream-drain-before-
profile-cleanup ordering, avoid duplicate executing-module files, and use the
owner's 1.5 GB disk floor. Kernel **e36d3499…**, published in **252888061**,
launches with both `journal_compression='gzip'` and
`command_compression='gzip'`.

The original Darkstone module **6cf120d0…** and its selected readiness helper
remain unchanged. The accepted Q2 module **d8facd06…** and Q2 readiness
**9ba9ae8b…** were not substituted into this Darkstone selection. The Q2
logging/kernel proofs were reused by hash. Historical 1940 UNKNOWN was not
replayed; historical 1910 SIGKILL / normalChrome UNPROVEN is unchanged.

## Current observations and the single response

The initial loading captures showed advancing native loading progress. The
inventory key and pointer were sometimes still queued at capture time; no
input was repeated merely because its first image was early. A corrected
pointer position used the observed canvas rectangle rather than assuming
that the rendered game's left edge equaled the canvas rectangle's left edge.

`numeric-panel-settled.png` establishes **LIFE 14/35, MANA 25/25, Food 35,
Gold 1713, AC 14, victories 9+0**. `live-bat-identified.png` shows the same
numeric health together with explicit **BAT** and its red health bar.
Historical 16/35 and Food 36 are not current readings.

At less than half life, `one-survival-response` issued one 100 ms right-click
on the visible red belt vial. The ordinary input pulse armed its independent
release before DOWN; trusted DOWN/UP and both ACKs are retained. Using an item
by right-click follows the [original manual](https://dsdb.it-taucher.at/attachments/212_Darkstone%20Manual.pdf).
No attack or second response was issued.

`survival-response-result.png` shows **11/35**, BAT and floating red **1**.
Its state still contains the queued right-button DOWN/UP, with physical buttons
zero. This first verified **14 → 11** consequence ended encounter actions;
the queued response was not credited with healing in that frame. The next
save-navigation capture, `consequence-panel-closed.png`, shows **35/35** and
the red vial removed, establishing that the single response subsequently
completed. Only inventory/menu/save navigation followed. No kill is claimed.
35/35 is the last numeric reading, not a verified post-save health value.

## Exact new continuation

One reviewed **Save a Game → New Save** produced this pair. Read-only recovery
observed it at **20:41:18.174 UTC**, before the browser cap **20:51:48.557 UTC**.
`final-save-recovery.json` names the retained gzip artifacts and independently
verified compressed and original sizes/SHA-256. Neither file was reloaded.

| New file | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,324 | 2c78a17064029385dee4206c9314673debb4de05205ae63d2ff144b9e6081546 |
| game641d_6af0de53.sav | 3,204,341 | cb2ca8093b2ffe45133cda87e3eea9ceafad66fd82246684ec40dd97306e66fc |

The new game path is unique relative to the two-file restore inventory.
Recovery retained only this new pair, without another copy of the old game.

## Shutdown failure, actual waits, and delegated box stop

I supplied **100,000 ms** to a quit ACK client whose selected source permits
at most **55,000 ms**. It rejected before command publication, then wrote its
sticky transport-closed record. The failed attempt and exact refusal remain;
admission was not reopened and that command was not replayed. This is an
operator error, not a repaired-driver close acceptance result.

One separate public CDP **Browser.close** was issued. Chrome PID **6691**,
start **15606**, has actual kernel reap sequence **3783**, status **0**, and
Node's `chrome-exit.json` independently reports code 0 / signal null. Only
after that wait, the still-idle driver PID **6683**, start **15229**, received
one identity-checked SIGTERM. Kernel drain records its exit **-15**. The
kernel supervisor PID **6682**, start **15221**, has an actual parent wait
return code **1**, because its final success assertion rejects a nonzero root.

The kernel nevertheless records **355/355 owned tasks actually reaped**,
complete lineage, empty remaining/unreaped/unresolved sets, journal finalized,
and kernel command log **EOF**, with producer original SHA/size matching
independent retrieval. Ports were not listening and a fresh nonblocking flock
proved the runtime lock free. The last native input state has buttons zero
and an empty queue. The browser profile is **retained**: no successful quit
ACK, shared-close stream-drain receipt or profile cleanup is claimed.

All **631 regular runtime files**, including files without extensions, every
unique log, the retained profile, and kernel command log, were inventoried
and recovered with compressed/original SHA/size and gzip CRC validation.
Only unchanged selected source inputs were exempted from duplicate recovery.
No symlinks were present. No owned-path FD reference was visible, but **48
process FD directories were permission-denied**, so this is not a global
zero-writer proof. `CLONE_UNTRACED` flags are not audited; Boat exec nonleader
and service-parent terminal waits are outside this kernel descendant scope.
Process absence is not treated as an actual terminal wait.

The independent, observable watchdog was prearmed before allocation with an
immutable 25-minute cap **20:54:18.557 UTC**. The create UUID was durably
recorded before the single create request; box identity and expiry were saved
before runtime. After all unique evidence was recovered and hash-verified,
the watchdog performed the delegated normal API stop. Final box:
**bx_sgm4f79t / ARCHIVED**, provider expiry field **archiveAfter: null**.
Actual receipt **stop_e43205641f748219**, **completed**, **forced: false**,
ended **20:45:34.902 UTC**, error null. The local watchdog also has an actual
parent terminal wait of zero. No box was resumed or deleted.

## Validation, source recovery, and remaining scope

The own controls pass full source preflight, changed-source refusal, exact
browser guard / changed-browser refusal, and two actual kernel launch controls
(empty and 262,173-byte command output) with both gzip settings and actual
terminal waits. The locked full build passes. **295 predecessor proof refs**
were independently reread and hashed; unchanged fixtures were not rerun.

Two preparation checks initially failed (manifest extraction and a mistaken
Q2 module expectation), then passed after corrections preserving the original
Darkstone module. One early read-only retrieval returned the preceding capture
before its new ACK; exclusive creation refused an overwrite. No input replay
or evidence replacement resulted. These failures and the quit failure remain
in evidence; they are not represented as all-green runtime closure acceptance.

R records the exact Git SHA, complete provider PATH/HASH or Git blob selection,
small run-input references and `owned-source.patch.gz`, reverse-apply checked.
No source tree archive, media/module copies, old-run deletion, peer WIP edits,
local Chrome, private guest writes/handler calls, configuration/backend/
binding/clock/seed changes, public deployment or subworkers occurred. Disk
samples remained above 1.5 GB; there is no continuous global-floor claim.

Next requires separate authorization: continue only from the exact new pair,
freshly review health/BAT, and repair the host quit admission/timeout integration
before claiming successful repaired-driver close/profile cleanup. No further
gameplay is requested here. Full27, parity, audio and FPS remain open.
RELEASE and STOP.
