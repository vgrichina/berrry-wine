# GeneRally cursor integrity repair

Transport integrity now runs before cursor reservation inside the exchange boundary,
with checks after durable cursor/journal writes. Refusal before attempted dispatch
abandons the tentative new ID but leaves terminal failure; attempted dispatch keeps
its durable pending record. Exclusive ownership and poisoned handoff remain closed.

The unchanged production-boundary oracle (only helper/source identity bindings
updated) passes with ACK62, next63, requests61/62 only. Old ordering mutant fails
with next64 and no request63 dispatch. Five deterministic boundary tests pass;
rollback omission fails reservation/journal races. Affected loading, stdio faults,
ownership, handoff and history regressions pass. Broader unchanged groups and the
original rejection are reused from canonical aeb3944e; no blanket payload audit.

See receipt-manifest.json and indexed evidence.tar.gz for pins, transformation,
causal diagnostics, resources, cleanup and controls. Archive history aliases are
absolute symlinks: inspect without following/extracting them. Fresh portable replay:
`python3 -B test/independent-generally-no-advance-oct27.py --reproduce /OWNED/new-history`.
Focused boundary tests require `--evidence /OWNED/new-controls`. Use the prescribed
supervisor, pool, qualified Node and fresh resource admission.

Source-only repair, ready for independent acceptance. No main integration, runtime,
guest, compiler, Boat or deployment. Historical uncertain request12 is untouched.
Final exact remote commit and watcher cleanup are in worker ops/publication-closeout.json.
