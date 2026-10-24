# Enigma: register-derived loader is the embedded Lua package loader

The native call at **VA `0x5ab960` is `kernel32.dll!LoadLibraryA`**, reached
through thunk `0x7c96f0` and IAT slot `0x9ef884`. Its enclosing function starts
at `0x5ab8f0`. It receives the Lua state in EAX, the module filename in EDX,
and the requested symbol in ECX. This resolves the earlier register-provenance
unknown to three decoded Lua package-loading callers. It does **not** determine
which names the game actually supplies or establish dynamic dependency closure.

The immutable source donor is `12dd6ea7861ac7608a45afb40d404fdc68990681`.
The existing parser is unchanged, SHA256
`f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf`.
Authentic unpacked EXE SHA256 is
`5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45`
(6,287,872 bytes). Its packed original is
`ce4ff5d66de3af85d3e0b1aef88995a54be7f44e78de81793169eb65e71e046e`.
Exact standing input/output paths and all twenty checked module hashes are in
the evidence JSON beside this note. No binary was unpacked, replaced or executed.

## Byte-backed argument and control flow

At `0x5ab8f5` the routine saves state EAX in ESI. At `0x5ab900` it saves
symbol ECX at `[EBP-0x10]`; at `0x5ab903` it saves filename EDX in EBX.
The strings `_LOADLIB`, `LOADLIB: ` and `%s%s` at `0x959059`, `0x959062`
and `0x95906c`, the registry-index operations, userdata allocation and handle
store support a per-state filename-keyed module-handle cache.

At the real basic block `0x5ab957`, `mov eax,[edi]; test eax,eax; jne 0x5ab97f`
skips loading if a cached handle exists. Otherwise `mov [esp],ebx` at
`0x5ab95d` supplies the saved filename to the call at `0x5ab960`.
The thunk bytes are `ff 25 84 f8 9e 00`; the sealed PE import parser independently
maps that slot to kernel32's `LoadLibraryA`. A zero return branches at
`0x5ab96c` to `0x5aba67`, constructs the Windows error, stores a zero handle,
and returns loader status 1 without doing a symbol lookup.

At `0x5ab97f`, reached with either a cached or newly loaded handle in EAX,
the routine reloads the original symbol into EDX, writes handle to `[ESP]`
and symbol to `[ESP+4]`, then calls `0x7c9700` at `0x5ab989`.
That thunk is `ff 25 50 f8 9e 00`, independently bound to
`kernel32.dll!GetProcAddress` at IAT `0x9ef850`. A zero symbol result takes
`0x5aba51` and returns status 2. A successful result is passed to the native
Lua C-closure push routine at `0x596dd0` with zero upvalues; status is 0.
These are requirements on Windows providers, not emulator implementation claims.

## The three decoded caller sites

Candidate E8 scanning found three direct sites targeting `0x5ab8f0`; each was
then decoded from its containing function entry. This is a bounded direct-call
finding, not proof that indirect or self-modifying callers cannot exist.

| Caller entry / call | Filename provenance | Symbol provenance |
| --- | --- | --- |
| `0x5aba80` / `0x5abac1` | Checked Lua argument 1 | Checked Lua argument 2 |
| `0x5abe40` / `0x5abe8e` | First readable candidate from the `cpath` search for argument 1 | Initializer name derived from argument 1 |
| `0x5abed0` / `0x5abf67` | `cpath` search for prefix before argument 1's first dot | Initializer name derived from the **full** argument 1 |

The first function checks indexes 1 and 2 through `0x598190`. That wrapper
delegates to `0x5969d0`, which indexes the Lua value, checks string tag 4,
converts when possible, and returns its string payload at object+16. Positive
indexes use `base + (index-1)*16` in `0x5961f0`. The wrapper rejects a null
conversion. At `0x5ababb` the checked argument-2 pointer goes to ECX and the
checked argument-1 pointer to EDX before the shared call. Neither is a literal.
The native registration pair at `0x95902c` is
`{0x95901c="loadlib", 0x5aba80}`. Initializer `0x5ac840` selects that table
and registers `package`, identifying the public interface as `package.loadlib`.

The ordered searcher table at `0x959008` contains
`0x5abfc0,0x5abd40,0x5abe40,0x5abed0,0`; initializer instructions at
`0x5ac8e2` and `0x5ac8f9` actually read it. The last two searchers select
literal `cpath` (`0x9590f4`) and call the shared search routine `0x5abb20`.
It replaces module-name dots with backslashes, reads that field from its Lua
environment, requires a string, splits semicolon templates and substitutes `?`.
Candidate paths are probed by `msvcrt!fopen(path,"r")` at `0x5abc25`.
Only a nonzero file result reaches `0x5abca3`, closes it and returns the found
path in EAX. The callers save that result in EBX and transfer it to EDX.
Failure to find a path bypasses the shared loader.

