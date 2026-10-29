# Confined Python fixture-open diagnosis, 2026-10-29

Source-only result: a specific, mechanically demonstrated startup incompatibility
explains the retained EPERM. The historical failing syscall and its policy layer
remain unobserved. No production repair or mounted acceptance is claimed.

## Observed boundary

The unchanged candidate is `dcbe956bb403509f531b059c6822a1dcacd9fa59`;
the counterexample was published as `ef828662aaf016f6e4facc6be727e15f4aa416ba`.
The canonical predecessor receipt SHA256 is
`77b57b35292aaf22c0da5aeb2f44abaad45cba63b0e159efcc683f31e214eada`.
All five source hashes and the original cancellation receipt are independently
checked by `diagnose.py`. They have not been edited. The fixture is retained as
text, SHA256 `3c0ac10c80895e992ffe25afed67da2c60f16db97ea946633bef8c7386fb601a`.

The actual failed child argv, after the real production CLI's `--`, was:

```text
/usr/bin/python3 -B /tmp/tvcm/fixture.py /tmp/tvcm/work/domain/f 1024
```

The adapter prepended `/usr/bin/python3 -B` and its absolute `confine.py` path,
then `/tmp/tvcm/work/domain`, to this argv. The supervisor inherited its environment
plus `PALETTE_BROWSER_SUPERVISED`, without changing cwd; the recipe's CLI cwd was
`/tmp/tvcm/repo`. `restrict()` installs Landlock and seccomp before `os.execvp`.
Landlock handles write/mutation rights, not READ_FILE (bit 2) or EXECUTE (bit 0).
It does not establish a blanket read ban outside the mounted domain.

Python printed `can't open file '/tmp/tvcm/fixture.py': [Errno 1] Operation not
permitted`, exited 2, and the production CLI rejected it. The real FUSE mount
was observed, but its ledger retained only the root inode, written=0,
failure=null and operations=1. This establishes startup rejection before fixture
payload execution; it does not establish an accounting bug or a quota rejection.
The original receipt records cleanup and snapshot-stop of `bx_pfvpxxu2`.

## Static mechanism in the exact Python executable

The local `/usr/bin/python3` SHA256 is
`1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118`,
matching both the dispatch pin and predecessor remote Python pin. The retained
objdump excerpts establish the following specific call chain in those bytes:

1. `Py_RunMain` at `0x6bcbb1` calls `_Py_fopen_obj` at `0x6bbe40` for
   filename execution.
2. After successful `fopen64` and `fileno`, `_Py_fopen_obj` calls the shared
   descriptor-inheritance helper at `0x61b6d0`, with inheritable=0, raising=1,
   atomic-flag pointer=NULL (`0x6bbf2b` through `0x6bbf36`).
3. That helper can issue `ioctl(fd, 0x5451 /* FIOCLEX */, 0)` at `0x61b72d`.
   The ioctl capability cache initially contains -1 at `0xa4dad4`. The raising
   path uses ioctl while that cache is nonzero.
4. On ioctl failure, EBADF, ENOTTY (25), and EACCES (13) receive special handling.
   EPERM (1) does not: it returns an error. The retained cold branch at
   `0x4bf5ff` shows the 25/13 comparisons, distinct from EPERM.
5. The unchanged x86-64 seccomp filter excludes syscall 16 (`ioctl`), and its
   default return is `SECCOMP_RET_ERRNO | 1`. `open` (2), `openat` (257),
   `fcntl` (72), and `newfstatat` (262) are allowed. The complete numeric
   allowlist, exact child argv and proposed argv are in `analysis.json`.

Thus successful underlying file open can still lead to the same high-level
"can't open file" EPERM during descriptor setup. This is substantially more
specific than an allowlist omission alone. It remains static reasoning: no
retained record gives the actual script fd, successful open return, FIOCLEX
return, runtime cache value or winning policy layer. An outer enforced filter
could independently return the same errno. Do not classify the original event
as an enforced platform restriction or as a proven own-filter event solely from
this receipt. The unrelated `_Py_wfopen` path passes raising=0 and skips this
ioctl branch; it must not be substituted for the filename CLI's actual path.

