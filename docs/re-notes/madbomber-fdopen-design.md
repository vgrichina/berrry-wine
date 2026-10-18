# CRT `_fdopen`: descriptor ownership checkpoint

2026-10-18, source-only audit after Mad Bomber's original zlib packed loader
received NULL for CRTDLL `_fdopen`. See [the original-game evidence](madbomber-025.md).
This checkpoint deliberately does not register an API that cannot yet meet
the requested descriptor/access/mode contract. No handler, fake FILE, guest
replacement, build, compiled test or new game run is included.

## Decision and scope boundary

The existing FILE representation is suitable for wrapping a descriptor, but
a handler-only change cannot validate that descriptor's access and mode from
the current WAT-visible state. A correct implementation needs a descriptor
metadata prerequisite across `_open`, `_dup`, `_close` and stream adoption,
or an explicitly scoped binary-only contract backed by a new read-only host
query. Reopening by pathname, duplicating a descriptor to simulate adoption,
probing with writes, or accepting every integer would violate ownership,
position, access, or failure behavior.

The parent assignment explicitly allowed a design checkpoint if a coherent
implementation scope was not established. This is that checkpoint; `_fdopen`
remains unresolved pending the prerequisite and real I/O conformance tests.
The runtime diagnostic proved symbol lookup failure only, not that Mad Bomber
has yet invoked this API with any specific descriptor or mode.

## Source findings

Audit evidence: `scratch/runs/20261018-madbomber-fdopen-design/`, containing
`source-identity.json` with seven physical source hashes, focused original
function excerpts, and the inspected upstream Wine source. Canonical source
was inspected after `7d31dba3c`; the exact inspected HEAD is in the receipt.

| Existing path | Reusable behavior | Missing prerequisite or limit |
| --- | --- | --- |
| `src/09a6-handlers-crt.wat`, `$handle__open` | Returns the VFS handle with requested read/write access. | Does not retain CRT open flags; `_O_APPEND` seeks only once. Text/binary state is not recorded. |
| `$handle__read`, `$handle__write`, `$handle__lseek` | Operate on that same handle and position. | No WAT descriptor table or metadata validation API. Existing byte passthrough is not text translation. |
| `$handle__dup` | Uses `host_fs_duplicate_handle` and maps errors. | Does not propagate CRT text/binary/append metadata because none exists. |
| `$crt_fopen` / `$crt_file_init` | Owns a 48-byte record containing a real 32-byte guest FILE; `_file` is the VFS handle. | Calls an opening function; cannot be reused wholesale for `_fdopen` without reopening/truncating. |
| `$crt_mode_flags` | Selects read/write/update stream flags. | Scans arbitrary trailing bytes and accepts unknown modifiers; not sufficient for requested strict mode validation. |
| `$crt_fclose`, `$crt_stream_close_all` | Unlinks/releases the FILE record and closes the stored handle. | Adoption must preserve that exact descriptor ownership and reject stale identities. |
| `$crt_freopen` | Closes the old descriptor and preserves the FILE pointer on successful replacement. | Any new descriptor metadata must retire the old association and initialize the new one too. |
| `lib/filesystem.js`, `getOpenFile` / handle records | Knows live/closed state, granted access and current position. | Those fields are not exposed to WAT as a read-only descriptor query. |
| `duplicateFileHandle` | Separate handle lifetimes share one position object; grants cannot escalate access. | Duplication would make `fclose` close the duplicate instead of the original passed to `_fdopen`. |
| `closeHandle` | Leaves a closed tombstone and clears pending reads; duplicate lifetimes remain separate. | Closing the original through a stream must preserve that behavior. |
| `fs_file_information` | Returns file identity, size, attributes and timestamps. | Does not expose granted read/write access or CRT modes. |

The existing VFS enforces data rights before reads/writes, including zero-byte
operations. Nevertheless, using a trial read/write as an access query is
inappropriate: the write path can update position for append-only handles
and may interact with metadata/provider state. A harmless seek or file-size
query establishes neither write permission nor CRT mode.

The FILE list is process-shared through `CRT_STREAM_STATE`, not a per-instance
WASM global. Any descriptor metadata must follow that process ownership or
the same main-host VFS instance used by Worker RPC. A private JavaScript map
on each Worker or a private mutable WAT global would break cross-thread use.

## Contract references and unresolved historical detail

