Source integration rejected at 7f64decb2bbbfc71cd925e79200dedbeaad6326e.

The production caller verifies all four source hashes, then SourceFileLoader accepts a timestamp-valid private adapter bytecode cache whose code differs from the accepted source. All five fixture sources remain accepted; the returned function reports the real source origin. PYTHONDONTWRITEBYTECODE disables writes, not cache reads. No adapter was invoked.

The fresh independent checks passed the real adapter identity case, twelve file rejection cases, old pin rejection, and module-cache/recheck case. The guard-removal mutant was killed. The first decisive defect is the final stale-bytecode case; acceptance stopped there.

check_loader.py reproduces the rejection with absolute --repo, --receipt, --fixtures (new directory), and --output paths. Run through the assigned pinned ops.py using /usr/bin/python3. Expected exit is 1. results.json records actual observations; report.json records scope and pins. migration.diff changes exactly the fuse backend hash; all other production bytes and guards match accepted receipts. No production edits are included.

Actual CLI, confinement, kernel/mount, and browser acceptance remain open. This diagnostic publication makes no claim about the concurrent SIX+RENAME or selector tasks.
