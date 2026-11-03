# Jedi demo authentic script asset recovery — 2026-11-03

The missing authentic script bodies are recovered. `kyle.cog` passes damage
through; `item_shields.cog` implements shield-bin60 absorption. This closes the
asset absence in [the accepted shield/script analysis](jedi-shield-script-20261103.md),
commit `dec894a67309d7fd279782d04f8dc0ff6b9c1c1b`. It does **not** establish
the live `victim+0x29c` binding, execution of either handler, complete shield
writer coverage, or damage attribution. `readyForCampaign=false` and
`runtimeIntegration=false` remain unchanged.

Exact input: `014d2f53a557bc4b83abca8f60ecdd090410fce7`, main.
Evidence: `scratch/runs/20261103-jedi-authentic-script-assets/` (ignored).
Only file operations and offline parsing/disassembly were performed. No game,
emulator, browser, build, boat, guest writes, engine calls, injected events,
compilation-container download, or subworkers. The completed 56-archive search
was not repeated. Held CACA003B timer lifetime work was untouched.

## Package and exact member identities

One `curl --fail --location --retry 0` retrieval from
`https://archive.org/download/jedi-knight/jedidemo.exe` completed HTTP200,
one redirect, exit0, 21,195,858 bytes. Effective URL:
`https://dn721808.ca.archive.org/0/items/jedi-knight/jedidemo.exe`.
Raw response headers, curl JSON receipt and stderr are retained. Its SHA256
was verified **before extraction**:
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
There were no retries, mirrors or substitutions.

The extractor copied verbatim from the input commit's
`tools/extract-jedi-knight-demo.js` validated package identity, all39 ZIP
records, decompressed sizes and CRC32. Output: 40,812,035 bytes. This is the
flat original package, not an observed installed layout. Both required GOB
hashes were checked before directory parsing; the third GOB was also parsed
to check for alternate packaged scripts.

| Archive | Bytes | Members | SHA256 |
| --- | ---: | ---: | --- |
| `res1demo.gob` | 31326451 | 1544 | `9708ac558b00e76bc4e0dc2e663cc9e867b32bc1b283499734fad0982f8e852e` |
| `jk1demo.gob` | 3618820 | 33 | `f9a8d7410577eda1e092a0529dfb959525de23fa203e1a0456c4c74f8647931f` |
| `jk1mpdemo.gob` | 674061 | 4 | `b7bab76a6552fed1f5e7fe120625dafb037f21b4645f05914326974fa966bc92` |

The directories use `GOB `, version20, directory offset12, count followed by
136-byte entries (offset u32, size u32, 128-byte NUL-terminated name field).
Directory ends are210000,4504,560 respectively. Every member's original name,
raw name bytes, full128-byte name field, directory entry offset, payload
offset/size and SHA256 are retained in each archive's `inventory.json`.
Names are preserved with their original backslash and case; filesystem
extraction uses numeric entry indices so duplicate names cannot overwrite.
All135 COGs and relevant DAT/JKL/UNI/episode files are recovered verbatim,
including CRLF endings; all1581 members are hashed.

Selected identities below are zero-based directory entries in `res1demo.gob`:

| Exact member name | Entry | Offset | Bytes | SHA256 |
| --- | ---: | ---: | ---: | --- |
| `cog\kyle.cog` | 765 | 11210090 | 13776 | `cf68cc4754acd78d2d84297eb6d05df80d0e8e265fa5d5a902b7101f8e523955` |
| `cog\item_shields.cog` | 761 | 11206399 | 2030 | `da5a155ae80058de2e1d1f3b81be4d13e465f34a097328d10d6471e1c7229a69` |
| `misc\items.dat` | 961 | 13746036 | 10232 | `9f668a33ceb17d6c39b727c61682dddd109042fa80883041e74c36a7dc5380e7` |
| `cog\force_absorb.cog` | 737 | 11136269 | 3979 | `6336236a9f13c39c334652d1a5305042d80dc9d6d94b773e09cce24c12a4b6a9` |
| `cog\force_protection.cog` | 746 | 11172883 | 4583 | `4ba55d8f175c8b10d0c5d2a08c5e92d95fcae96b6cb1d1214ea4370e9685a638` |
| `cog\pow_revive.cog` | 786 | 11280484 | 1545 | `6904811bf2f22d8fbfde1c206ec8f1c0da2ed66f4217312fa31c934f52f3214e` |
| `cog\pow_shields.cog` | 789 | 11286458 | 1526 | `8d515630da6ac31126decd4ca8c94ef840c42edc1110ef102e5f48530d88e8ad` |
| `cog\pow_supershield.cog` | 794 | 11299915 | 3174 | `73d88c22033240be74810cb8457fd94834a7d3aa35065a102312f4289730d004` |
| `cog\pow_vest.cog` | 796 | 11305667 | 1530 | `d3550f626554565280f3fa30bbc4c0c5b9032caad6f6d5fed47e16732efe2d5f` |

