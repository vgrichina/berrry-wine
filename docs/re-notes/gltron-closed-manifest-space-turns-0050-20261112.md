# GLTron closed-manifest recovery and remaining storage blocker

Lossless sibling gzip encoding replaced **68 closed identity manifests**. Every
original byte remains locally recoverable. The prepared GLTron two turns and
native round outcome remain unproved: actual free disk stayed below
1,500,000,000 bytes after this batch, so no API, box, browser, or input was started.
This is a demonstrated eligible-storage boundary, not a new controller or game
failure. No old box was resumed.

Evidence: `scratch/runs/20261112-gltron-closed-manifest-space-turns-0050/`.
The exact claimed paths are in `planned.json` and the append-only messageboard;
`recovery-index.jsonl` contains the 68 successful originals, sibling archives,
SHA-256, size, mode, nanosecond mtime, ownership and stable inode metadata.
`unlinked.jsonl` records completed removals. One planned manifest,
`20261112-quake3-capture-completion-major-1910/runtime-pins.json`, remained raw
because a privileged process scan found PID 393327 referencing its run.

Each file passed a strict schema limited to file paths, byte counts, hashes,
URLs and short app/commit identities. Payload fields and long strings were
rejected. Canonical processed completion, actual worker exit 0, and a directly
referenced published note naming the same run were required. Newer canonical
records sometimes put the reviewed commit in prose; `extend-closure.py`
resolved those to published main ancestry instead of treating the incomplete
older map as authoritative. Historical filenames containing “current” were
eligible only with this closed evidence and no current ownership/dependency.
Active/root runs, all 20261112 NFS3/GLTron families, Heretic II/Heroes material,
ambiguous runs, symlinks/hardlinks and existing archive cases were excluded.
No SHA256SUMS/evidence inventories, source, helper, patch, binary, media, save,
capture, log, cache, vendor, reserve, database or session files were changed.

The PYC0030 worker completed and released before raw unlink. None of its exact
635 retained source/patch dependencies overlapped these paths; all 635 hashes
were independently reread unchanged afterward. Compression used exclusive
sibling creation. Independent `gzip -dc` decoded all bytes, checked original
SHA/size, and parsed the schema again. Before unlink, each archive and directory
were fsynced; a durable recovery index and per-run
`MANIFEST-RECOVERY-0050.md` pointer were written. Two privileged complete process
scans and stable original metadata/hash checks guarded each removal. Metadata
hash fields are identity records, not execution proof.

All **68 actual RAM restores** passed SHA/size, original mode and nanosecond
mtime, and refused overwrite, both before unlink and again from the durable
index afterward. Eight negative schema cases rejected source/code/text/data/
base64/body fields, an overlong string, and an embedded body field. Recovery
never executes any referenced file. To restore one original, copy its exact
indexed path into:

```sh
python3 scratch/runs/20261112-gltron-closed-manifest-space-turns-0050/recover.py restore scratch/runs/EXACT-CLOSED-RUN/runtime-pins.json
```

The command accepts only an indexed original path, retains the sibling gzip,
and refuses an existing destination. It restores original bytes, mode and
mtime. Each affected run has its own concrete recovery command.

The removed originals held 22,183,234 logical bytes / 22,319,104 allocated bytes.
Their sibling gzip files hold 6,168,659 logical / 6,299,648 allocated bytes;
recovery pointers allocate 278,528 bytes. File-and-pointer net reclaim is
**15,740,928 allocated bytes**, before this task's central evidence overhead.
Observed shared-filesystem free space was **1,482,739,712 before** and
**1,497,694,208 after** the batch; after RAM verification and evidence writes it
was **1,497,358,336**. Those samples include concurrent writers and are not an
attributed reclaim claim or continuous floor guarantee.

The inventory examined 1,236 present allowed-name files, not the owner's older
1,337-file upper bound. Of 775 closure-qualified schema candidates, 679 offered
no conservative block benefit, 27 had unsupported/nonidentity schemas, and 69
were planned (68 completed, one live reference preserved). Other candidates
lacked direct canonical own-run closure or were excluded/link/archive cases;
`inventory.json`, `schema-rejections.json` and `scope-dispositions.json` retain
the exact reasons. No permission to reclaim the remaining ambiguous files is
inferred from their sizes. No floor hold or allocation retry followed.

Prepared controller/build/ChromeWorker work remains at published `ba0cebc31`,
provider/RAM staging and compact consumers at `5c2c410a5`, and the prior no-box
handoff at `f0fc77135`. Their matrices and 737-input closure were not rerun as
new execution proof. This run records the current Git SHA, relevant binary
diff, owned helper/note patches and existing media-reference identity without
source/media archives. No runtime production source changed, so no new build
was required. No native turn/outcome, physical GPU, FPS, audio or parity claim
is made.

New box: **NONE / NOT_CREATED**, expiry null, stop receipt not applicable.
Next needs additional specifically justified storage headroom, then a fresh
private box with the independent observable watchdog armed before creation,
full fresh provision/identity and the reviewed finite Return/A/S controller.
