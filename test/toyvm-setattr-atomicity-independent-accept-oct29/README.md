# Independent SETATTR atomicity acceptance

Accepted candidate `608d71e723b1fd61bb3346dd167da4e569e1f9aa` for direct
production `Backend.handle(4, inode, payload)` callbacks only. The five current
source identities are exclusively the dispatch pins in `source-pins.json`.
All production sources remained byte fixed. No mounted filesystem, kernel,
full CLI, confinement, browser, or gameplay qualification is claimed.

The predecessor suite and `baseline.json` were copied byte for byte from the
assigned read-only predecessor directory; `copied-inputs.json` records their
hashes. The historical backend pin in that baseline is provenance only.
The first behavioral operation was the copied suite in **accept** mode: it
replayed the unchanged binary reproducer before its 151 invalid cases,
24 valid/quota controls, five regressions, and two rejecting mutations.
All passed. Do not run historical baseline mode against repaired source.

`independent.py` constructs poisoned binary SETATTR payloads without importing
the predecessor suite. Its full-state oracle compares all instance fields
except `operations`; every call must increment that counter exactly once.
This includes inode data/metadata/names, live/peak/written accounting, next
inode, handles, configured limits, mount-root value, and sticky failure.

The 2,400 independent cases passed:

| Group | Cases |
| --- | ---: |
| Each unsupported bit alone/with size/all supported bits; shrink/same/grow/max uint64 | 252 |
| Unsupported flags with short/extended payloads and missing nodes | 36 |
| Truncated valid field | 4 |
| Truncated supported size field | 4 |
| Supported flags on missing nodes | 3 |
| Unsupported flags before conflicting quotas/sticky errors | 6 |
| Every supported valid mask from 0 through 2047 | 2048 |
| Supported quota precedence with repeated and preexisting sticky errors | 12 |
| Dense-block and payload-length boundaries | 35 |

Unsupported flags return EOPNOTSUPP before size decoding, node access, resize,
or quota mutation once their four-byte valid field can be decoded. Supported
size requests preserve all state except the deliberate sticky failure on quota
rejection: cumulative-write takes precedence over per-file, then allocation.
Supported missing-node requests currently propagate raw KeyError; truncated
fields propagate struct.error. These observations characterize this Python
callback and make no claim about wire-level error translation.

Independent removed-guard and late-guard source copies both corrupt data,
live bytes, and written bytes for the retained poisoned request. The detector
rejects both for state corruption; the late guard still returns EOPNOTSUPP.
The mutant files are test artifacts, never production replacements. Their
identities and exact request bytes appear in `independent-results.json`.

Reproduce from this repository root, within the assigned resource supervisor:

```sh
python3 -B test/toyvm-setattr-atomicity-independent-accept-oct29/verify.py accept
python3 -B test/toyvm-setattr-atomicity-independent-accept-oct29/independent.py
```

Each group ran once; successful groups were not repeated. The retained
`evidence/` receipts record inherited limits, fresh per-operation aggregate
admission, explicit owned cwd, and the unchanged passing startup checkpoint.
No Node, mount, runtime, Boat, checkout, or production write was required;
therefore no Node startup or filename-bearing mount invocation occurred.
Git uses the coordinator's exact trusted SSH configuration. The initial
root-ref digest was reused; no root ref listing or root/donor write occurred.
Git status succeeded but warned about preexisting deeply nested alternates;
no alternate-store configuration was changed.

Remaining gate: the caller still pins the old backend. Combined repairs,
caller-pin update, and full CLI qualification remain separate coordinator work.
The four-repair candidate and CREATE/MKDIR parent repair were not integrated,
edited, or replayed. No main update or public deployment is authorized here.
