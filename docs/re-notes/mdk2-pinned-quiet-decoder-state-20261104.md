# MDK2 pinned quiet bridge and bounded decoder context

Follow-up to `c032c078406bb04a115346b5546d3f1a678216f7` and
[the keyup diagnosis](mdk2-native-keyup-cause-20261104.md).
Evidence: `scratch/runs/20261104-mdk2-pinned-quiet-decoder-state/` (RUN).
Offline only: zero Chrome, game recapture, shared runtime lock, boat, deployment,
or subworkers. Box ID/state/expiry: NA; shutdown remains with the coordinator.

The actual `mdk2-local-runtime.start()` caller still loads the exact resolver
from `da862db135ef8d0b3bf43c0d7d453f945b44c5a5`, with its original SHA checked.
Its explicit candidate composition now amends only `lib/guest-rpc.js` from
runtime Git `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`. The resolver file on
main is unchanged. The original bridge SHA is
`39c0d671833330c71964c2f7ca4e24b1fc841b79e8eb54027d7889a9d2d306a1`;
the amended SHA is
`075388dd3e52b2b137c12111b34406be651467004333567a0be47e09c9f3763b`.
The sole dependency edit adds `log_block` to the existing quiet-log condition.
The candidate manifest records this amendment and changes exactly one of 432
file rows; module rows and all other runtime dependencies remain original.
Original bytes are verified on every read before transformation. Filesystem,
HTTP and the caller's runtime-pin admission use the same explicit manifest.
The local caller includes its amendments in `original-adapter-proof.json`.

Both retained modules execute through the actual serialized binding, original
Worker queue and candidate resolver's bridge bytes. Quiet execution makes zero
brokered block-log calls; explicit `forwardGuestLogs:true` forwards them.
Both the historical and amended bridge propagate a throwing brokered
`log_block` into the binding's original-import-failure path. The longer original
65536-word decoder discriminator also uses the resolver amendment, rather than
a separate test-only string replacement. Existing original/quiet guest-byte,
register/lazy-flag, queued-command and trap comparisons remain in place.

Decoder interpretation was derived first from the SHA-verified existing
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`
(`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`).
RUN retains focused objdump output, not a media copy. In `0x47d980`, SUB ESP,8
and four saved-register pushes place the caller at ESP+24, decoder argument at
ESP+28, destination at ESP+32 and requested output bytes at ESP+36. At
`0x47d9c8`, EBX owns the decoder, ESI is the current decoded-dword cursor,
EBP the next 16-bit destination and EDI the remaining decoded words. ESP+16
holds bytes produced and ESP+20 the arithmetic shift. The epilogue stores
ESI/EDI at object+0x4c/+0x50; the caller resumes at the captured ESP+28.

The original routines establish these object fields:

| Offsets | Interpretation and original evidence |
| --- | --- |
| 0x00, 0x04, 0x08, 0x0c | Read callback, opaque callback argument, input buffer, capacity; `0x47cf60` pushes capacity/buffer/argument and calls `[object]`. |
| 0x10, 0x14 | Input cursor and signed remaining bytes; `0x47ceec..0x47cf19` consumes bytes and calls refill when exhausted. |
| 0x18, 0x1c | Bit reservoir and bit count; the same loop shifts incoming bytes, then subtracts consumed bits. |
| 0x20 | Output arithmetic shift; `0x47d993` and `0x47d9ca`. |
| 0x24, 0x28, 0x34 | Channel stride, transform rows and transform buffer; `0x47cecb..0x47cf42`. |
| 0x2c, 0x48, 0x4c, 0x50 | Block words, remaining words, stored decoded cursor/count; `0x47da1f..0x47da3e`. |

The observer checks the complete original output routine bytes before accepting
an output frame, and checks EBX against its actual stack argument. It captures
GPRs, lazy flags, yield reason, 16 caller-stack words, 21 raw object words and
named cursor fields. Input, decoded-source and destination windows are each
at most 16 bytes, shortened at their known remaining length. Total captured
guest data per context is at most 196 bytes with a hard 256-byte ceiling.
Output, frozen output samples and the observed caller return use the existing
record ledger. Pending decoder frame identity survives terminal reporting.
The existing command captures still retain independently frozen renderer input
queue/key state; the new native record does not invent an input poll.

The actual native `run()` wrapper retains the latest received slice budget,
ordinal, completion state and resulting block count. Decoder contexts copy
the in-progress budget/ordinal. This records the budget the original host
actually sent after its adaptive feedback; it does not infer it from selector
steps or change the host feedback algorithm. All native ownership, deadline,
50M boundary, 512 record and frozen-review guards remain active. Guest code,
configuration, 16ms pacing and selector 512/544 caps are unchanged.

The bounded replay fixture invokes the original `0x47d980` on four explicit
decoded dwords. It restores only the captured frame, object, source window and
GPRs at `0x47d9c8`, then reproduces the output and caller return through normal
queued execution in each retained module, checking final registers/lazy flags
and output against the first execution. A tracing-only control establishes
passive capture parity. Incoming lazy flags are recorded;
this short suffix recomputes its flags before any conditional branch, so the
fixture does not fabricate flag setters. Bounded windows cannot reconstruct a
whole live decoder stream or an external read callback. No release-consumption,
Medium callback, level construction or gameplay result is claimed.

Validation passed all 149 integration tests, 42 local-runtime tests, both-module
observer parity and `flock /tmp/wine-build.lock bash tools/build.sh`. Final
focused tests additionally cover tracing-only decoder parity and replayed
registers/flags. The zero-Chrome actual local entry reaches mocked Puppeteer
after verifying the amended bridge through all 432 filesystem/HTTP rows; its
caller-written manifest/proof are checked and their bridge rows retained.
Validation results and Git/module path+SHA references are retained in RUN.
Git is the source archive: RUN contains the base Git SHA, relevant binary diff
and new-note patch, with no source snapshots, tars or module/media copies.
