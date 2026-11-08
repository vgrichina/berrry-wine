# Offline FINAL1910 streaming restore

`tools/streamed_gzip_upload.py` and `tools/darkstone_streamed_restore.py`
replace the checkpoint portion of the old prepare/upload sequence for a future
explicitly owned fresh runtime. The adapter reads canonical FINAL1910 recovery
metadata and gzip paths directly; it never creates a local checkpoint directory
or decompressed save. The historical 1940 scripts and evidence are unchanged.

The inspected transport is
`scratch/runs/20261106-alice-dialogue-qualified/transport.py`, selected by
1940's `remote.py`: request a presigned upload URL, then HTTP PUT. Its old
`upload(path, data)` buffered bytes. Python's HTTP client supports an iterable
body with explicit Content-Length; the new helper uses that capability, refuses
redirects, and performs no retries. No provider capability or live box was
assumed or probed.

Every source is read to completion before requesting its URL, then validated
again while streaming in at most 65,536-byte output chunks. Both passes require
the canonical compressed length/SHA, exact decompressed length/SHA, and a single
complete gzip member with valid CRC/ISIZE. Truncation, oversize, concatenation,
trailing content and changed source bytes fail closed. Acceptance requires full
iterator completion, HTTP success, then an independent remote file length and
SHA read through the existing transport's bounded `remote` command. Both saves
must return acceptance before the adapter returns a pair receipt.

| FINAL1910 file | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,316 | 4762ae9c0d7d048595433d121629a87d5a1aa24e7c3ebe84c7605006e3c10baa |
| game641d_6af0ca48.sav | 3,204,341 | 5e898dc9d6f7a13350c939bf5b712eccfff95ef1072c93023103705999f84ffc |

Future caller integration is
`restore_pair(repo_root, owned_transport, ROOT + '/' + RUN + '/checkpoint')`.
The caller must use a fresh unique owned destination and its existing absolute
lifecycle deadline. Socket timeout alone is not an absolute operation deadline.
The caller must quarantine any unsuccessful destination and withhold staging
readiness; exceptions may leave partial remote content or one verified file.
Never repeat an UNKNOWN operation. This adapter supplies checkpoint transfer;
it does not retrofit the old physical-helper closure validator or publish the
whole runtime's staging barrier. Future selection must reference the canonical
gzip sources instead of requiring local uncompressed checkpoint providers.

Evidence: `scratch/runs/20261108-darkstone-streamed-restore-2003/`.
Ten focused tests include real Content-Length HTTP PUTs to an isolated local
sink process. The sink hashes received bytes without writing decompressed
files. The exact historical prepare loop, extracted as AST, attempted
**4,546,657 bytes** of intercepted local writes. The new consumer transmitted
the same canonical pair under a local-write prohibition with **zero** such
bytes. Controls reject wrong hashes/lengths, corrupt CRC/footer, truncation,
oversize, concatenated/trailing data, source mutation between passes, partial
2xx uploads, disconnects, HTTP failure, redirects and UNKNOWN hash outcomes.
The sink has an actual TERM wait of -15 and drained pipes; the enclosing
observable independent `timeout` deadline was prearmed before log draining.
Unique check/build logs are gzip from outset with original stream size/SHA and
independent gzip reread. Git SHA plus small relevant patches preserve source.

This repairs provisioning storage only. The locked full build and focused
controls are recorded in the run. No box, Chrome or original was allocated or
launched; box ID/state/expiry/stop receipt are not applicable. Historical 1940
in-flight upload UNKNOWN and FINAL1910 reload/normal-Chrome uncertainty remain
unchanged. Full27, parity, audio and FPS remain open. Next is a separately
assigned fresh provisioning integration and native recovery attempt. STOP.
