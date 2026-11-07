# Descent 3 installation-state recovery, 7 November 2026

The bounded local recovery found **no usable authentic completed DirectX
installation state for `descent3_demo`**. The exact prerequisite is original
DirectX setup media with provenance and a completed installation/export, or a
retained completed setup-derived environment with its source receipt. The
installed Descent game and launcher alone do not supply that state. No box or
guest was launched, and the known missing-key startup was not repeated.
Current browser WebGL cockpit, yaw/movement and firing remain unverified.

Evidence: `scratch/runs/20261107-descent3-installation-state/`.
The [previous browser attempt](descent3-current-browser-flight-20261107.md)
remains the current runtime evidence; [the historical route](descent3-demo.md)
is navigation guidance only. No emulator defect or production repair was
established by this recovery task.

## Installed originals and provenance

`media-pins.json` freshly records all 25 retained installed paths, sizes and
SHA-256, without copying game media. Root:
`test/binaries/win98-games-a-d/Descent3 demo10-installed/`.

| Input | SHA-256 |
| --- | --- |
| `main.exe` | `21996b1ae7ac2a2e19a04106e395caae2e43a255b4f1efccd56f0abbb5905387` |
| `descent 3 demo.exe` launcher | `6d50bbf2e48101df99e1484db6814764d1aac56ff146c0b7dc21bb16b9e3a832` |
| `soar.dll` | `a4430b8e7c5de6fe25ab13c6d0c28514b0364aff7ba9d05fb5f20a5c8e92e485` |
| `.wine-assembly-browser.json` | `5c4a42e8950dbf94bc30604c1458b84b15face1110aeb6a52604acd3f4da6293` |
| `uninst.isu` | `06ec89a095db9ea9241e4af59bc2e04248d2a8484b521ba2579cd7320cf59473` |

These identify retained bytes, not independent publisher authentication.
Registration commit `763e57229395f5caacb59735883b72cd489359cc` records
InstallShield 5 `SETUP.EXE --capture-launch`, followed by `_ins5176._mp`,
writing `C:\Games\Descent3Demo`. Its patch is retained as
`registration-source-receipt.patch`. It supplies no DirectX installation
receipt or registry export. The manifest and current app startup registry
still supply no DirectX snapshot; `PreferredRenderer=2` selects OpenGL only.

Original launcher UTF-16 strings describe installing DirectX 6 from the
Descent CD-ROM or visiting Microsoft's download page. The original readme's
installation section separately requires obtaining DirectX 6 before installing
the game. `launcher-original-strings.txt` and `readme-installation.txt` retain
those local observations. The launcher is not a recovered DirectX installer.

## Recovery sources checked

Filename inventories covered the current checkout, ignored fixtures/runs,
the local home recovery paths, Downloads/Documents and retained backup trees.
No Descent distribution setup, `_ins5176._mp`, CD DirectX payload or
Descent installation registry export was found in these inventories. The
October 6/10 capture folders are absent. This is a bounded local recovery,
not a claim that every arbitrary archive on disk was exhaustively searched.

The retained `win-98-games-a-d.-7z_archive.torrent` is metadata only:
36,343 bytes, SHA-256
`83fe3d0f93ef474199c8a9727a1b2d8e0c00c24f4cfd3c1a41e706208acc6424`.
Its bencoded file table references `Win98_Games-A-D.7z`, 7,169,873,753 bytes;
that archive is not locally retained. The torrent authenticates no installer
member. No tracker, download or large extraction was attempted.

`registry-export-audit.json` checks 366 filename-matched loose exports under
`scratch/` and `test/binaries/`: 361 parse as JSON, and five are ordinary
REG text files with no DirectX text. All 250 JSON DirectX matches contain the
same `Version=4.07.00.0700` and eight-byte `InstalledVersion` fingerprint as
the invented defaults removed by `58e90870a40a541a4083cae5e987ca8de31889e6`.
None supplies a Descent-specific genuine setup receipt. Matching historical
default values are not accepted as recovered installation provenance.

The genuine FreeSpace DX7a checkpoint is separately recoverable inside
`scratch/runs/20261031T2029Z-freespace-wininit/released-small-evidence2.health.tar.gz`.
Its `installer-registry.json.gz` has logical SHA-256
`5447fc23a80505adb7d84ac25531de2ddcf1ef554d0b347078bfbf29964105a0`
and actual `Version=4.07.00.0716`, `RC=1`, `command=1`.
This is genuine **pending-restart output**, not a completed installation.
The companion archive retains six WININIT operations: two deletions and four
DLL replacements. The November 3 FreeSpace recovery recipe explicitly leaves
boot semantics unproved. The untracked `lib/wininit-boot.js` prototype is not
integrated. Copying this Version alone would discard the prerequisite.
`archive-provenance.json` pins all three reviewed archives and selected logical
members without extracting or importing the environment.

The recorded DX7a package remains present: 6,340,040 bytes, SHA-256
`564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189`.
It is the same pinned local candidate used by the pending FreeSpace setup,
not independently authenticated upstream media or an original Descent payload.
Replaying it would repeat setup before resolving its known pending-boot boundary.
The signed DX8.1 package path is currently absent
(`recovery-input-status.json`). The Jedi DX8.1 recovery note
documents file-only provisioning and explicitly supplies no installation
registry. The retained AoE3 genuine/repaired setup notes document failures
before installation, with unchanged registry exports. Neither provides a
completed environment suitable for this task. The DX8.1 INF limitations and
FreeSpace pending operations were not bypassed or manually replayed.

## Validation and next prerequisite

`node test/test-directx-registry-metadata.js` freshly passes absence, explicitly
supplied metadata, A/W sizing, errors, canaries and restore checks. The supplied
test value is confined to an ArrayBuffer test process; it was never provisioned
to a guest. The static provenance audit passes. No production code changed,
so no full build or new rejecting emulator regression was warranted.

`source-identity.json` records the audited main commit and source hashes;
`relevant-source.patch` is empty. Small patches preserve the inspected foreign
untracked WININIT prototype/test. Git remains the source archive, and no source
tree or media bundle was made. Publication and cleanup receipts are retained
in the run, with `result.json` published last.

Next: establish and implement the genuine Win98 pending-restart completion
contract for the retained DX7a checkpoint, preserving its complete registry
and all six operations, or recover the original Descent distribution/CD setup
or a completed genuine installation. For newly recovered media, retain exact
package/member hashes and source receipt; for a completed snapshot, include
registry and pending-restart status. Then perform one fresh
pinned browser WebGL route with inspected balanced input. Authentic setup may
justify a specific emulator repair only if it demonstrates an API/CPU mismatch.

Box ID/state/expiry: N/A. No browser, guest, server, port, profile or held input
was created. The owned board watcher is stopped and verified absent before
finalization; `/home` remains above 2 GB. No deployment or stopped-box resume
occurred. No cockpit, firing, FPS, audio or broad parity claim is made.
