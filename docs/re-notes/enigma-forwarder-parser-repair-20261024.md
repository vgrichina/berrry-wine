# Enigma export-forwarder parser repair

The unpacked diagnostic parser now rejects the independently reproduced empty
`SDL_Init` forwarder semantically, before immutable module seals are consulted.
The resolver treats only `None` as a direct export and validates every supplied
forwarder, including caller-constructed module graphs. A shared validator checks
the bounded ASCII module basename and nonempty symbol, normalizes provider case
and the optional `.dll` suffix, and validates decimal ordinals 1–65535. Forwarder
strings must terminate inside the declared export directory and the existing
4096-byte string bound. The existing final-dot separator convention is retained.
This is a targeted parser/resolver repair; no runtime behavior was tested.

The task starts at immutable review commit
`17cb4edae7d5a20874c7afc560dede1978c92ee4`, whose parser candidate is
`def12ace9c3157ca270495a6b770b5119d776683`. The unchanged independent diagnostic
was executed against exact baseline source SHA256
`9cb012199d5307b63e369f140aea0875aee0b519b136c0033dd3ef735a8a298a` before editing.
It exited zero with **REJECT_PARSER_CORRECTNESS**, reproducing the false
`normal_imports: PASS`. That oracle remains byte-identical, SHA256
`41050c56ffe274f87f38fc3020efbd06eec29f3e7bd77f188495dd0a99691d20`.
It intentionally refuses repaired source; its zero status is never repair acceptance.

The separate `test/enigma-forwarder-repair.test.py` compiles the exact source
bytes it hashes, with Python bytecode disabled. It makes the same four-byte
SDL EAT mutation: offset 299908, RVA `0x1340` to `0x53000`, inside export extent
`[0x53000,0x5443b)`. Mutant SHA256 is
`04448e081b6a27c4cf02989d5c763cd2cc9f1d1f0cb7e0e3934964fa5a6791c0`.
Calling the parser/resolver directly rejects it as a malformed forwarder. A
separate full-verify control still rejects it against immutable output seals.

Eight positive forwarder controls cover names, provider case, `.dll`, ordinals,
leading-zero normalization, upper ordinal boundary and real SDL PE forwarding.
Rejecting controls cover empty/provider/symbol/separator/path/ASCII/length and
ordinal forms, missing providers/names/ordinals, cycles, NUL beyond the directory
extent, and a nonzero final byte. A NUL on the last declared byte is accepted.
The original direct `SDL_Init` export remains `None`. The unchanged producer
suite passes fourteen semantic rejecting controls and two guard/sentinel controls
using owned copies of all ten input/output modules.

Authentic verification still finds **849 normal imports, 40 edges and 192 packaged
bindings**. Six decoded codec calls contain 74 requests: 50 packaged and 24
missing-provider requests. All twenty authentic packed/unpacked module hashes
were checked and unchanged; their complete identities are in the evidence JSON.
The authentic SDL output remains
`66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b`.
The original helper and test remain byte-identical to
`b9450836983365a8f7f90d3f9f8213bf7f629f31`. Fresh read-only original verification
reports 2460 files, ten packed modules and **BLOCKED_PACKED_IMPORTS** (exit 2).
Archive SHA256 remains
`a738a8b1508675bfaf12db07b7bdb42356f013f4c2d5c2a494516d78d25070a1`;
manifest SHA256 remains
`74a65c35b0742c00f0a53f4590fe1c888715e6b59acae8f0349d1d98c1dbb574`.

Reproduce on a fresh owned destination:

```sh
python3 -B test/enigma-forwarder-repair.test.py \
  /tmp/enigma-authentic-static-unpack-oct24 /tmp/enigma-repair-reproduce
python3 -B test/enigma-unpacked-closure.test.py /tmp/enigma-repair-reproduce
```

Raw baseline, repair, producer and original receipts/logs, owned mutation bytes,
resource ledger and recovery identities remain under
`/tmp/enigma-forwarder-parser-repair-oct24/`. Compact results and exact executed
source hashes are committed beside this note. Baseline diagnostic recovery uses
the immutable review checkout and its unchanged test. Git retains recipes and
evidence, not ignored module bytes. The original report exceeded the initial
wrapper's per-log 64 KiB check after execution; its complete output is retained.
The wrapper was corrected to a cumulative 512 KiB raw-log budget, then the
read-only command was repeated to capture its actual exit-2 receipt. Both reports
are charged; this wrapper correction is not a semantic rejection or acceptance.

Receipt provenance limits remain: self-supplied command-log hashes do not prove
arbitrary supplied commands ran. Immutable module hashes do not establish full
dynamic closure. Generic/register-derived loaders (including Enigma `0x5ab960`),
optional codec necessity, system API implementation, initialization, first menu
and gameplay remain unproven. No system stubs, codecs, acquisitions, unpacking,
compiler/build, guest/browser/box access or deployment were used. Mount argv and
box ID/state/expiry are N/A; lifecycle ownership stays with the coordinator.
Root tracked files/index/refs and all donors/standing inputs stayed read-only;
only append-only coordination messages were written at root. No main integration.
