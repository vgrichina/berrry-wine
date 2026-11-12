# Half-Life: lossless closed-log recovery and full-frame combat planning

Run `scratch/runs/20261112-halflife-lossless-headroom-combat-2130/`.
Lossless recovery passes, but actual free space remains below the required
1,500,000,000 bytes. No fresh box, watchdog, provisioning, native input or
combat consequence occurs. The original play objective remains unfinished.

Before selecting files, inspected 432 existing session/event compression and
closed-transcript archive records; `inspected-journals.json` records their paths.
The eligible-worker inventory requires actual start-worker `result.json`
exitCode 0, with launcher and worker absent. The unknown 1500 worker,
no-result workers, current worker, root and other games are excluded. Existing
gzip archives are retained and never recompressed. Exact claimed raw paths
are in `selected.json`; closed run log ownership follows its terminal worker.
No source, media, capture, save or module is packed or removed.

58 raw log/event files totaling **18,927,633 bytes** are now local gzip files
of **2,721,115 bytes**. Each stream is fsynced, fully decoded and compared to
the raw SHA256 and size; encoded SHA256/size, original mode/mtime, inode/link
count and recovery recipe are journaled and fsynced before raw unlink.
The containing directories are fsynced. All selected raw files had one link.
A subsequent independent read verifies all 58 raw roundtrip hashes, encoded
hashes, modes/mtimes and absent raw paths. Gzip files remain beside their
former raw paths. `recovery-journal.json` is the recovery authority.

Actual filesystem free space changes from **1,472,921,600** to
**1,489,154,048 bytes**, an observed **16,232,448-byte** increase. This is a
filesystem sample delta under concurrent writers, not a promise based on
logical sizes. The later sample is **1,486,802,944 bytes**, still
13,197,057 bytes short of the strict greater-than floor. Remaining eligible
immediate raw logs total at most **40,222 bytes**, individually at most 4096;
even deleting all their bytes would not close this gap. They remain raw.
No cache, reserve, RAM, other-worker or old hardlink cleanup is attempted.

## Distinct full-frame route and aim review

Personally reviewed the entire existing PNGs, without producing crops or
copying media; paths, sizes and SHA256 are in `reviewed-frame-references.json`:

- Native-pause 2000 `a20-lookdown-cycle-consequence`: health 30/0,
  crowbar visible; a headcrab is only partially visible at the extreme lower
  left. The visible game occupies approximately x8–671, y194–675; its center
  is approximately (340,435), distinct from the full browser image center.
- `a21-face-crab-consequence`: health remains 30/0 with red damage indicators;
  the creature is now airborne and clipped along the extreme left, extending
  roughly x8–218, y255–420. It is far left of the game center. This is an
  unpaused consequence frame, not the later native PAUSED proof. Neither the
  shared health value nor pose establishes a hit, defeat or successful aim.
- Semantic-capture 1930 `n36-face-opening`: health 5/0; the open striped
  threshold is lower left. A standing guard near (216,507) and a separate
  floor headcrab near (248,540) are distinguishable. They are historical
  positions, not current targets. Weapon pickup, usable healing, clear
  passage and melee range cannot be established from this image.

Planning consequence: do not aim at the earlier floor position after the
creature leaps, and do not use the guard silhouette as the headcrab target.
A future freshly loaded, genuinely PAUSED frame must choose the target anew.
If it is clipped at the left boundary, first use one bounded ordinary turn
cycle to bring it fully into view, then review its full consequence and
native PAUSED state before selecting an attack. The old 300ms left turn
cannot calibrate a new aim: creature motion and clipping confound its result.
Only an independently reviewed centered target with visually supported range
justifies a subsequent single bounded attack cycle. Preserve uncertainty
about hit/defeat until the full consequence actually shows it.

The guard-room alternative also requires a new living paused view of the
threshold and floor enemy before choosing one bounded movement cycle. The
old follow-on forward2000ms ended in death; repeating that duration from a
5-health historical image supplies no new route evidence. This plan records
conditional review decisions, not an adaptive chain for execution.

## Preserved transfer boundary and next original run

Reuse the locally qualified bounded 1 MiB caller and frozen helper references
from [the 2125 handoff](halflife-bounded-media-2125-20261112.md), commit
`0264ca075`. No transfer, 954-pin or whole13 matrix is repeated. Prior2055's
79,150,544-byte whole-pak PUT stays terminal UNKNOWN and unreplayed; caller
mismatch proves no production defect. The original earned1825 whole13 source
SHA remains `df8d61b2fcdd285a6a28e2e180930e6ee60eff388cd9bf31c557d3409dd18e51`;
it is untouched.

Once actual headroom permits, observe the independent two-hour watchdog
before one fresh private creation; freeze helpers and use the qualified
1 MiB caller, all remote chunk/whole hashes, actual provision wait and both
EOFs plus staged import before original launch. Restore exact whole13 through
normal UI 03:18 Load, prove actual CPU/owning GL/stable22 and native PAUSED
pixels before extended review. Preserve corrected Pause/semantic ACK and
finite cycles: ordinary resume, one reviewed bounded move or attack, full
consequence, native pause, independent UPs. Useful progress must precede a
new earned Save/export/Load; preserve original13.

Git SHA, relevant binary diff and the owned recovery-helper patch are retained
in the run. Documentation-only publication uses link/diff checks, with no
production-code change or locked-build claim. No box is created, so new box
ID, state, expiry and stop receipt are not applicable. No old box is queried,
resumed or stopped. Prior2055's archived receipt remains historical evidence
in the linked handoff. Parent pending reviews are untouched.
