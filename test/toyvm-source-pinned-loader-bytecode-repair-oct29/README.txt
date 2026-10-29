Source-pinned production load_backend repair, 2026-10-29

Only qualify_accounted.py:load_backend changes production behavior. All four dependency bytes and pins are retained, including accepted SIX fuse_backend.py cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105. AST outside load_backend is unchanged.

The independent fixture puts different, equal-length source code in a timestamp-valid pyc while the pinned source remains on disk. It also supplies unchecked-hash pyc flags=1. before.json confirms both return unpinned code through the original production loader. Caches remain in place after each check. PYTHONDONTWRITEBYTECODE=1 does not prevent reading these caches. A deterministic replacement immediately after the source read reproduces the second-read gap.

The repair retains hash-checked bytes, creates the same fresh module/spec, compiles those bytes directly with dont_inherit=True and the actual source filename, then executes in that module namespace. It neither uses sys.modules entries nor asks SourceFileLoader to read source or bytecode.

after.json passes the same nine checks: correct source; timestamp cache; unchecked-hash cache; sys.modules poisoning; source replacement after verification; and separate fail-closed tamper checks for all four dependencies before import. Identity compares returned function code (including nested code/constants), source filename, module identity, HERE, spec and loader metadata. The adapter function is never invoked.

guard-removal-mutant.json is an EXPECTED failing run, exit 1. The mutant exists only in fixture copies; it removes the source hash guard. The unchanged identity suite rejects it for each of four tampered dependencies. Production remains the passing repair.

Reproduce with exact /usr/bin/python3, through the task ops.py supervisor, check_loader.py --repo REPO --fixtures FRESH_DIRECTORY --output REPORT. Before repair add --expect-vulnerable. To challenge the repaired caller add --remove-guard and require exit 1 with all four guard cases false. Every fixture directory must be new. No cache deletion is part of a test.

Scope: source loader code identity only. No adapter invocation, child, mount, kernel, CLI, browser, Node or Boat execution. Fresh independent repaired-caller acceptance remains required. No RENAME/selector integration, merge or public deployment.
