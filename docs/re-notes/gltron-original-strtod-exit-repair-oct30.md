# GLTron 0.70 original startup exit: strtod end pointer

Parent: `791b73b9276ae2a951cdc922128830f24589350e`.
Task/evidence root: `/tmp/gltron-original-early-exit-causal-repair-oct30`.

The retained original run exited 1 after configuration parsing, without an
unimplemented API trap. Its teal frame did not qualify gameplay. Production
`fputs` writes to guest FILE streams, explaining the missing error text in the
API-name trace. The original opens `stdout.txt` and `stderr.txt` itself.

One diagnostic execution used the exact canonical parent module SHA-256
`be5624893623ba76c4bb1b02d3f48678555323223a2cba2cd14ceb8a2b28d142`.
A source-pinned diagnostic copy of the production runner observed actual
`fputs` text, strtod inputs/post-call endptr, and exit caller without writing
guest memory or changing guest results. `early-observations.jsonl` records
`strtod("1")` and `strtod("0.05")` leaving endptr equal to nptr. Lua reports
`malformed number` in original basics.lua line 3, joystick.lua line 2,
config.lua line 8 and artpack.lua line 2, followed by `attempt to index a nil
value`, `unable to recover; exiting`, and exit(1), caller 0x418cbc.

Static original-EXE disassembly at 0x418e8f corroborates the cause: after calling
strtod (return 0x418ea2), the parser rejects endptr == nptr at 0x418eaa and
requires the remaining suffix to contain only whitespace before NUL. The
production handler unconditionally stored nptr into endptr. All four scripts
contain valid decimal tokens at the reported lines; no original media changed.

The repair shares the existing decimal scanner between atof and strtod, writes
the consumed guest pointer for strtod, rolls back an incomplete exponent, and
preserves nptr on no conversion. Hexadecimal, NaN/infinity and range/errno
support remain outside this bounded decimal repair.

`test/test-crt-strtod-endptr.js` executes production parser/handler bodies and
checks original numeric tokens, numeric values, guest-pointer translation,
partial exponents, no conversion, NULL endptr, atof, cdecl ESP, and unrelated
memory. The exact unchanged parent source rejects on `1: consumed end pointer`;
the repaired source passes. Canonical tools/build-compile-wat.js from
src/main.watx passes; existing remove/ABI/generator checks were reused unchanged.

One retest used the unchanged production test/run.js and registered original
92-file media route with the repaired canonical module SHA-256
`b12b0499d2429b4f99b54f497970bdc37292ad5b10a3721809655e7afd3312b7`.
At 2026-10-30T16:10:35.075680Z it reached an unimplemented null/ordinal API trap
at EIP 0x423592, return address 0x42282f. Harness exit 1 is a trap, not a new
observed guest Exit1. No retest PNG was produced. No further API investigation
or repair was attempted; gameplay remains unqualified.

The diagnostic PNG was inspected: uniform teal 640x480. Distinct bounded logs,
observer pins, build identity, lifecycle proof and recovery archive are listed
in completion-receipt.json. Raw remote logs and build remain in the stopped
task-owned snapshot. Box bx_hy375wz2 was snapshot-stopped under explicit task
delegation; donor bx_xbfrxzgd was immutable. Publication remains pending the
unchanged trusted SSH public-key denial; the local commit is not a remote backup.
