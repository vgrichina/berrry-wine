# Original Half-Life 2 demo: normal storage and startup

Evidence: `scratch/runs/20261117-halflife2-normal-virtual-storage-installer-startup/result.json`.
Published implementation: ed5e9bd5707875354357c13e9aa2fdf0120768ff and
 efc9261258c0c6b3c0c476c25cd73b962e9d842f.

The genuine original installer reached its ordinary **Welcome to Steam!** window,
including Valve/Steam artwork and Next/Cancel buttons. The personally reviewed,
complete 640×480 image is `pinned/native/original-startup.png`, SHA-256
`5aa25ee09d05e69ba2debd865fc62ea16e15d1e093be7837b4c3633a42c5b360`.
This is actual installer startup, beyond the predecessor's DLL-only proof.
Installation and gameplay were not completed. Original installer invocations: 1;
installed game invocations: 0. No installed physical footprint was measured.

The first finite Next intent returned UNKNOWN within 86 ms: its handler produced
no native input edge eligible for acknowledgement. My reviewed target was the
Welcome frame `0x1000f`, rather than the actual Next BUTTON `0x10011`.
`captureNativeButton` requires a live native BUTTON target to retain and verify
its dispatch-return receipt. This operator targeting mistake does not prove a
runtime input defect. The complete reviewed image was 12.199 seconds old at DOWN,
within the 30-second menu limit. The independently prearmed physical release
acknowledged UP after 1420.297 ms. The endpoint then permanently closed; no later
HTTP/query/rebind/replay/retry occurred. Its four requests were capture, bind,
input, and that original prearmed release. A future separately authorized attempt
must review the actual native control identity. The used invocation stays closed.

The normal entry point used the unchanged 787701212-byte EXE at
`scratch/media/half-life-2-demo-original.exe`, SHA-256
`24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.
There was no script modification, installer bypass, direct guest invocation,
Steam/authentication substitute, browser port or installed-game launch.

The predecessor's 3995000 script units declare a requirement; they are not a
physical footprint. A bounded-buffer, read-only scan CRC-verified all 26 raw
DEFLATE streams through exact package EOF. Total decoded payload is 3531518277
bytes. Six streams with common 1/1/6 headers, IDs 221/219/200/206/207/208, have a
file-length field equal to decoded size. Together they contain 3529662856 decoded
bytes in 786980466 compressed bytes. No decoded content was written to the host
and no installed tree was constructed by inspection. Details are retained in
`stream-scan.json` and `content-streams.json`.

Normal writable VirtualFS files use resident JavaScript Uint8Arrays, provider or
sparse-provider paths, and optional asynchronous overlay persistence. Host `/home`
free space is not that resident volume's capacity. The actual public API probe
wrote/read 4096 bytes while GetDiskFreeSpaceEx remained 1073737728 bytes free and
2147479552 total, derived from legacy geometry. There is no enforced volume quota
behind those values. No arbitrary larger constant or host statfs substitution was
introduced; legacy 32-bit and mounted CD geometry remain unchanged. This work
makes no honest-volume-capacity repair claim and no declared-space blocker claim.

The same public probe reproduced a real storage fault: a representable seek to
Number.MAX_SAFE_INTEGER followed by SetEndOfFile threw host RangeError.
`lib/filesystem.js` now returns ERROR_NOT_ENOUGH_MEMORY (8) for failed resident
backing allocations. Write extent arithmetic outside exact numeric range returns
ERROR_INVALID_PARAMETER (87). Refused writes preserve cursor and bytes; refused
resizes preserve size and contents. The focused test covers real writes/reads,
truncation, zero-filled extension, allocation and arithmetic refusal, and compiled
WAT SetEndOfFile BOOL/GetLastError/stack behavior. VFS and overlay regressions and
`flock /tmp/wine-build.lock bash tools/build.sh` passed. The original installer
was not observed encountering this allocation fault.

The startup adapter qualified complete published source/module/helper identities,
main/CPU Worker/OS child inheritance, genuine Wise DLL load/free on a joined
worker, native ownership/modal/dialog/control/refusal/pointer cases and actual
ParentProcessSupervisor lifecycle. WiseMain was not invoked in qualification.
The final published fixture used efc9261258c0c6b3c0c476c25cd73b962e9d842f and module
SHA-256 `5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`.
Fresh sealed original preparation matched the entire source map/pool and module
bytes to that completed fixture before its runtime clock. Positive graph reuse
and four mismatched Git/source/module/map refusals passed. Foreign shared WIP was
excluded and retained as patches, never adopted into the runtime or commits.

The original had fixed 600-second native / 620-second independent limits armed
before launch. Native PID 625732 was actually waited with exit 0 after host
cleanup on UNKNOWN; this is not a native Quit or successful installer exit claim.
Outer child PID 625020 and both watchdogs actually joined with both EOFs, exit 0
and an empty remaining owned scope. The compactor thread joined without errors
and descriptors closed. Closed writer traces have individually verified gzip
round-trip recovery; byte-identical immutable receipts share storage. Selected
result image only is retained; authored fixture frame series were pruned with
hashes and reproduction references. Git plus relevant binary diffs is the source
archive; no source tree or repeated media bundle was made. Unique generated
original state and recovery instructions remain in the run directory.

No RAM gate, boxes, extra agents, Codex workers or public deployments were used.
Box ID/expiry are null, state NOT_CREATED, stop receipt N/A. `/home` remained above
1.5 GB during this final original run. Further installation requires a fresh
explicit invocation allowance and correct native BUTTON targeting; genuine Steam
or authentication requirements, if reached, remain real boundaries.
