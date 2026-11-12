# Diablo II native level 2 and Den combat, 2026-11-11

Run: `scratch/runs/20261111-diablo2-native-level2-den-progress-2320/`.

Continued the complete original 2050 checkpoint through ordinary optimized native play. Two Blood Moor zombie kills raised XP449 to XP515 and level1 to level2. Five native Vitality allocations raised Vitality25 to30 and full life to77; one native skill allocation selected Axe Mastery1 (+28% damage/attack rating in its tooltip). Entered the Den of Evil, opened its quest objective, and fought the Fallen/shaman pack. Den combat added36XP, reaching551. Native Save & Exit and normal load retained the level and combat gains. Akara then healed the character to77/77 before the final native Save & Exit and normal-load verification.

The Den quest is active and unfinished. No quest completion, saved monster corpses, or retained cave position is claimed. The continuation starts in the Rogue Encampment; the next gameplay task is to return to the Den and clear further monsters.

## Save checkpoints

All four files in each set are recovered and SHA-256 verified; use a complete set together.

| Set | Native stats | D2S SHA-256 |
| --- | --- | --- |
| Original `20261111-diablo2-xp401-den-clear-2050/final-save/` | level1 XP449 life55/55 Vitality25 | `fdeef22a39213e0921dadf79a86d432f1746bf3164d10b8446ac0123253cda6e` |
| This run `level2-save/` | level2 XP515 life77/77 Vitality30, one unspent skill | `36b78d8a9337f64cc6d206282da65cc9735f2acd2cac8fbb543a76f4e64e5999` |
| This run `den-combat-save/` | level2 XP551 life32.265625/77, Axe Mastery1 | `2c7b60d95a554d1689dbb03c10d6f0e52efed82a80d478388e3e03c8b157b92b` |
| This run `final-save/` | level2 XP551 life77/77, Axe Mastery1 | `08570d2dca2715928704ade7608e260af8f9e18c3d0e8ca3ad45236d77460a83` |

Original and earlier native checkpoints remain unchanged. Diagnostic native outputs were never promoted. The original `.map` and `.key` remain identical; native exploration changed `.ma0` in the new sets.

## Correction to historical visual readings

The stylized digit5 resembles6. Original handoffs saying life66/66 or Vitality26 were incorrect: the unchanged original D2S v71 stat mask and 32-bit values give life55/55 and Vitality25. An initial visual reading of this run's XP515 as616 was also corrected. A read-only decoder validates the following `if` skill marker; `native-stats-and-skills.json` records original and all three new checkpoints. Native stat images show the level2 threshold500 and subsequent threshold1500. No guest-memory or save-byte edits were used.

## Runtime and evidence

Used exact WASM `1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135` with matching closure `7c985edcc8eb8c23e7f2b64ba8b0d6f2eb177bad`, all620 pins. Source recovery uses Git plus recorded relevant diff and inherited untracked-input patch, not a source archive. Game media is referenced by existing path/hash.

Full completed images were inspected separately before dependent native input. Native pulses have exact command receipts and balanced trusted key/mouse events; stale-scene refusals have zero effects. A compact passive first pre-detach observer was armed, with no broad instruction tracing or stepping. No actual native failure recurred; the earlier null-buffer interleaving remains unproved. No runtime fix or runtime source edit was made.

See run `RESULT.md`, `RECOVERY.md`, `FINAL-AUDIT.json`, save manifests, reviewed captures and lifecycle receipts for exact validation and shutdown details.

Final checks:1306 recovered references/1182 unique hashes;114 PNGs passed CRC/inflate;115 exact command receipts;101 reviewed input admissions and one stale-scene zero-effect refusal;30 balanced trusted key pairs and71 mouse pairs. All620 runtime pins matched before launch and after play. Browser controller and watchdog each have actual parent wait/EOF receipts with exit0; watchdog did not fire. Private box `bx_a4rxshr8` normally archived at `2026-11-12T00:06:36.831Z`, before original expiry `2026-11-12T00:20:47.220Z`; completed nonforced stop `stop_cadb89fd9a175bef`, error null. No production build was run because this change contains documentation only.
