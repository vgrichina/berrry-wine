# Dungeon Keeper original attempt, 7 November 2026

The bounded assignment stopped at the **unstable local disk floor before
allocation**. No original runtime or emulator failure was observed. There is
no current dungeon, digging, persistent change, or fresh original capture.

Evidence is `scratch/runs/20261107-dungeon-keeper-original-qualified/`.
`disk-window.json` records the 609-second preparation window, from
13:35:56Z through 13:46:05Z. Available space ranged from 817,487,872 bytes to
2,377,846,784 bytes. The sole observed crossing above the required
2,000,000,000-byte floor occurred at 13:43:28Z. The immediate write guard then
failed before copying any helper or allocating a boat; the next measurement
was 1,715,638,272 bytes. The final window measurement was 1,294,725,120 bytes.
Small finalization evidence was written afterward; space subsequently rose
again to 2,142,154,752 bytes. This is a measured instability during the bounded
window, not a claim that recovery cannot succeed later. No large evidence,
browser profile, source archive, or media copy was created.

Read-only preparation verified all **622 retained runtime pins**, with zero
differences, and preserved the **167 HTTP pins** from the completed local driver
assignment (`f89723a7a`). The HTTP fixture and controls were not rerun.
`pin-review.json` records helper hashes, the manifest pin, and all installed
media identities. The retained manifest is SHA-256
`97aa5b364ec66e0b31f91c76b7ac40c7ae59319ee2892246d6dc6d52dc5fb7eb`;
the installed executable remains
`4d3cd6a7866520f360288b08440e0f20379b4b39216a9576c388e42fcdf72c84`.
The absent installer is not an absent installed game. Assets, configuration,
and the registered route were untouched.

The reviewed driver already selects `dungeon_keeper_demo` when fixture mode
is absent. Its exact postbinding identity, executing-module, freshness,
numbered ACK, independently scheduled UP, and UNKNOWN closure safeguards were
reviewed in source. Native browser pointer routing was reviewed without calling
handlers or modifying guest state. The attempted owned adaptation stopped at
its disk assertion, so no adapted helper is claimed complete or executed.
Existing qualification remains fixture evidence, separate from gameplay.

`source.json`, `relevant-tracked.patch`, and `relevant-new.patch` record the
exact source commit and relevant uncommitted hunks. The retained helper patch
is referenced by path and SHA-256; Git remains the source archive.
`status.json` records the terminal outcome. Dungeon Keeper has no candidate
corpus entry, so no unrelated candidate or invalid capture entry was published.

The actual original browser/render backend is **unknown**. No FPS, parity,
audio, DirectDraw presentation, active D3D, or whole-game claim follows from
this attempt. No emulator defect was demonstrated, no production code changed,
and no runtime test or full build was needed. Final checks cover unchanged pins,
documentation whitespace, and owned evidence containment.

Box ID, state, and expiry are not applicable: no create, resume, stop, or delete
request was made. No browser, server, native input, profile, port, or held key
was created. The explicitly delegated shutdown therefore had nothing to close.
The temporary messageboard watcher was stopped.

Next: establish enough stable disk headroom for a newly assigned bounded
original attempt. Adapt an owned driver copy and use one UUID-idempotent fresh
boat, one immutable 25-minute runtime deadline, fresh reviewed original pixels,
and ordinary native input. Retrieve and verify small unique evidence, then
normally stop/archive that new boat under explicit shutdown delegation. This
assignment is finished; it does not retry the runtime lane.
