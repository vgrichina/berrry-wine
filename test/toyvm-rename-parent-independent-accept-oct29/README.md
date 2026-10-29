# Independent RENAME-parent acceptance

PASS for candidate 33528beec24aee12093633c30c260c30ff383969 and the exact five pins in source-pins.json. Backend: 12580 bytes, SHA256 3ff02988e444348fc12ccf9b4e6f16db1918b532a10152538afbafa96b2108bb. Production source is read-only.

The historical reproduce.py and results.json remain unchanged. Their exit 1 was an oracle false negative: Python's NotADirectoryError is an OSError subclass. The corrected-oracle.py first repeats the original invalid-parent setup/wire, accepting isinstance(exc, OSError), ENOTDIR, and full state preservation. It does not rerun the already passing original valid control.

Fresh checks: 55 cases cover both opcodes, both parent positions, missing/regular parents, source file/directory, root/cross-directory, simultaneous invalid parents, valid moves and unsupported-flags precedence. Four private in-memory guard-removal mutants are caught. independent-regressions.py adds 14 checks for overwrite of open files, replacement types, nonempty directories, cycles, no-op and sticky failure state. Every rejection snapshots all instance variables except operations, including names, nodes, payload, modes, links, handles and accounting. No production edit or mutant file is used.

Pinned predecessor evidence is retained and verified by hash, including its completion receipt and repaired results. These are reused without replay. New authoritative results are corrected-results.json and regression-results.json. Older diagnostic summaries describe the false-negative historical run only.

Run from this checkout with /usr/bin/python3 through the task-owned pinned supervisor; run each group once. No mount, kernel, browser, Boat or gameplay execution is claimed. This accepts the exact repaired four-namespace backend plus RENAME parent checks only. Six-guard combined application, serve-branch application, caller integration and mounted/runtime qualification remain separate gates.
