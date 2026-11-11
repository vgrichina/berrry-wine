# Diablo II: retained Den combat to XP449

Run: `scratch/runs/20261111-diablo2-xp401-den-clear-2050/`.
Restored the complete healed XP401/life66 four-file checkpoint from
`20261111-diablo2-healed-field-den-combat-1950/final-save/`.
All original save hashes passed, including the 753-byte D2S
`9c9d57b242ac2ccd9f4cd15fa4dc947eecca29544ca7f0a5187c7b3359426d21`.

Entered the Den through the native cave mouth and verified its active quest.
Fought zombies and a Gargantuan Beast in the western chamber. The beast's
bloody collapse was captured in `review/beastmelee.png`. Surrounded with
reduced life, used native SaveExit before death. NormalLoad confirmed native
XP449/life26 (`review/retainedstats.png`) and the active Den quest. The Den
is unfinished. No saved cave position or persistent corpses is claimed.

Akara's native interaction healed to66. A second SaveExit and third normalLoad
confirmed XP449/life66 (`review/finalstats.png`) and the active Den objective
(`review/finalquestsettle.png`). Restore the **whole** `final-save/` set using
`final-save-manifest.json`, not the preceding low-life `combat-save/` set.
Final D2S is753 bytes, SHA256
`fdeef22a39213e0921dadf79a86d432f1746bf3164d10b8446ac0123253cda6e`.

Used exact standard module
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`
and matching closure `7c985edcc8eb8c23e7f2b64ba8b0d6f2eb177bad`.
Checkout HEAD at start was `3e4bb7f0d721d1a483e5ccb7b499176895cb38a1`.
All616 runtime pins passed before launch and after shutdown. No shared runtime
code, game/save/map/config bytes, or guest memory was edited for progress.
Native run accelerated the field approach; native walk was restored before
combat. Inputs had actual balanced releases and every dependent action followed
inspection of a completed full capture. Menu transitions sometimes needed an
additional capture-only wait; no unacknowledged input was replayed.

The original Storm completion-event stall did not recur in either SaveExit.
Passive exit/pre-detach observers were armed on all three guest workers; no
causal repair or object-lifetime conclusion is justified. No new code build
is claimed for this documentation-only change.

The private runtime was closed normally and evidence retrieved before normal
box stop. `RESULT.md`, `RECOVERY.md`, `FINAL-AUDIT.json`, and lifecycle receipts
in the run record exact shutdown state and recovery hashes. No live handoff.

Next: continue from healed XP449, collect healing supplies/equipment and gain
level2 (native next-level threshold600), then clear the Den with short targeted
fights. This run satisfies a further retained combat/save milestone, not a
completed Den quest.
