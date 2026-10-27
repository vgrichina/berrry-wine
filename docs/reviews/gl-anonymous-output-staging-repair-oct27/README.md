# GL anonymous output staging repair — independent acceptance pending

This source/test task repairs immutable candidate
`2b825a30d178a34aca28b50307d87049693ba529`, tree
`1bc1326cd0ded0437980a1bb0e94f1abbbe2494d`. It does not accept or integrate the
repair. The independent rejection is retained at commit
`8566c36a6d0160bace540114dde8e3d0e6a056a6`; its readonly donor was used in place.
All six dispatched physical SHA-256 pins and candidate Git blobs were verified
before the focused checkout. Unrelated candidate tree entries are preserved.

Before editing, the byte-exact independent late-hardlink action reproduced
**2358 content bytes / 4096 allocated bytes** outside the production output root,
after the startup child and before refusal. Only startup ran; collection and
complete accounting refused. Root/ops/output were not relocated. The unchanged
reproducer SHA-256 is `109fde795e3489590db0203e96cdfe0f44b5a9ca037a1e832a4bb38ee66d4efe`.
The original independent admission injection file also remains byte-exact at
`c2af1d21e96800230e2bd7b266936979feb3d011fec8797e13c21c4203a5b628`.

## Implementation and Linux prerequisites

Both log/JSON writes and the test child result now use `O_TMPFILE | O_RDWR |
O_CLOEXEC`, mode 0600, relative to the verified output directory descriptor.
There is no output-directory name while producers write. The child still writes
through `/proc/PARENT/fd/N`. After the child returns, publication additionally
requires its successful cleanup receipt and absence of a supervisor stop reason;
a cleaned-up child exiting 7 retains the previous failure-result semantics.

Only after all producer writes finish does `linkat(AT_SYMLINK_FOLLOW)` link the
anonymous descriptor, through `/proc/self/fd/N`, to an exclusive `name.new` in the
verified open directory. Descriptor-relative replacement then publishes the
normal final name. There are **no producer writes to that inode after its first
link**, including if someone subsequently hardlinks it. This closes the original
named-inode write-time alias race; another pre/post `fstat` would not close it.
Replacing a final name creates a fresh anonymous inode, never truncates the old
one, and never writes through a preexisting symlink/hardlink.

