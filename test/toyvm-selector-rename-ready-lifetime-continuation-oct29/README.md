# Exact selector + RENAME-parent lifetime continuation

The candidate is exactly 12821 bytes, SHA256 e78b4f06715db96c3403aa821dc2008e7986fa9e9ec9fbacbc3744a8bb7eebc8. Only production serve was replaced from the accepted selector source. handle, callers, confine and supervisors are unchanged. No SIX guard was merged.

The immutable prior receipt and carried-forward directory retain 44 passing RENAME wire cases, two rejected parent mutants, supported SETATTR, malformed request, bind/register acquisition cleanup and EOF serial0. Those groups were not replayed. The original serial1 ECONNREFUSED failure and its diagnostic are preserved; historical missing resource samples remain unavailable.

The copied fixture replaces lifecycle path-existence polling with an observer of real successful selector registration. All operations forward to the actual selector; close and exception behavior are unchanged. After the real transport register returns, it verifies the real control socket is registered and SO_ACCEPTCONN is 1, then signals readiness. A deterministic local sentinel holds listen behind one event and registration behind another, proving no readiness in either earlier phase.

The fixture was pinned before production execution. Serials1..11 pass: six real BrokenPipeError/EPIPE cases and five EOF cases, all threads joined, owned transport/control/selector descriptors closed, baseline borrowed descriptors 0/1/2 unchanged and no FD drift. Cyclic GC stays disabled; all six exceptions and their tracebacks remain retained through completion. Local /proc fd and fdinfo evidence is recorded per case. The original fixture explicitly removes each status path after serve; this is not a production unlink claim.

The private no-selector-close mutant runs separately under the same supervisor and corrected pinned fixture. Its expected exit1 hits the unchanged exact FD identity oracle: only the owned eventpoll descriptor survives; control/transport close, borrowed baseline survives, thread joins, status is removed and real EPIPE is retained.

Commands use /usr/bin/python3 via the assigned ops.py supervisor: sentinel.py, lifetime.py, then lifetime.py --no-close. The latter must exit1 and match mutant-rejection.json. No nested subprocess, mount, provider, Boat, Node, browser, CLI or kernel FUSE execution. Fresh independent combined acceptance is required before integration.
