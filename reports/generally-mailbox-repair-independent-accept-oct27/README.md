# Independent GeneRally mailbox repair rejection

Candidate `4616ccf2e6ce700114c8c6db3642f4aac3065827` is **rejected against the assigned no-cursor-advance-after-uncertainty requirement**. The original mailbox ownership bypass is closed. This rejection concerns a narrower cursor reservation defect, not a demonstrated duplicate dispatch or gameplay failure.

The independent exact-production-boundary fixture acknowledges snapshot61, then mutates that consumed reply while step62 is pending. The real production controller acknowledges step62. When the loading controller attempts its following frozen snapshot, it first writes cursor `{next:64,pending:true,request:{action:"snapshot",id:63}}`. `Mailbox.exchange()` then checks consumed history and refuses the changed ACK. Request63 is never published. The final cursor remains advanced to64 with failed/pending63, while the journal is poisoned with authoritative next63.

`LoadingController.request()` writes the pending cursor before `Mailbox.exchange()` invokes its integrity check. Thus a known-invalid consumed history is detected after the next cursor reservation. The assigned contract requires no cursor advance after uncertainty. The first failing `independent-generally-no-advance-oct27.py` oracle asserts that a refusal before dispatch63 cannot move next beyond63. It exits1 on the unchanged candidate. Its stdout, causal AssertionError, exact executed fixture, raw request/reply history, cursor/journal, commands and cleanup are retained. The oracle adjudicated fresh same-task causal execution without replaying an unchanged Node group.

No candidate semantics were changed. A coordinator-owned repair must consider validating transport integrity before the next cursor reservation while preserving durable pending-before-dispatch and the existing terminal failed-cursor behavior. This task makes no repair or main integration.

The original actual-CLI collision test was the first behavioral checkpoint. Only its helper SHA pin changed; all attack assertions remained unchanged. Owner12 stayed alive/pending, same-state and alternate-state competitors refused13, and no ACK writer ran. This is an isolated synthetic ownership test, not a replay or completion of the historical uncertain request12. An omitted-ownership mutant substitutes the original state-only transport and restores13 dispatch; the unchanged oracle correctly rejects that mutant with exit1.

New independent checks passed for19 durable/inventory cases: dead/timeout owners with explicit late, partial and stale negative ACK fault bytes; root and requests-directory aliases; noncanonical reply aliases; same uncertain cursor refusal; authentic active/no-dispatch journal;8193-entry inventory, malformed/oversized journal,4097-entry history and unjournaled filename aliases. None reset the journal or advanced a competing cursor. Additional exact-production fixture checks rejected changed acknowledged request/reply bytes, filename aliases, different terminal/reply endpoints and a wrong next ID. Correct canonical-root clean handoff and same-state restart produced unique IDs61..69. Mutations during an active session poisoned ownership and prevented63 dispatch. Those transport safety checks passed; the separate stronger cursor oracle rejects their observed reservation behavior.

One new stdio total3 regression preserved the exact production stdin/control boundary and post-loading snapshot/png/input protocol. The returned frame bytes and host observations are explicit fixture stubs. No guest/module/compiler was initialized. The installed Node24.18.1 executable, heap512MiB flags, controlled environment and inherited limits matched the successful startup check. Four fixture traces bind the unchanged runner SHA `6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e`, authority `1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`, blob `f52b03a096a9a614b681cdf0f912ce20ca19fcba`, and contiguous boundary SHA `96de2e3dbd35b5059e05e7a346a65f2926d643acf03b7af5cd9760255d1e2bf7`. Host observation exports and batch cost alone are stubbed.

Producer protocol/handoff receipts and coordinator-verified publication integrity are reused through the canonical predecessor manifest SHA `9aacd349c098076ffae5b0c7f3bcdb4905bfd450e24eaf94a2a57cb3f4020267`. No1409-payload audit or broad unchanged suite was repeated. The predecessor publication output-guard incident remains preserved in that manifest.

`receipt-manifest.json` is the canonical acceptance receipt. It binds source and independent fixtures, commands, results, omission control, diagnostics, resource admission, archive/index hashes, remaining gate and cleanup. `evidence.tar.gz` contains explicitly selected new owned evidence; `payload-index.json.gz` records exact file hashes and original symlink targets. The archive is an evidence snapshot; the packaging operation's later terminal receipt and publication receipts are recorded in the closeout outside that snapshot. Absolute symlinks preserve original identities; portable replay creates fresh aliases rather than relying on archived links.

To adjudicate retained evidence after extraction:

```sh
python3 -B test/independent-generally-no-advance-oct27.py --case /OWNED/evidence/history/consumed-reply
```

To reproduce only that case later, under fresh admission and the prescribed pool/supervisor:

```sh
python3 -B test/independent-generally-no-advance-oct27.py --reproduce /OWNED/fresh-history
```

Both commands intentionally exit1 on this exact candidate. The latter spawns the exact pinned production-boundary Node fixture and therefore needs768MiB aggregate Python/Node supervision, not the Python-only128MiB allowance. Git uses256MiB physical/DATA512MiB on Git alone, two shared permits and the Git flock; Python-only operations use128MiB and one permit. CPU90/wall120/file24MiB/output2MiB and cumulative1MiB guards apply. Installed tools run in place; sparse source/Git, staging, evidence, external session/events, positive WAL growth once, publication/growth and8MiB reserve fit the256MiB allocation. No fetch, full checkout, repack or donor mutation occurred.

The initial aggregate admission assertion failed before its measurement receipt; a subsequent attempted wrapper could not start because setup had aborted. Neither Git nor a behavioral child started. The retained diagnostic measured a material RAM increase from the coordinator's2.69GB sample to3.70GB, with all RAM/disk gates passing; work continued under unchanged limits. The provisional blocker and correction are retained. No execution guard was exhausted.

All supervised child trees were cleaned up. No assigned Boat exists; other lifecycle ownership remains with the coordinator. No game, guest, compiler, native build, download, public deployment, main integration, worker launch, HeroesII work or Claude action occurred. Historical uncertain request12 remains untouched. Rejection blocks integration/runtime until a coordinator-assigned repair and independent acceptance; later runtime still requires current-main reconciliation and fresh full readiness/admission. No game-loading cause or playability conclusion is established.