[Microsoft's `_fdopen` documentation](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/fdopen-wfdopen?view=msvc-170)
states that the returned stream owns the supplied descriptor and that closing
the stream closes it. It describes read/write/update modes, append behavior,
text/binary translation, error returns and errno. These are useful contract
constraints; its modern invalid-parameter machinery is not automatically a
Win98 CRTDLL requirement.

[Wine's CRT implementation](https://github.com/wine-mirror/wine/blob/master/dlls/msvcrt/file.c)
parses mode flags, allocates a FILE and initializes it against the supplied
descriptor, rather than opening the filename again. Its descriptor subsystem
already records open/text/append state. That architecture is evidence for
the missing prerequisite here, not code to copy or proof of exact vintage
CRTDLL behavior. Before setting a definitive compatibility policy, check
which mode modifiers alter the existing descriptor for the targeted CRTDLL;
modern documentation and Wine are not sufficient to assert all historical
edge cases. In particular, do not implement `w` by truncating an existing fd
or assume `a` is just a one-time seek.

## Smallest coherent implementation proposal

1. Add a read-only descriptor query at the main-host VFS boundary. Return
   explicit status plus live identity/generation, granted read/write rights,
   and retained CRT mode state. It must not read lazy file data, move the
   cursor, allocate a new descriptor, or change ownership. Preserve normal
   Worker RPC routing and regenerate/validate host-import signatures.
2. Retain CRT open-mode state when `_open` succeeds; propagate it through
   `_dup`; retire it on `_close`, `fclose`, `freopen` and process cleanup.
   Metadata must distinguish a raw Win32 handle from a known CRT descriptor
   unless a reviewed bridge explicitly permits it. Define how preexisting
   `fopen` handles and standard descriptors 0/1/2 participate; they cannot
   silently inherit arbitrary rights. Keep this state process-shared.
3. Establish the vintage mode grammar and a bounded parser. Reject NULL,
   malformed, conflicting or unsupported modes before acquiring ownership.
   A binary-first slice may be appropriate, but it must explicitly reject
   text/default-translation requests until that contract is implemented.
   A missing handler is preferable to silently treating text as binary.
4. Validate the descriptor's live identity and access compatibility, reserve
   an ordinary FILE record without opening or seeking the underlying file,
   initialize its fields, then publish it through the existing shared list.
   Failed allocation/mode/access validation leaves the descriptor open and
   its position/bytes unchanged. No lock may span host RPC or heap allocation;
   revalidate identity before publication or use a small reservation protocol
   so a concurrent close cannot turn a validated descriptor into a stale one.
5. Reads/writes/seeks through the FILE use the same handle and position.
   `fclose` closes precisely the adopted fd once, releases its record, and
   leaves distinct duplicated descriptors alive. Preserve caller-pop cdecl
   ABI and defined errno failures. Append at every write where required;
   access must never be promoted by the mode string.
6. Only once implemented, append `_fdopen` to `api_table.json`, generate both
   dispatch and API hash tables, and test dynamic resolution on the actual
   CRTDLL fallback route. Do not add a symbol-only stub to pass the packer.

This is more than one handler but remains a bounded CRT-descriptor change.
It does not authorize broad text-I/O emulation, arbitrary guest-memory FILE
adoption, or cross-CRT FILE sharing. If the slice is limited to binary owned
descriptors, state and test those boundaries explicitly before integration.

## Required real-I/O conformance

Extend the existing compiled `test/test-crt-stdio-file.js` style harness or
add a focused JavaScript test in the normal test tiers. Reuse real VFS, the
actual WAT handler and cdecl ESP assertions; do not substitute a fake FILE or
mock `_fdopen` return. `test/test-duplicate-handle.js` already exercises shared
cursor and independent close lifetimes and should remain a regression gate.

| Case | Observable requirement |
| --- | --- |
| `_open` read/write binary, `_lseek` to 2, `_fdopen("r+b")` | No extra VFS open, truncate or seek; FILE `_file` equals the original fd. |
| Alternate `_read` and `fread`, then `fseek` and `_lseek` | Byte data and one shared position advance consistently. |
| `fwrite` through FILE, then read through descriptor | Actual updated bytes, correct item count and position; existing content not truncated by adoption. |
| Write mode on read-only fd; read mode on write-only fd; update mode on either | Defined failure with no ownership/position/content change; no access escalation. |
| Append after seek to middle | Write occurs at end when required by chosen descriptor/mode contract, not just on initial adoption. |
| `fclose(FILE)` | Original fd closed, later descriptor I/O fails, FILE record retired; second close cannot close another file. |
| `_dup(fd)` before adoption | Shared position across both descriptors; closing the adopted fd leaves duplicate usable. |
| Failed mode, invalid/closed/foreign fd, OOM | NULL/defined errno; no descriptor leak, lost ownership, FILE list entry or data/position change. |
| Premature `_close(fd)` followed by `fclose(FILE)` | No stale-handle reuse or double-close of another descriptor; failure and record release are explicit. |
| `freopen` and process cleanup after adoption | Correct old/new descriptor lifetime and complete cleanup. |
| Process sharing and isolation | Same-process second instance sees ownership; independent process memory/VFS does not. |
| Dynamic GetProcAddress on CRTDLL | Nonzero handler address and real behavior; original shared MSVCRT export resolution still wins for its own image. |

Validation status: source audit and documentation checks only. No compiled
conformance has been authored or executed for an implementation, because none
is included. Next deliverable is the agreed descriptor metadata/query slice
plus real read/write/seek/close tests; build/runtime requires the coordinator's
separate resource grant.
