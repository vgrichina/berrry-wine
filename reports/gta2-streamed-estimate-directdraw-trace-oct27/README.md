# GTA2 streamed staging and DirectDraw trace

Status: **BLOCKED_RAW_CAUSAL_HRESULT_NOT_OBSERVED**. One diagnostic guest ran;
zero WAT compiler invocations. No emulator/runner behavior was changed.

The streaming estimator passed the unchanged aggregate128MiB cap at132677632B,
1720320B below the predecessor134397952B failure. Margin1540096B; CPU6.81s,
wall2.90s. It streams immutable Git blob/file bytes through64KiB reads into
tar/gzip and a counting/hash sink. No whole source blob or compressed archive
is retained in memory. Groups cap40files/2MiB; larger files stream alone.
The unchanged supervisor counts itself, its pool parent, and all descendants.
Two owned children replaced three; removed nested Python stream/control wrappers.
The modest aggregate reduction is measured, not an assumed large buffer saving.
Git retains its subprocess-only512MiB DATA cap, pool2 and shared Git lock.
The original failed recipe and incident remain untouched in the predecessor ops.

All3828 source/game/font/module files (105513902B) staged in120 streamed gzip
groups (32780629 compressedB). First group554405B took3.59s/26requests;
the projected remaining222.48s passed. Full staging/preflight finished13:50:17UTC,
before13:53UTC (15minutes before cutoff). Retained wasm hashes, source1e4fdb06,
runner6dc104b3, API table,71 game files and290 host functions plus memory import
passed exact remote checks. Nodev24.22.1 with2048MiB old-space and4GiB physical
supervision passed exact environment/limits startup; DATA/AS remained unlimited.

Actual Dmavideo.dll SHA256f5eb2e2f8904d47bba0c095bcdc6764a53e186c3297338898c57e907c395ce1d
loaded at0x00951000, preferred0x01000000. GTA2 remained at0x00400000.
API#667..672 identify the fullscreen initialization sequence. QueryInterface
requested IID_IDirectDraw4 and returned S_OK; SetCooperativeLevel flags0x51,
SetDisplayMode640x480x16, and the single observed CreateSurface call carries
the complete124-byte descriptor (flags0x21, caps0x6218, one backbuffer).
Its continuation is0x009531ee, corresponding to preferred0x010021ee.
No initial/final alternate CreateSurface calls are observed in this sequence;
do not invent fallback failures or raw returns absent from the log.

API#672 is GetAttachedSurface(this0x08221038, caps0x074ffe34, out0x0087addc),
with vtable0x006fd7fc and caller return0x00953275 (preferred0x01002275).
The16 caps bytes are `04 00 00 00 01 00 01 00 30 e1 95 00 00 00 8f 08`:
DWORDs0x4,0x10001,0x95e130,0x088f0000. Extra DDSCAPS2 words are actually nonzero.
The return trace at GTA2 EIP0x005ca69b captures **EAX1, ESI2**, previous guest
block0x00953279. The accepted unchanged PE disassembly shows GetAttachedSurface
TEST EAX/JE at preferred0x01002275/0x01002277, then MOV EAX,1 at0x01002279.
Thus the observed execution identifies that terminal failure path separately
from the requested mode ID. API logs are buffered; their textual placement
after the immediate TRACE-AT line is not chronological execution ordering.

**Missing:** the raw HRESULT before the DLL overwrote EAX. The pinned API table
has no `ret` for GetAttachedSurface (also several other DirectDraw calls).
Production log_api_exit calls formatRet, which returns null without `entry.ret`,
then clears lastApiName. Consequently no returned value appears for API#672.
Source suggests0x887600ff for nonzero native DDSCAPS2 fields; this is inference,
not a captured HRESULT or verified native surface ABI selection. No API repair,
ignored caps, forced success, fullscreen fix or gameplay claim is justified.
The smallest missing observation is raw EAX at the actual API return boundary,
before its TEST/overwrite, with the retained API identity and inputs. An unchanged
guest retry is not justified. Coordinator must assign a reliable observation path;
this worker stops without changing runner implementation or consuming another guest.

The sole250-batch step received exact ACK then frozen-zero snapshot. Seven
serialized controls ended with a harness quit ACK; no game Quit is claimed.
Node exit0, supervisor cleanupComplete, no pending control or surviving owned
identity. Guest174014464B peak RSS,1.44CPU seconds,0.409wall seconds.
Original stderr warnings about unstaged optional system PE DLLs are retained;
they did not prevent the target DirectDraw/error boundary from executing.
The first group-generation attempt stopped on an existing stderr filename;
the corrected distinct filename continued without a guard change or guest replay.

Box bx_cqss3x42 is LEFT RUNNING; coordinator shutdown ownership remains14:15UTC,
guest cutoff14:08, handback14:12, expiry2026-10-27T14:27:50.265Z. No lifecycle
mutation. `diagnostic-result.json`, `runtime-readiness.json`, `cleanup-remote.json`,
the retrieved raw stdout/stderr/controls and the canonical manifest bind evidence.
Large transfer archives and encoded upload commands remain in the owned ops tree,
recoverable from immutable source pins plus estimate.py; no binary is committed.
Raw guest.stdout and accepted disassembly are losslessly gzipped for publication;
their original bytes remain in ops. The initial whitespace check rejection is
preserved. No main integration, public deployment, workers, downloads or replacement tasks.
