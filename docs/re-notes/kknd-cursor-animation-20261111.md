# KKnD native white ground cursor animation — 2026-11-11

The white cursor gate now accepts all 30 personally reviewed native ground
frames retained in `scratch/runs/20261111-kknd-white-cursor-blue-base-0230/`
(RUN0230). They establish eight shapes at radii 5 through 12. The previous
allowlist admitted only eight of these frames at radii 9, 10 and 12.
No new game execution, guest edits or inferred animation frames were needed.

`tools/kknd_cursor_pixels.cjs` retains the exact opaque white/black arrow mask
for the seven separated phases, including the four newly supported radii
6, 7, 8 and 11. Radius 5 requires a separate 10×10 composite: overlapping
arrows change the pixels, so moving the old six-pixel arrows inward is wrong.
The contracted mask is measured from full native frames, with the hotspot
between the four central pixels at offset (5,5) within the 10×10 square:

```text
#W#.##.#W#
WWW#WW#WWW
#WWWWWWWW#
.#WWWWWW#.
#WWWWWWWW#
#WWWWWWWW#
.#WWWWWW#.
#WWWWWWWW#
WWW#WW#WWW
#W#.##.#W#
```

`W` is opaque RGB 255/255/255, `#` is opaque RGB 0/0/0, and `.` preserves
terrain. Alpha must be 255 for every opaque pixel. The separated phases
place their mirrored arrows at offsets `-radius` and `radius-1` around the
exact integer mouse coordinates. The existing conservative clipping margin
and full-frame 640×480 geometry requirement remain in force.

The evidence is causal retained-frame evidence, rather than a claim of guest
source or asset decoding. Stages 11–15 are consecutive settled neutral mouse
hovers at (550,120), with increasing guest dispatch and INT33 read counts and
no press between them. Radii are 5, 8, 11, 5, 12. Full-frame personal review
also confirms the two contracted cursors at that target. Every contracted
opaque pixel recurs exactly in stages 11 and 14 and replaces terrain; stages
13 and 15 expose identical terrain underneath it. Every transparent cell
preserves that terrain. The derivation test checks all 100 cells, records
the original PNG/JSON/review hashes and extracts the complete observed masks.

Native representatives from RUN0230 (all hotspot coordinates agree with both
the raw mouse state and the settled hover command):

| Radius | Stage | Hotspot | Raw full PNG SHA-256 |
| --- | --- | --- | --- |
| 5 | 11 | 550,120 | a3b92360edbbb2e90442a1ed3a5954df0414566e3d4d455d489ae5c13aaa2ab5 |
| 6 | 26 | 450,230 | 25347c71ca71e1db4f06b4f8fa0875997254b1787417fb80cf593a29a724022e |
| 7 | 19 | 550,180 | 8de133d5927f38726a1c337a7aa8d76c68fd99c8620b8811649049cfe277c810 |
| 8 | 12 | 550,120 | 0dffd86f3f37acccdee121d8d0b181b6a1159d7c2bb34fe4eb85a55f3716d078 |
| 9 | 47 | 580,400 | 42d0bb3d8cd1b06293487037c90cfb8421c58f62e06d918fe1a7834263d66ee2 |
| 10 | 28 | 465,230 | 54e00c0aaa980165eb1524151a0ed953b384c05dc5d8a9b921b2a259d4ff1752 |
| 11 | 13 | 550,120 | 2ab797d7337857172ed0b2b78b4c20e9f365ab9ee53b627799cc80f52f84c28f |
| 12 | 15 | 550,120 | a925f33ec010dd19ae24993b26a3b976d453b4713427a85f7c95696d3db3c655 |

Exactly one phase must match. Missing, damaged, mixed, clipped, ambiguous and
unsupported shapes still refuse. Retained RUN0120 red-circle stage52 still
refuses before publication even when its review incorrectly says valid ground.
This witness does not classify terrain, prove a route or replace personal
full-frame review. Menu, selection and visible-target review semantics remain
as documented in [the original gate investigation](kknd-prohibited-cursor-20261111.md).

The Python gate is unchanged: it recomputes the witness from current collected
PNG/JSON on durable reload and checks hashes, frame identity, fresh review,
neutral settled hover, exact target, usable guest state and personal review.
No persisted cursor claim authorizes a press.

Focused local tests (use new output paths for each invocation):

```sh
node tools/kknd_cursor_animation_test.cjs \
  scratch/runs/20261111-kknd-white-cursor-blue-base-0230 \
  scratch/runs/20261110-kknd-current-base-target-response-0120 UNIQUE_MASK_OUTPUT
python3 tools/kknd_review_gate_test.py \
  --retained scratch/runs/20261110-kknd-current-base-target-response-0120 \
  --animation-retained scratch/runs/20261111-kknd-white-cursor-blue-base-0230 \
  --out UNIQUE_GATE_OUTPUT
```

The mask suite derives the contracted mask independently, verifies every native
frame/hotspot, mutates all RGBA channels of white/black pixels in every quadrant
of every phase, changes transparent terrain, and refuses shifted hotspots,
unsupported/guessed overlap masks, mixed phases and simultaneous native phases.
The gate suite invokes RUN0230's actual `operate.perform` for every native
frame and rehashed white/black/alpha mutations in every phase. It also exercises
stale/swapped frames, repinned shifted targets, personal review, original
red-circle refusal, balanced publication, actual settle, durable reload and
process serialization with actual parent waits and separate stream EOF.

Evidence is in `scratch/runs/20261111-kknd-native-cursor-animation-coverage-0300/`.
Baseline failures, exact Git base and relevant patches, native derivation,
test outputs and independent watchdog custody are retained. No prior fixture
outputs are removed. Future controllers must repin the changed checker;
the old run's files and pins are intentionally preserved.
