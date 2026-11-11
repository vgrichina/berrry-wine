# Heretic II: northern brush and retained original health

Run `scratch/runs/20261111-heretic2-northern-brush-health-1855/` used the pinned runtime from `0db20330ccd6761a705eea70c5dd9bfc7704c147` (Wasm SHA-256 `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`). No shared implementation, original game, map, script, or configuration bytes changed.

From genuine covered `gate1810`, native staff attacks broke the internal northern brushes at y384–408. Read-only BSP entities identify breakable_brush models *49/*50/*51, health 60/50/50, spawnflags 1. Close approach and native facing105.25 worked; two earlier exposed attempts died. Do not attribute the projectiles to a particular enemy: their source remains uncertain. The western wall at x1600 does block the exposed direct route.

Native `brush1855` saved the opened passage at `(1671,398,34)`. A subsequent forward passage produced both original native pickup banners, **HEALTH POTION** and **HEALTH VIAL**, consistent with the original health entities at `(1664,432,32)` and `(1664,464,32)`. Native `save health1855` printed Done. Ordinary `load health1855` completed alive in the cleared corridor. Ordinary movement after Load passed: native showcoords recorded `(1653,465,34)` then `(1673,392,34)` after backward movement, facing105.25 throughout. Full images were inspected separately before dependent input. The southern elevated platform Action trigger was not attempted in the remaining recovery margin.

The run retains four raw native files per new slot in `save-inputs/aim1855/`, `brush1855/`, and `health1855/`, with individual SHA-256 manifests. Prefer `health1855` for continuation. Original `gate1640` and `gate1810` remained exact across all eight files. The normal Save/Load is the recovery mechanism; no guest-memory or save editing was used. Preserve original slots when mounting the additional native save files.

Actual controls: comma/period strafe; arrows turn/move; Ctrl attack; Space Action; A jump. Ctrl+Right is turn plus attack. Native Pause assistance used actual releases, with bounded cycles regression tested. Tiny initial facing readouts were corrected after enlarged inspection; see `readout-corrections.json`. Long-input host durations are not exact guest simulation time.

Evidence: `healthsaved.png`, `healthsettled.png`, `healthordinary.png`, `retainedback.png`, `backcoords.png` under `software2/`; `health1855-manifest.json`; `validation-final.json`; `independent-closed-and-save-check.json`; `independent-poststop-state.json`; and the run's RESULT/RECOVERY. The private box was normally shut down after recovery, with actual parent waits/EOFs and an independent fixed-deadline watchdog.

Next: load the recovered `health1855` natively, establish the route to the southern platform's elevated Action trigger, and verify progress through another normal Save/Load. Do not infer platform activation, threat defeat, or west-door progress from this run.
