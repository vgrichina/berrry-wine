# Half-Life: bounded media caller prepared; fresh attempt held locally

Run `scratch/runs/20261112-halflife-bounded-media-2125/`. This investigation
identifies the upload-path mismatch in `e27fb3409` and tests a replacement
caller locally. A fresh remote transfer and living combat consequence remain
unproved because actual `/home` free space stays below the owner's floor.

The actual 2055 `provision.py` calls `provision_files`, which sends each entire
file in one PUT. Its `provision-blocker.json`, stderr and control upload events
record the 79,150,544-byte `valve/pak0.pak` body-write timeout at
30.000812 seconds, after 13,631,488 bytes of complete chunks. The uploader
actually exits 1 with both pipe EOFs. This is an UNKNOWN partial PUT, not a
failed chunk-assembly transaction. It is never replayed here.

The supported `provision_chunked_files` path already exists in
`tools/q3-provider-upload.py`, SHA256
`29d148d81929464f92bce963f68118337cf89524f0d3b77bff629ef12c9afa95`.
Q3's retained 1910-small-upload and 2055 callers select `HTTP_PART=1048576`
on that function's globals. The default is 4 MiB; the 1 MiB selection changes
neither the absolute 30-second PUT cap nor the assembler's validation.
`tools/api_command_custody.py`, SHA256
`c5595d0d7b1084faa40bd4e0dffed08d24add35617bdae6b0e97d497d983c8e8`,
provides one-shot command identity/completion observation. Its default
`Transport.provision` uses the chunked helper with the default range size;
the qualified Q3 caller explicitly selects the smaller size.

The new run-specific `provision.py` freezes both tool hashes, selects the same
1 MiB path, checks the caller's effect gate before each upload authorization
and remote command, and makes a transfer failure terminal in the transport.
It does not import or reuse the terminal 2055 lifecycle. It requires the fresh
caller to prove its outer process wait, both pipe EOFs and staged import before
original launch. No production defect is proved and no production source is
changed; no locked-build claim is made for this documentation-only commit.

`check-transfer.py` tests this exact adapter against a local HTTP receiver and
actual Python assembler children with 2.5 MiB of synthetic bytes. The three
PUTs are exactly 1,048,576, 1,048,576 and 524,288 bytes, with unique paths and
independently checked range SHA256 values. Whole assembly and final descriptor
reread pass. Deliberately corrupting the second received range refuses assembly,
publishes no destination and emits no all-remote-verified barrier. Both cases
retain actual child waits and separate stdout/stderr EOFs in
`transfer-check.json`. All synthetic inputs and receiver files are removed.
This is local transport evidence, not remote delivery or gameplay.

Read-only verification passes all 954 inherited upload pins. The actual pak
has SHA256 `c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`;
`pak-range-plan.json` records hashes for its 76 ordered 1 MiB-or-smaller ranges
without copying media. All 13 earned1825 save records independently decode and
hash, totaling 2,342,063 bytes; the compressed original remains 758,472 bytes,
SHA256 `df8d61b2fcdd285a6a28e2e180930e6ee60eff388cd9bf31c557d3409dd18e51`.
The corrected `lib/renderer-input.js` is byte-identical to `ae83f8d55`.
Browser, finite input/cycle, semantic delivery and capture selector helpers
remain pinned by SHA. Solved control matrices are not repeated.

Local disk samples remain below 1,500,000,000 bytes; the final preparation
recheck is **1,483,886,592 bytes**, and the closing hold is **1,481,863,168 bytes**.
No one-shot API request, allocation, watchdog,
upload, remote command or native input occurs. Root catalog RAM and reserve
remain untouched. No current CPU/owning GL/full22 or original PAUSED frame,
attack, hit, defeat, guard consequence, death, native Save/export/load or useful
successor is claimed. The original13 is preserved. Git SHA, relevant binary diff
and owned helper patches are retained; no source or media archive is made.

No box is created, so there is no new expiry or stop receipt. Prior
**bx_qwekfmpb** remains untouched: its retained terminal receipt says
**archived, expiry null**, stopped **2026-11-12T21:02:48.634Z**,
**stop_361519b9f33a7197**, completed, forced false, error null. This is historical
evidence, not a new lifecycle query; its partial PUT stays UNKNOWN.

Next: obtain actual disk headroom, freeze a fresh complete provision manifest,
prearm and observe the independent two-hour watchdog, then use the tested
bounded caller on a fresh private box. Require actual provisioning join,
all chunk/whole hashes and staged import before exact whole13 restoration,
ordinary UI 03:18 Load and full native PAUSED review. Continue only one visually
aimed finite action and full consequence per ordinary resume/pause cycle, with
independent UPs. Transfer success alone earns no gameplay claim.
