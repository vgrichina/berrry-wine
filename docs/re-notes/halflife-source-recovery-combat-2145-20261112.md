# Half-Life: closed source archive recovery audit, 21:45 task

The newly inventoried closed source payloads do not establish an eligible recovery chain. No archive was deleted, and no headroom was reclaimed. The member-proof observation measured **1,466,863,616 bytes actually free** on `/home`, below the required 1,500,000,000 bytes. Original Half-Life Uplink combat therefore remains unattempted.

Evidence is in `scratch/runs/20261112-halflife-source-recovery-combat-2145/`: `archive-inventory.json`, `source-tree-inventory.json`, `member-proof.json`, the read-only `audit.py`, and the final result/hash manifest. No evidence payload is committed here. Source base for this audit is `ef6fa04530fe761ff2c98029819fe174c5810762`; the run retains this note's new-file patch. Runtime source is unchanged.

The local inventory found 237 tar/zip-family files across runs and worker outputs. Capture, media, diagnostic, fixture and mixed evidence archives were excluded. Naming an archive “source” was not treated as proof. Source-name directories were inventoried separately; the inspected help-suspension, winhelp-lazy-document and legacy-sampler baseline directories contain tested modules, native executables or captures and remain untouched. The Airstrike residual archive includes Git internals and non-Git inputs and remains untouched. No earlier root allowlist or log recompression helper was rerun.

Four small, closed worker payloads received complete streamed member hashes and metadata, with original archive SHA-256, size, allocated blocks, mode, mtime, link count and closed-result hash recorded in `member-proof.json`:

| Closed worker output under `scratch/usage-watch/` | Archive | Bytes | Recovery finding |
| --- | --- | ---: | --- |
| `nfs2se-original-installer-output-oct28` | `source-payload.tar` | 20,480 | Its one file exactly matches recorded task commit `1dc6546fbfcd71f677c57a5ccd84b6cd01c12073`. |
| `nfs2se-retail-recovery-registration-oct28` | `source-payload.tar` | 215,040 | Both files exactly match recorded task commit `e56772ffe92bf3fe55a43840b4d28bd06ef9826f`. |
| `toyvm-browser-pointer-qualification-oct28` | `payload.tgz` | 755,428 | Several members differ from or are absent at recorded task commit `928d23d437c6d657f9309b6c05085ee6aa9ca369`; recovery is incomplete. |
| `toyvm-capture-cancellation-qualification-oct28` | `payload.tgz` | 759,596 | Source hashes exist, but the required exact commit and retained patch chain is not established. |

The NFS task commits exist locally but neither is an ancestor of main. Existing review-diff outputs are empty, and no existing binary-diff/new-file-patch chain from a recorded main commit was found in these worker outputs. The retail coordinator receipt explicitly records `mainIntegration: false`. Matching these task commits establishes their source bytes, but does not satisfy CLAUDE.md's recorded-main-commit recovery rule. The report gives exact `git show COMMIT:PATH` recipes and blob IDs for matching members; unproven members remain explicit. No alternative historical Git state was guessed. All four archives remain intact. Their combined logical size is only 1,750,544 bytes, also insufficient to bridge the observed 33,136,384-byte shortfall.

Validation streamed archive members without extracting a source tree and compared size and SHA-256 against Git blobs. The final verification reread archive hashes, original stat identity and each recorded Git blob, and checked every retained evidence hash. Documentation whitespace and relative links were checked. No build was run or claimed for this documentation-only change.

The [qualified 1 MiB caller](halflife-bounded-media-2125-20261112.md) and [prior visual route review](halflife-lossless-headroom-combat-2130-20261112.md) remain the next-run inputs. The original earned thirteen-file save, old 2055 PUT UNKNOWN, native pause helper and semantic ACK contract remain untouched. No API request, allocation, upload, native input, Save/Load or combat cycle occurred. No box was created: box ID, state, expiry and stop receipt are not applicable. Other workers, current/root/live directories and cache/reserve settings were not changed.

Next: establish sufficient actual local headroom through a separately justified, fully proven eligible recovery source. Then prearm the observable independent watchdog before a fresh private box and perform the already specified joined, hash-verified provision and reviewed native combat cycle. This task stops at the distinct missing-recovery-chain and capacity blocker.
