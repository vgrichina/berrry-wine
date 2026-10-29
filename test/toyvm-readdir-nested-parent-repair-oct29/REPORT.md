# READDIR actual parent repair

Candidate: 82a1023a6d84b229389b53c2a9a7a46a112b7797. Only production change: READDIR resolves the unique containing directory from the current namespace; root returns itself. Missing or ambiguous parent state raises EIO rather than fabricating an inode. Offsets, buffer packing, ordinary entries and rename type guards retain their original code.

Acceptance: 870/870 predecessor cases PASS, with all three original oracle mutation controls PASS (bad claims rejected). Independent table-based adversarial coverage adds 2,820 direct callback cases across depth five, root/child, moved subtrees and descendants, repeated moves, offsets and truncated buffers. Production root-constant, wrong-parent and wrong-dot mutations are rejected. Missing/ambiguous parent controls return EIO.

Run: `python3 test/toyvm-readdir-nested-parent-repair-oct29/accept.py` from the repository root. The task ran this via its supplied absolute ops.py supervisor with fresh resource admission and unchanged controls. No runtime, Boat, mount, kernel, browser or gameplay acceptance occurred.

contract.py and fixture.json are byte-exact predecessor copies. original-source-pins.json is the byte-exact predecessor pin file. copy-receipt.json records their original identities. source-pins.json updates only the production backend identity, with explicit before/after in pin-update.json. The dispatch is the sole authority for all five current source pins; the contract's historical CANDIDATE string is provenance only.

The predecessor contract's tail intentionally asserts the known bug. accept.py executes its unchanged AST case-generation/inspection/rename statements before that diagnostic tail, requires all 870 observations to pass, and separately executes every original oracle-mutation assertion unchanged against its original known-bad observation. The predecessor behavior, expected oracle and fixture remain byte-exact; no baseline suite was replayed.

Evidence contains the passing acceptance output and supervisor admission receipt, literal startup receipt, exact repository identity and initial root-ref receipt. Supplied checkpoint was reused successfully before edits. Node and mount checkpoints are inapplicable: this task executes Python direct callbacks only.

The born repository uses index skip-worktree flags, so unstaged git diff/status do not describe the production edit. The production file's skip-worktree bit was cleared explicitly for that owned file (no sparse expansion); publication stages exact owned paths with git add --sparse and reviews the cached diff. Git status emitted nonfatal alternate-store nesting diagnostics (exit 0); no access denial occurred.

Remaining gates: combine independently reviewed repairs, update the caller's OLD backend pin in a separately assigned task, and qualify the full CLI. No UNLINK/cycle repair, caller change, integration, main or public deployment is included. No test boxes assigned; coordinator retains lifecycle ownership.
