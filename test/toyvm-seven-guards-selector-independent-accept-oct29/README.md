Independent acceptance of combined backend 203828dd05034e228cc92dd3fbc90b310116edc6

PASS for exact source and local handle/serve wire scope only. All five production files remain byte-identical and skip-worktree. See acceptance-report.json, preflight.json and results.json.

The own oracle first exercises the unmodified production serve with a real selected UNIX listener and INIT reply, then EOF and EPIPE, with GC disabled and traceback/selector/socket references retained. It checks all three owned descriptor identities are closed before any fixture cleanup and both borrowed identities survive. The same oracle rejects private no-close mutants.

An INIT-first 52-operation interleaving checks ten rejected operations preserve every backend instance field except the operations count, writes/reads successfully after each rejection, and completes namespace movement and orphan collection. Eight independent guard removals are detected by the unchanged oracle. No carried broad133 or prior44 tests were executed.

Reproduction: through the task ops.py supervisor, run /usr/bin/python3 preflight.py then /usr/bin/python3 oracle.py from the owned repo. Source is loaded directly from the pinned production file; private mutant strings are never written to production. preflight.py depends on immutable coordinator input copies. No mounted/kernel/runtime acceptance is claimed.
