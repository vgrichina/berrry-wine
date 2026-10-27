# Independent GL output-confinement acceptance: REJECT

Exact candidate `2b825a30d178a34aca28b50307d87049693ba529`, tree
`1bc1326cd0ded0437980a1bb0e94f1abbbe2494d`, was tested through the actual
production runner and collector. All six current source/reproducer SHA-256 pins
and their candidate Git blobs matched before the minimal focused checkout.
Historical BEFORE pins were not substituted for current source identity.

The first behavioral checkpoint ran unchanged reproducer SHA-256
`c2af1d21e96800230e2bd7b266936979feb3d011fec8797e13c21c4203a5b628`.
The external adapter changed only its historical runner-hash constant and selected
the authorized exact Node executable. Its original admission injection and main
were retained. The historical success assertion raises TypeError on refused
collection; independent observations establish both production failures, zero
children, zero outside content/allocation, no collection and no complete final
accounting. This checkpoint PASSED.

The next independent challenge REJECTED the strict zero-external-write contract.
Immediately before the first `os.write` on `node-startup.log.new`, one hardlink
was created from that exclusively-created regular inode to a path outside the
synthetic runner root. The task root, ops and output directories never moved.
Production wrote **2358 content bytes / 4096 allocated bytes** to the now-aliased
inode, then refused at its post-write link-count check. The exact production
startup child completed and was cleaned up. The test child was never invoked;
collection refused and no complete-accounting receipt was published.

This is an outside alias to a task-created inode, not a redirect into a preexisting
outside target. The outer allocation counts the inode; no byte-accounting or outer
admission bypass is claimed. No arbitrary-existing-file corruption is claimed.
The failure is that a single late link creates externally visible output bytes
before safe refusal, contrary to the assigned zero-external-write condition.

`OutputFiles.write` checks link count before its write and after its write. Neither
check prevents another namespace writer linking the inode in between. The
documented root-relocation boundary does not explain this test: no root relocation
occurs and only one link operation is injected. Userspace inode checks are not an
OS sandbox. This rejection does not authorize permissions, services, trust or
deployment changes. Narrow repair scope: resolve the write-time external-alias
contract in the runner (and its mirrored collector helper contract), or obtain an
explicitly narrower threat boundary excluding external hardlink creation, then
repeat independent acceptance. Adding another pre/post check alone cannot prove
the current zero-write guarantee against this actor.

First rejection STOPPED integration. Production/source/fixtures were not repaired.
Normal full-entry completion, broader independent races and removal mutants,
dependency receipt reuse, merged-tree tests and main publication were not reached.
Existing 40 fault/2 child-failure, 27 accounting/9 helper-omission and routing
receipts remain retained donor evidence, not newly accepted groups. Root's prior
55-payload hash audit is referenced once; no bulk evidence was copied.

Reproduce using the minimal candidate checkout recorded in `pins.json` and the
installed supervisor closure. Put the exact retained `reproducer/accept.py` and
`reproducer/hardlink-race.py` into a sibling `ops/` directory beside that checkout
named `repo/`. Under the prescribed pool/supervisor, run `accept.py startup`,
`accept.py first`, then `hardlink-race.py`. The last exits 1 with the exact
counterexample. `reproducer/run.py` records per-group controls and atomic
checkpoints. It uses the installed supervisor and Git-child wrappers in place.

Node is `/home/user/.nvm/versions/node/v24.18.1/bin/node`, version 24.18.1,
SHA-256 `f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`,
heap flag `--max-old-space-size=512`, inherited DATA/AS unlimited. An actual startup
passed before acceptance. Environment identity is hashed; private values remain
in external ops receipts. The heap flag is not a physical cap. Tests used the
installed unchanged supervisor SHA-256
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`,
128 MiB physical supervisor/descendants, CPU90s/wall120s/file24MiB/output2MiB/
excerpt8192B. Git uses both pool permits, then flock, physical256MiB and DATA512MiB
only on the Git subprocess. Complete local allocation is 60MiB including
source/Git/temp/evidence28MiB, events/session/positive WAL16MiB, publication8MiB,
reserve8MiB. Standing donor/tools were used in place; large tool hashes streamed.
Admission receipts retain actual measurements and incidents.

Only rejection documentation is published on the independent task branch. Main
and all candidate production blobs remain unchanged. No guest, browser, Chrome,
Wasm/native execution, Boat query, lifecycle/service/deployment/trust change,
worker launch or refill occurred. No box was assigned. Coordinator owns Alien
`bx_c7m7bu48`; its state/expiry were not queried here. Historical GL remains
**0/42 WebGL1 and 0/42 WebGL2** pending separately admitted real-browser testing.
