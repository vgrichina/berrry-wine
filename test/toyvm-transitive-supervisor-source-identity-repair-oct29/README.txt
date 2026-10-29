Transitive pinned-supervisor source identity repair (2026-10-29)

Scope
The production adapter supervise_accounted now retains the one read of pinned-supervisor.py, checks its SHA256 and compiles exactly those bytes with dont_inherit=True into a module created by module_from_spec. This preserves module metadata/API while excluding cached bytecode and subsequent source replacement. Only this loader block and the corresponding adapter SHA in qualify_accounted changed. confine.py, fuse_backend.py and pinned-supervisor.py remain byte-identical. Caller load_backend AST and every other caller byte (including RECEIPT_SHA256) remain unchanged.

Reproduction and results
check_boundary.py before ran the exact pinned baseline adapter in owned disposable fixtures. Normal source, sys.modules poison resistance and tamper rejection passed. Timestamp and unchecked-hash pycs both selected stale code with the ordinary loader and executed STALE_EXECUTED top-level code before the first Popen. Replacement immediately after the checked read also executed unpinned code. All three failures are expected baseline reproduction evidence in before.json.
The repaired adapter passes all six cases (after.json). At the first production Popen boundary the sentinel inspects the already-created supervisor module and compares supervise code, function API/metadata, module metadata, spec fields and loader linkage against compilation of the pinned source. It always raises BaseException before any child exists. Tampered source must reject before this sentinel. The same oracle rejects a private hash-guard-removal mutant on tampered input. Retained pycs remain byte-for-byte unchanged; the checked source has exactly one read.
All monkeypatches use scoped contexts and Popen/read_bytes/sys.modules restoration is checked. subprocess convenience APIs and OS child entry points are blocked as additional guards. No fixture executes any child, mount, CLI, browser, Boat, kernel operation or supervisor workload. Accounting/cleanup behavior is preserved by AST identity outside the intended loader block; it is not runtime-qualified here.

Carried caller acceptance
accepted-caller-oracle.py is the exact hash-verified predecessor oracle (SHA256 c35c4e2d15123149605b5dd4c0b0e0f363ebf54c993154c5f5e9f7a27a2ba3c1).
run_carried_caller.py updates only its in-memory expected pins for the two authorized source changes and runs its unchanged suite. Nine cases and its private guard-removal control pass (results.json). It never invokes the adapter. Additional subprocess/OS child guards apply.

Recovery
Use /usr/bin/python3 only. In the owned repository, through the supplied ops.py wrapper:
 /usr/bin/python3 /tmp/toyvm-transitive-supervisor-source-identity-repair-oct29/ops.py repaired-recheck /usr/bin/python3 test/toyvm-transitive-supervisor-source-identity-repair-oct29/check_boundary.py after
 /usr/bin/python3 /tmp/toyvm-transitive-supervisor-source-identity-repair-oct29/ops.py caller-recheck /usr/bin/python3 test/toyvm-transitive-supervisor-source-identity-repair-oct29/run_carried_caller.py
Baseline source fixtures and input-pins.json retain the original identity and AST comparison inputs; before.json retains actual pre-repair behavior. Reproduction should use owned temporary copies, never restore old production bytes into the published repair branch.

Limits and handoff
All operations used the supplied bounded ops.py, per-operation admission, original inherited DATA hard limit, Python soft/hard128MiB, Git-only DATA256MiB, parent physicalRSS128MiB, group512MiB, CPU90, wall120 and existing disk/capture/file/evidence gates. No denial occurred. No boxes assigned, created, stopped or resumed.
Fresh independent transitive-boundary acceptance is REQUIRED after this repair handoff; this worker cannot launch another worker. Coordinator review/integration and mounted/kernel/CLI/browser qualification remain separate gates. No six/RENAME/selector integration, shared main changes or public deployment occurred.
The bounded coordinator-note.txt replaces writing the oversized shared messageboard under explicit task instruction. Commit, branch and exact ls-remote verification will be recorded there and in the task completion receipt after publication.
