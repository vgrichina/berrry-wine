# Hexen II adapter retained-frame audit, 2026-11-20

Evidence: `scratch/runs/20261120-hexen2-native-equivalence-adapter-finish/`.
Implementation remains `a98d42dea`; no production or test source changed.

The first blocker is the missing retained failed fresh frame. The prior run
retains its complete 1280x1024 source PNG, metadata, and generic whole-RGBA
mismatch refusal with zero ARM/DOWN. This task personally reviewed that source:
yellow triangle on dark blue, Chrome automation banner and fullscreen notice.
Those visible elements do not identify the pixels that subsequently changed.

The unchanged equivalence source captures fresh pixels into a local variable
in `prove()`. Its equality assertion throws before the successful proof record;
the refusal record contains the error text and zeroDown only. It writes no
failed fresh PNG, RGBA bytes, difference coordinates or fresh hash. The prior
cleanup retained all runtime outputs except the enumerated host-consent images
and expired Xauthority, then removed the runtime tree after actual waits.
Only the reviewed source PNG exists among retained frame files. There is no
second frame from which to calculate an offline difference or reconstruct it.

All 13 prior helper recipes and their parent hashes, the four current overlay
hashes, and the exact 2,418,815-byte module were verified offline. Prior adapter
21 controls, legacy 42 controls and guarded build evidence are reused as prior
results, not rerun or promoted to native integration evidence. No common
mechanism was changed. Whether fixture transition readiness was incomplete or
the image was animated remains UNKNOWN; no causal repair is justified yet.

No runtime, endpoint, replay, successor fixture or original game was started.
Actual Hexen adapter native positive, owning USER consumption and independent
physical UP remain UNPROVED. Movement toward a living enemy, attack consequence
and ordinary Quit remain UNPROVED. The earlier courtyard/fists/HP85 evidence is
preserved. Completion requires the failed complete fresh image for the requested
offline comparison; this task does not replace it with a later screenshot.

Box ID=null, state=NOT_CREATED, expiry=null, stopReceipt=null. Root owns shutdown;
this task created no runtime process group. The messageboard watcher is joined
before release. Git plus the recorded relevant diff and owned helper patch are
the source recovery record; media and screenshots are references, not copies.