The initializer-name routine at `0x5abdc0` finds the first `'-'`; if present it
uses the suffix after it. It replaces dots with underscores through `0x598b60`
and formats `luaopen_%s` using literal `0x9590e9`. Thus, for illustration only,
`prefix-foo.bar` produces `luaopen_foo_bar`; this is not an observed game request.
The C-root searcher's filename uses just the prefix before the first dot, while
its initializer still uses the full module name. Its status-2 missing-symbol
branch at `0x5abf75` can report a search miss rather than raising the same
load error used for other nonzero statuses. Optional search misses cannot be
classified as startup-fatal from this loader's existence.

The literal default cpath at `0x959293` is
`.\?.dll;!\?.dll;!\loadall.dll`; `LUA_CPATH` also exists and is passed to
the path initializer. The template's `loadall.dll` is a **conditional candidate**,
not a proven `LoadLibraryA` request. Current environment, Lua writes to cpath,
requested module names, file availability and earlier searchers can all change
whether these callers run. No specific filename or complete symbol name is
provable as an actual request from this bounded native path alone.

## Exact unresolved predicate and smallest runtime observation

For this site to request a new DLL, execution must reach a decoded caller with
valid strings, its path search must succeed when applicable, and the handle
loaded from `[EDI]` at `0x5ab957` must be zero. The actual filename is the
caller's EDX at shared entry; actual symbol is its ECX. The native image does
not supply their live Lua values or the preceding script/searcher decisions.
Nonzero cache state skips `LoadLibraryA` but still requests the symbol.

A minimal coordinator-assigned observation is one hit at **function entry
`0x5ab8f0`**, recording `[ESP]` (caller return address), EAX state, EDX filename
and ECX symbol with bounded NUL-terminated reads, followed by the actual block
`0x5ab957` and `[EDI]` value/branch. Caller returns `0x5abac6`, `0x5abe93`
and `0x5abf6c` distinguish the three decoded callers. If failure handling matters,
record the returns at `0x5ab965` and `0x5ab98e` and the selected error branch.
These are real entry/block/call-return boundaries. A counter inside an
instruction window cannot substitute for these observations. If no shared-entry
hit occurs before the first menu/failure, this path contributed no observed
dependency on that route; that does not close later execution.

## Reproduction, controls and limits

```sh
python3 -B tools/enigma-register-load-cause.py \
  /tmp/enigma-authentic-static-unpack-oct24/outputs/enigma.exe
python3 -B test/enigma-register-load-cause.test.py \
  /tmp/enigma-authentic-static-unpack-oct24/outputs/enigma.exe \
  /tmp/enigma-register-load-cause-oct24
```

The helper checks **78** targeted byte/argument/table assertions plus IAT
identities and the immutable full EXE/parser seals. Ten real-byte mutations
reject before the seal: swapped module provenance, inverted cache branch,
wrong API call, wrong symbol argument, wrong Lua argument index, wrong searcher
register, inverted file-probe branch, wrong hyphen delimiter, wrong path field,
and changed registration target. A separate unrelated-byte mutation passes the
selected semantic checks and still rejects at the full-file seal. Mutation
bytes are owned bytearrays; only that final seal control briefly writes a
6,287,872-byte owned temporary file, which its temporary-directory context removes.
There is no public skip-hash mode and no existing test/oracle was changed.

Fourteen bounded installed-objdump captures, exact argv/status/log hashes,
native-span hashes, all twenty module identities, final tool/test hashes and
actual execution receipts are retained in the adjacent evidence JSON. Raw
disassembly/logs and one-owner ledger remain under
`/tmp/enigma-register-load-cause-oct24/`. No source acquisition was used;
the Lua identification and flow statements above derive from these native bytes.

Previously accepted normal imports (849/40 edges/192 packaged bindings), six
codec initializers (74 requests: 50 packaged, 24 missing) and the original
2460-file **BLOCKED_PACKED_IMPORTS** finding retain their prior scope. Those
baseline oracles were not rerun. Codec necessity, full dynamic closure, system
API behavior, initialization and gameplay remain unproven.

Initial resource projection: 48,234,496 / 67,108,864 bytes including source/Git,
temporary/evidence overlap, external full-session/events, SQLite positive-growth
allowance/future growth and 8 MiB reserve. Readonly ten-module inputs/outputs and
installed tools are separately identified standing material; none was copied.
Fresh Python admission requires 805,306,368-byte MemAvailable; commands have
60-second CPU/wall and 25,165,824-byte per-file bounds. Final resource, strictSSH
publication and watcher cleanup receipts remain at task root. Early combined
disassembly output was larger than the requested 8 KiB code-view slice; its
capture remains charged, and subsequent retained captures are each <=8 KiB.
No denied operation or unchanged retry occurred. No guest/browser/box/build/
compiler/acquisition/main merge or worker launch occurred. Mount argv and box
ID/state/expiry are N/A; coordinator retains lifecycle ownership. Root tracked
files/index/refs, donors and original/standing binaries stayed read-only; root
coordination used append-only board writes. Stop after publishing this finding.