The Linux manuals document [O_TMPFILE](https://man7.org/linux/man-pages/man2/open.2.html)
and the [procfs linkat alternative](https://man7.org/linux/man-pages/man2/link.2.html).
`O_EXCL` is deliberately absent because it prevents later linking of O_TMPFILE
inodes. The procfs alternative avoids AT_EMPTY_PATH's CAP_DAC_READ_SEARCH
requirement. Actual local prerequisites passed as UID1000, CapEff zero, owner1000,
mode0600 and nlink0. The local filesystem supported anonymous creation, procfs
link publication and collection. An unsupported filesystem/kernel/procfs or
permission error refuses; there is no named-file fallback. No privileges,
permissions, mounts or services were changed. Remote filesystem support must
still be checked in the separately admitted production environment.

Live anonymous descriptors contribute their physical `st_blocks*512` to the
production complete allocation and peak/cap checks. Once linked, the directory
ledger owns their blocks, without double charging. The test oracle independently
enumerates open anonymous descriptors; a transient 1 MiB child allocation that is
truncated before publication is measured. Removing anonymous accounting is
rejected even though the final named inventory can still be correct. Unpublished
descriptors close on exceptions; failed publication removes its owned temporary.
The collector's mirrored OutputFiles class remains exact, and its safe read,
inventory, receipt ownership, hash/length and cleanup contracts are retained.

## Behavioral evidence

`results.json`, `tested-tree.json`, `dependency-audit.json`, and the recursive
evidence manifest bind commands, source/test hashes, receipts and results.

- Eleven new production-entry tests use real lightweight exact Node startup and
  synthetic successful results, then exercise collection and final accounting;
  unsupported anonymous creation/publication; symlink/hardlink/directory
  replacement; short-write/publication failure cleanup; late links after
  publication; child cleanup refusal; and meaningful staging/publication/
  accounting/cleanup removal mutants.
- The byte-exact independent late-hardlink script executes unchanged. Its
  original os.write hardlink action remains intact. The assertion adapter
  independently requires complete successful production routing/collection,
  zero outside names/content/allocation, anonymous nlink0 writes and cleaned-up
  real Node children. The historical `len(injected)==1` assertion fails because
  the formerly reachable named writable inode no longer exists. Its exception
  alone is never behavioral success. Restoring the original named-write method
  recreates the rejection with 2358/4096 outside bytes.
- The unchanged admission injection safely refuses before any child or external
  write. The 40 affected immutable-input faults and two child-failure cases pass;
  all six routing omissions are rejected. Both mirrored helpers retain file-type,
  read-open, content/metadata, directory and collector-inventory race controls.
  Late log/safe collector read omission mutants and primary-exception preservation
  also pass.
- Dependency audit reuses twenty of the twenty-seven unchanged ledger cases by
  exact test-method AST, unchanged installed supervisor and rehashed passing
  receipt. Seven production-callback cases reran with the actual OutputFiles
  class and current output path. Eight of nine helper omissions reran; the
  unchanged root-validation omission receipt is reused. Earlier receipts are
  retained by reference, without copying bulk evidence.

The production runner is parameterized only for local task roots, harmless ELF
version checks, lifecycle clock and synthetic child workload. The actual
production integrity, ledger, callbacks, environment handoff, output routing,
finalizer and collector execute. Exact Node is
`/home/user/.nvm/versions/node/v24.18.1/bin/node`, SHA-256
`f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`, flag
`--max-old-space-size=512`, inherited DATA/AS unlimited. Startup receipts retain
actual limits, environment identity and cleanup. The heap flag is not a physical
cap. The synthetic 42 fixture objects per version establish **zero** browser or
WebGL observations.

Reproduce under the task's admitted execution-pool/supervisor controls:

```sh
python3 test/test-gl-anonymous-output-staging.py
python3 test/test-gl-output-file-confinement.py controls
python3 test/test-gl-runner-output-namespace.py Entry.test_required_faults_refuse_next_child Entry.test_child_failure_cleanup_and_known_final_bytes
python3 test/test-gl-runner-output-namespace-omissions.py
```

The small retained recipes select only affected accounting methods/omissions and
retain the original baseline Node/reproducer bridge. Donor paths in those recipes
are standing immutable inputs, not assets to bulk-copy.

## Threat boundary, resources and handback

This is a userspace output-publication guard, not an OS sandbox. Actors that can
open, duplicate, write, link through procfs, inject syscalls or otherwise manipulate
process descriptors (including a same-UID actor with that access), privileged
mount/process manipulation, and a surviving writer despite a false cleanup
receipt are not isolated by this code. A directory descriptor pins an inode,
not its pathname forever: identity checks detect namespace replacement but cannot
atomically prevent arbitrary namespace relocation at the publication syscall.
Completed files may be moved or linked by a namespace writer. The guarantee
addressed here is that ordinary output-namespace names cannot alias an inode
while these producers are writing it; neither post-publication immutability nor
unconditional zero external visibility under privileged/FD attacks is claimed.
Directory/symlink/hardlink/collector adversarial controls are retained, rather
than excluded to obtain a pass. Independent acceptance must assess this boundary.

Complete local allocation stays within **48 MiB**: source/Git/temp/evidence16,
external session/events/positive WAL growth counted once16, publication8 and
reserve8. Standing donor/tools are neither copied nor double charged. Every
group retains fresh measured/prospective admission with host floor2982150144B
and required future RAM1610612736B. An initial nested Git flock was stopped and
corrected; a later disk-floor denial stopped its test before execution. The
remaining concrete projection was resized within the existing allocation,
without relaxing the floor or execution limits. A trailing fixture blank line
and an index initialization error in the intermediate source-only tree receipt
were corrected; first incidents and superseded receipts remain external.

Tests use pool1 and the unchanged installed supervisor SHA-256
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`, physical
128MiB whole supervisor/descendants, CPU90/wall120/file24MiB/output2MiB/excerpt8192B.
Git uses pool2 then flock, physical256MiB and DATA512MiB on Git only. Actual
sampled/waited RSS is a lower bound as documented by the supervisor. Canonical
mount-parser and exact trusted SSH configuration were checked before checkout;
there are no mounts in this local synthetic workload. Normal task-branch push
requires exact remote-ref verification. No main write/merge, public deployment,
browser/guest/Chrome/Wasm/build, Boat query, service change or worker launch occurs.

Source-only tree: `1212459af97b992b8e9816a0d56fbfb9425f1159`.
Source/test/fixture tree: `5a38ce5871c8254368b2f1939e94c0fb6e5e5b0b`.
The final committed tree and exact verified remote commit are recorded in the
external consolidated closeout, avoiding a self-referential commit manifest.
Next gate: fresh independent acceptance of the exact committed production runner,
starting with the retained late-hardlink action and legitimate Node collection/
accounting, then only affected races/mutants. Main integration remains coordinator
owned. **GL remains 0/42 WebGL1 and 0/42 WebGL2** until separately admitted real
browser qualification. No box is assigned here; Alien `bx_c7m7bu48` state and
expiry are not queried. The coordinator retains its lifecycle ownership.
