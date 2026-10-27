# Ricochet independent acceptance: REJECT

Candidate `e8cfe229416c4076f68f18c9806a07dd50848cd7` is rejected. No implementation or recipe was changed and no integration is authorized by this report. This branch is an orphan report containing only independent tests and evidence; never merge its whole tree.

The first behavioral operation ran unchanged `AccountingTests.test_00_exact_transformed_production_boundary` after checking all six supplied SHA-256 pins. It reproduced the original production ENOENT and passed the exact transform through the complete trusted supervisor. Independent complete-entry tests then consumed only `serial/continue.json` immediately after descriptor open and before final pathname validation. Both passed, with generated runner hashes, immutable manifests, supervision receipts and PID/start absence checks retained. Synthetic tiny Python children only; no Node, guest or platform operations.

## Rejection 1: final inventory accepts links

`RuntimeAccounting._walk` excludes every named ephemeral entry from final namespace validation. It does not validate an extant control entry at that final boundary. Replacing the previously validated control with a symlink or hardlink immediately before the final directory enumeration returns an accepted inventory of **25,178,112 bytes** with `lastBytes` set, while that link is still present. This is a deterministic operation during the sample, not a claim about arbitrary future writes after return. Earlier descriptor validation rejects the same link attacks; the new final-boundary case exposes a different unchecked window.

Smallest executable reproducer (expected exit1 on the pinned candidate):

```sh
python3 -S test/ricochet-late-link-minimal.py
```

Full strict adversarial assertions:

```sh
python3 -S test/ricochet-consumed-independent.test.py Independent.test_10_final_inventory_link_swap_must_reject
```

Receipt `1793094508467405778` records both strict assertion failures. Minimal receipt `1793094536198190798` prints `symlink_at_return=True accepted_bytes=25178112`. No attack assertion was weakened. Initial diagnostics failed to serialize Path keys; that separate two-error receipt is retained, followed by a diagnostics-only correction and the actual failures.

## Rejection 2: publisher contract is not wired

Recipe step4 states the required contract but supplies no bounded publisher implementation. The exact historical API-side publisher command `api-1793092841347248549-command.json` checks `not p.exists()` then calls `p.write_text(json.dumps(j))`. The independent test executes only that unchanged publication prefix in an owned fixture, without API polling or remote execution. A symlink inserted after the existence check causes the actual prefix to overwrite a retained file. Receipt `1793094594520332898` preserves the strict failed retained-content assertion, exact command/prefix hashes and diagnostic.

That publisher does not atomically enforce one outstanding command or verify regular/single-link identity, logical AND allocated size before publication. Its remote writer has no explicit RLIMIT_FSIZE wiring in the command. The saved command receipt's limits belong to the local API client; serial.py's limit and trusted-supervisor descendant limits do not prove the separately API-launched writer inherits them. No all-producer bounded writer closure has been established. Therefore acceptance cannot be inferred from absent-control or helper tests. Resume requires actual production wiring and evidence for every publisher; this review does not repair it.

## Independent checks and preserved evidence

Nine additional independent methods passed: complete production consumption windows; absent/open-unlinked full24MiB reserve; reserve within unchanged256MiB cap (11 sparse23MiB files reject without large materialization); unknown disappearance and pathname replacement; late links before descriptor validation; immutable mutation and no partial accepted inventory on live/sparse ceiling failure; mandatory-root identity; failing storage supervision cleans a synthetic descendant tree with exact PID/start proof; and three rejecting in-memory mutation controls (remove reservation, ceiling, hash check). These are distinct from the retained22 original methods. Four original successful group receipts and method/source hashes are verified and reused, not rerun, except the explicitly required unchanged first boundary.

All exact pins are in checkpoint.json. Original production failure, first repair failure, own failed diagnostics, distinct stdout/stderr from creation and all supervisor receipts remain. `.b64` evidence decodes with standard base64 to the exact original bytes; manifests hash encoded artifacts. Evidence scripts are recovery recipes, not production replacements. The trusted supervisor hash is `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`; original production hash is `eebc983956aa092b71a527f41f5516c51376c1acf19872cb808025833953ba63`.

Git uses immutable read-only donor alternates, an isolated sparse orphan report, strict supplied SSH, child-only DATA512MiB/physical256MiB under two permits and the Git flock. Python uses one permit and trusted physical128MiB/CPU90/wall120/file24MiB/output2MiB supervision. Fresh aggregate admission counts live clients in MemAvailable once. No mount argv, Node startup or module execution is applicable to this source-only task. No boxes were assigned/accessed; lifecycle remains with the coordinator. Root tracked/index/refs and donor stores remain read-only, with the launcher initial root digest reused without a final-comparison claim.

Remaining gates: repair the rejected final-boundary behavior; establish all-producer bounded publication; independent affected acceptance; coordinator scoped integration; fresh admitted actual gameplay response and ordinary in-game Quit. This source report claims none of those outcomes.