`jk1demo.gob` entry31, `jkl\09fuelstation.jkl`, offset69094,
3547906 bytes, SHA256
`3cc6db585f16f2976d12750848498a39942088bad85372882c934c0e506572ae`
lists `kyle.cog` at line95860; line96101 defines `walkplayer` with
`cog=kyle.cog`. These are authored resource references, not live pointer proof.

No duplicate name exists within any individual GOB. No COG or `items.dat`
name repeats across these three GOBs, including after case folding. The only
cross-archive repeated names are `episode.jk` and `misc\cogstrings.uni`, each
in both episode archives with different hashes; both copies are preserved.
`duplicate-members.json` records exact identities. The episode bodies identify
TYPE1/Fuel Station and TYPE2/m4 respectively. Neither member order nor these
bodies establishes engine resource precedence or the live mounted set. No
packaged overriding `kyle.cog` or `item_shields.cog` was found; loose installed
files and other runtime mounts were not inspected.

## Authentic message10 and shield behavior

The recovered `jkdemo.exe` is1388032 bytes, SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`.
At `0x4de50d`, it pushes `0x54aba8` (the exact `damaged\0` string),
then integer10 and the symbol-table argument before calling `0x4e08b0`.
The helper looks up/inserts the named symbol and supplies its integer value.
`damaged-registration.dis`, helper disassembly and the string/PE mapping
receipt retain this original message10/name association. The accepted
`0x4ccabf → 0x4dfda0` delivery and ReturnEx paths apply unchanged.

`kyle.cog` lines131–135 calls `make_bubbles` when param1 equals32, then
`ReturnEx(GetParam(0))`. That branch contains no shield subtraction. The
bubble subroutine includes Sleep calls; its mere text does not prove
synchronous completion. Startup/newplayer initialization elsewhere raises
bin60 to100 minimum; multiplayer initialization sets100. These writes must
not be confused with damage absorption.

`items.dat` declares `shields 60 0 200.0 0x030 cog=item_shields.cog`.
This supplies an authored bin-to-script association and bounds, not a
captured live listener. `item_shields.cog` lines33–110 obtains the player
from **GetSenderRef**, reads bin60, takes damage from param0 and type from
param1, then returns the adjusted damage with ReturnEx:

- If shields are nonpositive, damage is passed through unchanged.
- With positive shields, **exact type2 or type4** takes the energy/fire
  branch. It computes `R = shields - damage`. If R>50 the returned damage
  becomes0; otherwise, when old shields>50, it subtracts the portion above50
  from damage. Any remaining positive damage is multiplied by `1 - R/50`.
  It calls `SetInv(player,60,R)` before ReturnEx. Type comparisons here are
  equality tests, not bit tests; mixed type6 does not enter this branch.
- Exact type16 takes the saber branch. It saves half the incoming damage,
  runs that half through the same threshold/scaling sequence, writes bin60,
  then adds the saved half back to returned damage.
- Other types pass through without a bin60 write in this handler, including
  type8 and32. Sound/tint calls precede the relevant inventory stores.

The scaling uses the **unclamped** R, including negative R. The accepted
generic SetInv path clamps the stored inventory using the bin bounds. For
positive energy/fire damage, authored arithmetic gives (shield100,damage20)
→ (stored80,returned0); (60,20) → (40,2); (10,20) → (0,24).
Saber (100,20) → (90,10). These are arithmetic illustrations from source,
not executed COG/VM tests or observed health outcomes. Do not replace this
script with a generic one-for-one absorption formula or clamp R before scaling.

Other recovered handlers can alter the running amount: `force_absorb.cog`
uses activation bin28, flags8 and rank/4 to convert qualifying damage into
mana bin14; `force_protection.cog` uses flags30 and **armor bin61**, consuming
armor and returning overflow. The latter also has a deterioration pulse.
Their existence proves neither activation nor invocation order in the retained
encounter. The linked-listener/return chain in the accepted analysis remains
necessary; an earlier/later listener may alter the amount.

Non-damage bin60 writers include `pow_shields` (+20), `pow_vest`
(ChangeInv by bin maximum), `pow_supershield` (+50), `pow_revive`
(SetInv to bin maximum), and Kyle initialization. All recovered actor,
environmental and weapon COGs remain available for further source work.
`script-analysis-index.json` is a reproducible textual hit index, not
exhaustive semantic writer coverage. For example, dynamic bin arguments,
engine initialization, restoration, networking and bulk stores still need
independent coverage. The environment scripts also contain authored
DamageThing calls; those alone establish no cause of the retained loss.

The precise remaining gap is still the live load/null check at
`0x4dfe04/0x4dfe0c` of `victim+0x29c`, its compiled definition/handler and
actual invocation, plus other attachment/listener bindings (including bin60),
their ordering/state, and all shield writers. Authentic text does not prove
that these pointers referenced these resources in that process/epoch.
Shield writes can precede a zero damage return, so unchanged health cannot
exclude shield loss. The retained8699ms gap remains unattributed; no Bossk,
weapon, hostility, complete first-damage or campaign-ready claim follows.

## Bounds tests and recovery

`parse-gob.cjs` checks the header/version, bounded count/table extent,
subtraction-based offset/size containment, metadata overlap and terminated
ASCII names before reading/hashing payloads. Names never become filesystem
paths. All originals passed. `test-parse-gob.cjs`: **27 passed**, including
short header/count/entry/payload, excessive count, out-of-file/uint32 maximum
offset and size, metadata overlaps, empty/unterminated/non-ASCII names,
valid EOF/zero-length cases, raw name padding, duplicate retention and exact
recovered payload comparison. These are parser tests, not game tests.
An independent Python reader matched all1581 directory records and all149
recovered payloads byte-for-byte (`independent-parser-check.json`).

The ignored run retains both readers/tests, original package/all39 files,
three complete member hash inventories, duplicate and script indices,
HTTP receipt, verification records, `RECOVERY.md`, `result.json`,
`final.txt` and `SHA256SUMS`. The manifest seals all durable run artifacts
except itself; watcher files are excluded. Free disk remained above2GB.

To reproduce in a fresh ignored run directory, retrieve the single original
URL once using the exact curl flags above with `--dump-header` and
`--write-out '%{json}\n'`. Stop on HTTP/curl failure or size/SHA mismatch;
do not retry or substitute. Verify21195858 bytes and the package SHA256
listed above, then extract with the committed input-version tool:

```sh
git show 014d2f53a557bc4b83abca8f60ecdd090410fce7:tools/extract-jedi-knight-demo.js > "$run/extractor.cjs"
node "$run/extractor.cjs" "$run/jedidemo.exe" "$run/original"
```

Check both required GOB SHA256s against the table before parsing. The
self-contained offline reader below can be saved as `$run/recover-gob.py`.
Run `python3 "$run/recover-gob.py" "$run/original/res1demo.gob" "$run/res1demo"`
and likewise for the other GOBs, always using new output directories. It
preserves all member identities and hashes, recovering the selected resource
types under numeric filenames. For the retained JavaScript test suite, run
`node "$run/test-parse-gob.cjs"`; no engine or compilation is involved.

No box was assigned; none was queried or operated. Box ID/state/expiry are
not applicable. The next separately authorized work is live binding proof,
remaining writer coverage and synchronous capture/stop qualification.

```python
#!/usr/bin/env python3
"""Independent bounded reader; names stay metadata, never filesystem paths."""
import hashlib, json, pathlib, struct, sys
src, dest = map(pathlib.Path, sys.argv[1:])
b = src.read_bytes()
def check(ok, why):
    if not ok: raise ValueError(why)
