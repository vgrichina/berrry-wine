# Original Uplink: maintenance room and crowbar, with native successor recovery

Run: `scratch/runs/20261112-halflife-bay-clearance-1615/`.

Fresh native Load of the unchanged complete nine-file bay checkpoint reached
**the maintenance supply room and an equipped crowbar** on actual SoftwareGL.
Native Save → complete export → move away → normal Load → fresh right strafe
then qualified the new crowbar successor **in this browser**. Health100 /
armour0 persisted. A fresh-browser restore of this successor remains untested.
No encounter, pistol, crate destruction or later room is claimed.

The [1600 bay handoff](halflife-bay-native-onward-20261112.md) and
[1535 complete bay export](halflife-upperdeck-onward-20261112.md) remain separate
and unchanged. Historical routes in [the Uplink notes](half-life-uplink.md)
were used only as guidance; no old floor/pistol save or input stream was used.

## Fresh complete Load and route

Before allocation, strict base64, the exact nine paths, every size/SHA and the
997089-byte total matched the authoritative1535 export. Its gzip SHA256 remains
`f02a6513218da738ba3f6301962992e287fdf85d25e14991b08655aea939c715`.
All nine ordinary required mounts were preserved together, including both map
auxiliary sets and all three slots. The fresh browser independently read their
VFS bytes before native Load. `checkpoint-independent-verification.json`,
`restore-mounts.json` and `restored-save-set-verified.json` retain these checks.

Native Configuration → Video selected OpenGL / Default /640×480. The fresh
Controls screen was inspected without binding edits: arrows turn, W/A/S/D move,
Space jumps, Ctrl ducks, E uses items, and primary attack is Mouse1 or Enter
(`c10-controls-wait`/`c11-controls-scroll`). Duck was inspected, not exercised.

`c15-bayslot` selects the third entry, UPLINK00:20 / `half-life-002.sav`.
`c16-nativeload` clicks native Load once and uses the unchanged tested passive
`postLoadReady` helper before its first post-Load screenshot. After Loading,
`c19-loadsettle` shows the close crate and red bay; `c20-bound` establishes the
actual owner and `c21-freshmove` visibly strafes right, moving the crate left.

Fresh views guide clockwise turns past the Lambda sign and elevator to the
maintenance door and vending-machine window. `c25-lobby-approach` advances
through the clear floor. A small left turn, forward approach, and left strafe
place the player directly against the door panel, with its right jamb visible
(`c26`–`c28`). **One E1000ms pulse at this changed close, centered position**
visibly opens the door (`c29-use-close`). This establishes an opening that the
prior run did not prove; it does not establish why the earlier attempts failed.

`c30-supply-enter` crosses into a distinct white room with a red tool chest,
table and soda machine. A crowbar lies on the table. Left strafe centers it;
`c32-table-reach` advances to the table, removes the item from its surface and
shows the crowbar equipped in hand. No jump, crouch, attack, console command or
state write supplies this progress.

## Earned successor and complete recovery

Native menus select New Saved Game; `c36-native-save` visibly displays Saved
with the crowbar equipped. `c37-export` reads the entire game-generated save
tree. `c38-move-away` backs away so the table becomes visibly distant.
The native Load list highlights the newest **UPLINK00:56**, above autosave00:42
and the three older entries. `c42-load-successor`/`c43-loadconfirm` perform normal
Load and current-game confirmation, with passive owner readiness. The saved
close-table scene and equipped crowbar return in `c44-restored-settle`;
`c45-restored-freshmove` visibly strafes right. The22-field owner remains anchored
through menus and this Load, with no rebind.

Authoritative successor:
`recovered/webgl/earned-native-save-c37-export.json.gz`, **540945 bytes**, SHA256
`6f1527841843134d94ca50f15a25d4018d78fa9333f79790facb97646fa777c4`.
`successor-save-manifest.json` records **11 complete files /1670445 bytes**:
all four `half-life-000`…`003.sav` slots, `autosave.sav`, and the three auxiliaries
for each of `hldemo1` and `hldemo2`. The new `half-life-003.sav` is337057 bytes,
SHA256 `19d193c0b4cafd83e55373150472349c3d62b86ceb6e834db5f451acc807a1b8`.
The hldemo2 auxiliaries belong to this new whole export; do not substitute the
prior bay auxiliary set or omit the autosave.

`successor-recovery.py` independently verifies gzip size/SHA, exact path set,
strict base64, every decoded size/SHA and total. `--prepare` creates ordinary
required mounts while refusing to overwrite existing bytes. Prepared
`successor-restored-save/` and `successor-restore-mounts.json` match all11 files;
overwrite-refusal testing passes without changing their bytes. Next: mount this
whole set in a fresh browser, select UPLINK00:56 / `half-life-003.sav`, qualify
owner and fresh movement, then return toward the bay crates with the crowbar.

## Verification, source and shutdown

Both actual guest and owning renderer modules hash to
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Actual renderer context `software:true` proves SoftwareGL independently of the
page dropdown. Fresh document/guest/renderer identities differ from1600.
All22 strict fields match within each screenshot and stay anchored after
binding; full-frame/hash, original capture age, independently scheduled native
DOWN/UP acknowledgements and terminal no-replay rules remain unchanged.

Frozen source is Git `e8231d0351ced1311026af5542d22832f32e6dda` plus
`relevant-source.patch`, `relevant-untracked-source.patch`, `fixture-source.patch`
and initial/final helper patches. Git is the source archive. All542 shared
staged pins and the two production fixture revisions match1600. Original65-file
media checks and fresh exact staged-import positive/missing-dependency controls
pass locally; all583 frozen files and the import-only gate pass remotely before
Chrome. Identical tested binding/readiness/release/save/caller/API1…600 envelope
revisions,102 emitted forms and retained ACK/no-replay results are hash-pinned
and reused. No production source changed and no new build is claimed.

`postflight.json` checks526 recovered artifact references,46 full frames,
26 captures with22 postbinding fields,97 trusted native events and38 balanced
acknowledged pulses. Incremental gzip packing includes exact readback and raw
hashes. Minimum sampled free space during native commands was1743446016 bytes;
no floor crossing or RAM gate occurred. No source-tree/media archive, replay,
forced guest export, guest config/state/AI/clock/health/position write, worker
launch or public deployment was used. No parity, FPS, audio or full27 claim.

An observable independent two-hour watchdog was armed before allocation.
Ordinary quit acknowledged at command45; Chrome exited0/signalnull. The actual
native outer parent waited0 with both EOFs, and kernel custody reaped363/363
owned processes with none remaining/unreaped and complete command EOF.
Unique evidence was retrieved and hash-verified before delegated normal stop.

**Lifecycle limitation:** the local starter's actual tool wait returned143;
its manager-parent wait and watchdog actual-parent join records are absent.
The cause is unknown. An initial normal-stop attempt marker existed without a
result. A read-only provider GET then showed idle/no stop receipt; a separately
recorded delegated normal stop completed. The watchdog wrote its confirmed
terminal record. These observations do not substitute for the missing waits.

Box **`bx_5qcjx24g`** is **archived**, stopped **2026-11-12T16:25:57.680Z**,
expiry **null** (initial **18:14:56.511Z**). Receipt
**`stop_60a1e27c269bf585`** completed16:25:57.700Z, forcedfalse, errornull.
No box was deleted, resumed or left billing idle.