## Narrow comparison with an earlier actual CLI test

The retained canonical task `/tmp/toyvm-real-cli-file-limit-oct29` published
`f70389b42845ee1c3c548677dd3340b8e4955d82`. Its retained runtime receipt, pins
and `remote_test.py` recipe were read outside its Git working tree and copied
here. Its exact confine hash matches this task. It used the production CLI with
`/usr/bin/python3 -B -c PAYLOAD`, reached a real mounted file create/write, and
passed the intended per-file-rejection check. Its CLI exit 1 was expected;
`accepted=false` is not positive qualification. Its caller, adapter and FUSE
hashes differ, so it is a startup-mode comparison, not an unchanged-candidate
acceptance result. The pinned backend's earlier `test_backend.py` also uses
`-B -c` for its reported passing fixture checks. No historical suites ran here.

## Minimal proposal and discriminating next observation

Change only the test invocation's child transport to:

```text
/usr/bin/python3 -B -c ORIGINAL_FIXTURE_TEXT /tmp/tvcm/work/domain/f 1024
```

The exact generated production CLI argv is in `analysis.json`. The original
fixture text is byte-for-byte preserved, syntax-checked without execution, and
its `sys.argv[1]` and `[2]` inputs are preserved. It does not read argv[0]. This
proposal retains the actual CLI, immutable cancellation receipt, unchanged
five source files, real confinement and mounted backend. It adds no syscalls
or privileges. Only pure-source transport equivalence is tested; runtime
success and accounting correctness are unknown. No fix is applied to production.

The next separately authorized, owned runtime task needs one discriminating
observation of the original filename command, not another uninstrumented
qualification. With tracing explicitly authorized and supported by that host,
capture the confined child's successful script `open/openat/openat2` return
and subsequent `ioctl(fd,FIOCLEX)` / `fcntl` return, plus its exact binary and
five source hashes. Use an external bounded observer, retain process ownership,
the original output/CPU/RSS/disk/wall gates and cleanup, and trace only the
necessary file/descriptor operations. No filter modification, ptrace-policy
workaround or denial retry is authorized. A denied tracing prerequisite is a
stop/blocker. A script open that already returns EPERM disproves the proposed
post-open mechanism; a successful open followed by FIOCLEX EPERM establishes
that mechanism. Policy-layer attribution still needs supported host policy
provenance; do not disable an outer filter to compare. If authorized to validate
the fixture proposal afterward, use the same mounted production CLI and exact
fixture text with `-c`, then require marker, payload accounting and cleanup.

## Validation, preservation and limits

`python3 -B test/toyvm-confined-python-fixture-open-diagnosis-oct29/test_diagnosis.py`
checks pinned inputs, exact BPF-template interpretation, foreign-architecture
and x32 kill controls, a hypothetical ioctl-allow mutation negative control,
wrong-fixture rejection, retained binary branches, and the prior real CLI
comparison. It never imports a production launcher or executes the fixture.
An initial test used a hex spelling against `ast.unparse`, which normalizes
integer spelling; that assertion failed. It was corrected to compare ASTs;
the original failure is preserved. This was a local analysis test error, not
an admission denial or a confined workload execution.

No FUSE mount, workload under confinement, Boat lifecycle operation, Node,
browser, guest, public deployment, agent or worker was launched. No box was
assigned; no runtime lifecycle ownership changed. The supplied task supervisor
and cwd guarded all task operations after the initial read-only policy/supervisor
bootstrap. All prescribed limits and admission gates remain unchanged. No
checkout occurred; the coordinator's owned exact-object checkout was reused.
There is no conditional mount execution here, so no new filename-bearing mount
argv was executed or claimed validated. Evidence is separately preserved under
the owned task root; completion and publication receipts name its exact scope.

Published disassembly excerpts remove trailing whitespace only; raw objdump output
remains separately in the owned task root e/ operation captures.