def span(p, n):
    check(0 <= p <= len(b) and 0 <= n <= len(b)-p, 'bounds')
def u32(p):
    span(p, 4)
    return struct.unpack_from('<I', b, p)[0]
span(0, 12)
check(b[:4] == b'GOB ' and u32(4) == 20, 'header')
d = u32(8)
check(d >= 12, 'directory overlaps header')
count = u32(d)
check(count <= 100000, 'count limit')
span(d+4, count*136)
end = d+4+count*136
entries = []
for i in range(count):
    p = d+4+136*i
    off, size = u32(p), u32(p+4)
    span(off, size)
    check(off >= 12 and not (off < end and off+size > d), 'metadata overlap')
    raw = b[p+8:p+136]
    nul = raw.find(b'\0')
    check(nul > 0 and all(32 <= c <= 126 for c in raw[:nul]), 'name')
    name = raw[:nul].decode('ascii')
    entries.append(dict(index=i, directoryEntryOffset=p, name=name,
        nameBytesHex=raw[:nul].hex(), nameFieldHex=raw.hex(), offset=off,
        size=size, sha256=hashlib.sha256(b[off:off+size]).hexdigest()))
dest.mkdir()
for e in entries:
    ext = e['name'].rsplit('.', 1)[-1].lower()
    if ext in ('cog', 'dat', 'jkl', 'uni', 'jk'):
        e['recoveredFile'] = f"{e['index']:04}.{ext}"
        with (dest/e['recoveredFile']).open('xb') as f:
            f.write(b[e['offset']:e['offset']+e['size']])
(dest/'inventory.json').write_text(json.dumps(dict(size=len(b),
    sha256=hashlib.sha256(b).hexdigest(), directoryOffset=d,
    directoryEnd=end, count=count, entries=entries), indent=2)+'\n')
```
