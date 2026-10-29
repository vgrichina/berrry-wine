# Independent rename type acceptance

Accepted exact candidate `ee783655f7d8dc7829093943fe73e0091fb440fe` for the
direct `Backend.handle` rename type contract. The backend is 11245 bytes,
SHA256 `b27ebfe98312038bf7d8ec13a48c69a3a66a5e8b90af3d62798b296b852e6465`.
All five dispatch source pins matched, and the production paths were unchanged
relative to the candidate. No production code was modified.

The first behavioral execution used the retained, unchanged minimal reproducer
against this actual backend. Both mismatches returned the required errno (21
for file replacing directory, 20 for directory replacing file), preserved both
names/inodes, and retained 12288 live bytes. Its output was independently gated
for errno, complete state except operations, names and destination survival.
`reproduce.py` is an exact copy; `original-reproducer.json` retains the output.

`accept.py` independently constructs requests and fixtures using the production
handler. It does not import the predecessor tests or validator. Its 156 cases
include 64 mismatch combinations across op12/zero-flag op45, same/cross-parent,
empty/nonempty destinations, closed/two-open-handle victims, and closed/open
sources. Regular files carry dense payloads; directories can contain children.
Rejection checks compare every backend attribute except operations, plus node,
payload and namespace object identities. Names, nodes, data, links, opens,
handles, next inode, live, peak, written and failure are therefore preserved.

The remaining cases cover 32 same-type replacements with exact expected state
and deferred collection until final release, eight same-path no-ops (including
nonempty directories), eight absent-destination renames, and 44 precedence
cases for missing source, nonempty same-type directories and unsupported flags.
All pass. Nine in-memory source controls are rejected: missing guard, wrong
errno, guard after emptiness/link decrement/collection, two overbroad guards,
and guards restricted to either rename opcode. The link-decrement control
returns the right errno but is rejected for state mutation. Production source
is never rewritten for these controls. See `acceptance.json` for results.

Reproduce using Python 3 with bytecode disabled:

    python3 -B test/toyvm-rename-type-independent-accept-oct29/accept.py

This is direct-handler acceptance only. The kernel may reject a rename before
the callback. No FUSE mount, Boat, Node, guest, browser or gameplay ran; no box
lifecycle handback is needed. Original passing runtime evidence was only
hash-checked, never replayed or modified. Ancestor/descendant cycle regressions
belong to another worker and were not tested or repaired here.

**Remaining integration gate:** `qualify_accounted.py` still pins old backend
SHA256 `e281eb058cee5e65797566c738d0330d2449ec6fe84572d572cfbf181c32ec41`.
This acceptance does not qualify the full CLI. A separately reviewed pin
update and integration qualification are required. No main integration or
public deployment was performed.

The supplied owned-repo supervisor enforced fresh disk/memory admission, 24 MiB
aggregate allocation, unchanged parent hard DATA, Python DATA128/Git DATA256,
CPU90, wall120, file12 MiB, parent RSS128/group RSS512, capture2 MiB and
evidence1 MiB controls. The parent DATA soft limit was not applied as a hard
limit to the Git parent. No mount argv or Node startup receipt is applicable
because neither operation was scheduled. The trusted SSH command is retained
for publication. Git's production-integrity comparison returned zero and no
diff, while emitting nested-alternate warnings; the complete bounded stderr
is retained in the supervisor evidence, without changing donor stores.
