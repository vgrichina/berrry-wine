# Dialog callback ownership source reconciliation

Fetched `origin/main` at `7b15136870328d66a8517b9673efad3fd0941294`
already contains `a5a0267d646dca021d3128d8a9212da6360945b7`.
That change implements the requested acquisition-before-write and retained
child/root/depth validation in `wnd_send_message_inner`. No additional
production fix is warranted. This branch leaves the WAT byte-identical.
The shared checkout at `6aaf65235f367beb610931be83b4b1268ef35ad7`
has the older ordering; its dialog file matches its HEAD. It was not modified.

`node test/test-dialog-callback-ownership.js` parses the actual WAT and
evaluates the synchronous x86 branch from register saving through restoration.
The routing prefix and subsequent native edit fallback are excluded. The
evaluator models invocation primitives, guest memory, run slices and host
service boundaries; it does not compile or execute the VM.

The 44 cases cover capacity and rejected acquisition before guest writes,
last available child, arguments, fresh siblings, nested completion and nested
timeout, normal slices, 64-round timeout, 4096-round sleep timeout, serviced
and failed DLL loads, nested service callbacks, host/run traps, and malformed
completed stdcall ESP. Return/timeout/sleep/load exits reject live extra
children, same-depth replacements, high token-bit changes, root changes and
depth changes without leaving or restoring interrupted state.
Five AST mutations remove each retained guard, move acquisition late, or
remove the completed ESP guard; each must fail a behavioral assertion.
The historical pre-fix source fails capacity-before-write. Fetched main passes.

The existing core owns epoch/thread validation, token allocation and spill
pins; these are not reimplemented or proven by this model. RichEdit
`3c01665c` and ICM `066436de` use the same retained-local contract; their source
harness informed this evaluator. No CRT jump gate, census, ledger or core
invocation code changed. The dedicated test is directly invoked; no shared
test-tier registry was edited.

Evidence: `scratch/runs/20261020-dialog-callback-ownership/`, containing
source/parser snapshots, historical baseline, replay recipe, logs and hashes.
This task ran no full build, fullVM, browser, guest or runtime operation.
Historical runtime claims in `re-notes/sync-window-invocation-ownership.md`
were not repeated and are not fresh qualification for current main.
