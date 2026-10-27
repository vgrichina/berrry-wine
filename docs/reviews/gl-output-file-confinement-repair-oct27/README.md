# GL mutable output file confinement source repair

Parent/donor: `2f4f8b5e2ff154afc60b4124a54ac6615ae223ac`, the independent
rejection of candidate `c9f8f28cf8d5760db9330bbf86a8923a78df569b`.
This task changes the production runner and registered collector only, plus
focused tests and this review. It does not integrate main or qualify GL runtime.

The unchanged independent reproducer first reproduced the original escape:
2358 content bytes / 4096 allocated bytes outside the synthetic runner root,
collected successfully while final accounting claimed complete 139264 bytes.
The outer worker allocation counted that target; no outer gate bypass is claimed.
On the repaired source, the same admission injection leaves the outside target
empty (zero allocated bytes), refuses the next child, and makes collection fail.
It cannot publish a complete final accounting receipt through that unsafe
namespace. Both the reproducer and historical before fixture retain their exact
original bytes. `before-report.json` and `after-report.json` retain the contrast.

`test/test-gl-output-file-confinement.py independent` is an external assertion
adapter. It verifies the unchanged reproducer SHA256, rebinds only its historical
RUNNER_SHA constant in an external AST, and calls its original main/injection.
Its success-shaped collection assertion now raises TypeError on a refused
collection. The adapter accepts that only after inspecting both actual production
errors, no invoked children, no collection, no complete accounting and zero
outside content/allocated bytes. It does not rewrite or suppress the injection.

The flat `ops/output` contract now rejects every symlink (including dangling
links), hardlink, directory and special file instead of skipping descendants.
Operations open and compare task-root, ops and output directories using
O_DIRECTORY/O_NOFOLLOW. Writes use exclusively created single-link regular
temporary inodes and publish through the verified directory descriptor; destination
links are never opened. Before/after inode/type/link-count and directory checks
fail closed on substitution. All temporaries remain inside the accounting root.
Failed temporaries are retained and counted, not excluded to manufacture success.

The child result is exclusively created inside output and exposed to the child
through `/proc/PARENT/fd/N`. A mutable leaf cannot redirect that child write.
The runner still checks immutable inventory before reserving the result and before
each child, and verifies the result descriptor remains bound to the same named
regular inode. JSON/log reads use O_NOFOLLOW/O_NONBLOCK descriptors, identity and
metadata checks, and a repeated byte comparison because rapid writes can share
filesystem metadata timestamps. Collection checks the whole inventory before and
after and hashes/parses the same safely read bytes. Diagnostic failures preserve
the original exception and never authorize unsafe output or known byte claims.

The small descriptor implementation is intentionally inline in the standalone
runner and collector: no new remote helper/staging dependency or immutable-input
guard exemption is introduced. This is race-aware file I/O, not an OS sandbox
against an actor authorized to relocate the owned task directory or manipulate
its namespace indefinitely. Directory identity changes make accounting unknown;
independent acceptance must review that boundary explicitly.

New controls cover initial and late leaf substitutions, exclusive-temp-open
injection, read-open replacement by links and regular files, same-size read-time
mutation, child-result substitution, directory substitution, whole-collection
inventory replacement, invalid basenames and primary-error preservation.
Two focused production mutations are rejected: replacing the confined log write
with the old write_bytes call, and replacing the confined collector read with
the old pathname read. The latter proves that a later inventory failure alone
is insufficient: the test detects an external read before that failure.

The exact full production entry passes the normal collector names/lengths/hashes,
two receipts, ownership, cleanup, invocation-start routing, atomic-temporary and
final allocated-byte contracts. It executes real lightweight Node v24.18.1,
`/home/user/.nvm/versions/node/v24.18.1/bin/node`, SHA256
`f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`,
`--max-old-space-size=512`, DATA/AS unlimited. Exact startup argv, environment and
limits are retained in the Node receipts. The synthetic workload has ZERO GL
observations and loads neither Puppeteer nor Chrome. Historical GL is unchanged:
**0/42 + 0/42**. The heap flag is not a process physical-memory cap.

The 40 affected immutable ops/source/fixture fault cases and two child-failure
cases pass again. Six routing omissions use the new safe I/O/descriptor handoff
locations with the same routing/accounting assertions; their old text markers no
longer exist. The unchanged 27 allocated-block cases and nine helper omissions,
and unchanged historical before failure, reuse exact-hash verified donor receipts.
No allocated-block helper, framebuffer oracle or supervisor source changed.
See `reuse.json`, `checkpoint.json` and `evidence-manifest.json` for exact identities
and dependency qualifications; implementation tests are not independent acceptance.

All local execution uses the installed pool and unchanged supervisor SHA256
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`.
Tests take one of two shared permits and a physical 128 MiB whole-tree cap; Git
takes both permits before the shared Git flock, with 256 MiB physical and 512 MiB
DATA applied only to the Git subprocess. CPU 90s, wall 120s, file 24 MiB,
output 2 MiB and excerpt 8192 bytes remain enforced. The Codex client is separately
accounted and does not belong to the 128 MiB test cap. Complete local allocation
is 60 MiB, including source/Git/evidence, session/events/positive WAL growth once,
publication growth and reserve. No tool or runtime asset copies were made.

Incidents are retained: initial 64 MiB admission missed the floor by 520192 bytes;
the initial Node hash used one large read and hit the physical cap (streaming
hashing corrected it without raising limits); the first read-race control exposed
timestamp coalescing (repeated descriptor-byte comparison corrected it); reserving
an empty result before the immutable check broke affected fault fixtures (the
source check now precedes reservation). Initial resource tracking knew only the
original peers; new coordinator replacement lanes were subsequently discovered
and incorporated conservatively before packaging/publication. Original failed
receipts and donor incidents, including the historical overwritten intermediate
package receipt, remain disclosed. No access denial was retried or bypassed.
The first packaging attempt lacked an author identity in the minimal initialized
Git repository; the donor identity was then reused in task-local configuration.
The original failed package receipt remains retained; trust and credentials were
unchanged.

Recovery: use the retained installed pool/supervisor/controller recipes, trusted
SSH configuration and minimal Git index/write-tree --missing-ok/commit-tree recipe.
Run the adapter `independent` first, then `normal`, `controls`, `omission`,
`collector_omission`, `primary`; rerun only dependency-affected groups. Transfer
the exact registered current runner/collector with immutable hashes in a future
admitted runtime fixture; never replay the historical flat-ops collector.
Future remote work requires fresh full resource/lifecycle admission, exact real
remote Node startup, and actual 42+42 browser qualification. No compile is needed
or authorized by this source-only recovery recipe.

Remaining gates: independent affected-source acceptance, coordinator-owned
integration after acceptance, then separately admitted exact remote startup and
real GL qualification. No assigned box, API query, staging, guest/browser/Wasm
compile, service/deploy, credentials/trust change, worker launch or refill occurred.
Enigma/Alien ownership, Claude idle, HeroesII laptop and actual platform denials
are preserved. The coordinator retains lifecycle ownership; this worker did not
change or query any box state. Board-reported coordinator lifecycle changes are
reported as such, never as this worker's runtime observation.
