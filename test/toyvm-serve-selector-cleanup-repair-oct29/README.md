# Selector lifetime repair

`Backend.serve` left its owned epoll selector open at EOF. The pinned original
SETATTR case confirmed exactly one surviving `anon_inode:[eventpoll]`, matching
the live selector descriptor, while transport/control closed and thread joined.
The repair closes the selector explicitly and guards partial acquisition, with
nested finalizers preserving closure of the control socket and transport.
Only the serve resource-lifetime block changes in production.

`acceptance.json` binds all five dispatch source pins, the changed backend,
the retained diagnostic, fixed checks, and mutation evidence. Raw descriptor
identities/fdinfo and protocol/state snapshots remain in its private evidenceRoot.
The baseline instrumented harness is separately retained and hashed there.

The five original wire cases ran once on the fixed backend: unsupported SETATTR
(valid 2056, size 4097), supported resize, malformed declared length, removed
guard, late guard. Real bind EADDRINUSE and epoll-registration EPERM check partial
acquisition. Removing the selector close fails the exact descriptor oracle.
Fixed checks disable automatic GC, never collect, and retain exception tracebacks.
Mutants are private text copies; neither handle nor serve is monkeypatched.

Recovery: set TOYVM_EVIDENCE to a new absolute existing private directory and run
`python3 -B test/toyvm-serve-selector-cleanup-repair-oct29/wire.py --fixed`
under the task resource supervisor. `--baseline` requires the original pinned
backend. These are local SOCK_SEQPACKET wire tests, with no FUSE mount.

Fresh independent acceptance and application to the accepted combined candidate
remain required. No caller/main/public deployment or gameplay qualification.
