# Return Fire audio path, offline investigation, 2026-11-05

The concrete gap is **an observation of successful audio initialization followed
by a populated secondary-buffer Play and host delivery on the accepted route**.
No emulator defect is demonstrated; no production fix or audible-playback claim
is justified. This assignment ran no game, browser, boat, capture or full build.
Accepted launcher `5d014a0e` and presentation/movement `9f695796c` remain accepted.

Read first: `CLAUDE.md`, the Return Fire TODO, `return-fire-demo.md`, and
`alice-return-fire-reconciliation-20261018.md`. Source inspection base:
`58da3cdf95fb6c2f404e1d500fc8312efa6131d7`. Relevant audio sources were clean;
unrelated MDK/Stronghold work was left untouched. Evidence and executable offline
fixture: `scratch/runs/20261105-return-fire-audio-cause/`.

The accepted October 31 run directories `20261031T2213Z-return-fire-presentation`
and `20261031T2230Z-return-fire-launcher` are absent locally. Their complete dated
notes were read, including original pins, ordinary audio/default Worker route,
trusted input and normal cleanup; their screenshots/logs could not be reread.
The historical `20261009T2052Z-return-fire-browser-audio` directory is also absent.
Its reported 99/100 non-silent analyser windows on module `527004d9...` are
historical, not current evidence or a listening review. Available worker
completion JSONs only report exit status; they contain no guest audio trace.

Original input recovery uses existing paths, without copies:

- `test/binaries/candidates/return-fire-demo/RFIRE/DEMO.EXE`, 323072 bytes,
  SHA256 `b3407ec82d5e8d181116d2bb7a4998ff180773f3b6f91e98e7156979f3859a63`.
- All 58 payload paths/sizes/SHA256s are pinned in
  `test/candidate-corpus/return-fire-demo-files.json`; all match in this audit.
  `lib/apps.js` registers `return_fire_demo`, real indexed desktop 8, required
  files from `test/binaries/candidates/return-fire-demo/.wine-assembly-browser.json`.
  Its 57 support entries include all 37 effects.
- If originals disappear: `node tools/fetch-candidate-corpus.js --id=return-fire-demo`,
  then `node test/test-return-fire-recovery.js`. Expected RFIRE.zip: 942701 bytes,
  SHA256 `8e55e2761753d1773cbf52d86eb30900a977f7b281ccc920ffb80fbb5b5e56be`,
  SHA1 `d0adc4af348f0e255d60d59c8ba24b760d3cb729`. The formerly retained archive
  `scratch/runs/20261014-return-fire-recovery/RFIRE.zip` is absent locally.
  No download was performed here.

All addresses below are original preferred VAs (image base `0x400000`), not
allocated emulator addresses. Use `lib/pe.js` VA translation or `objdump -d -Mintel`
on the pinned original to recover the bounded disassembly saved in this run.

| Stage | Original call site / prerequisite | Current implementation |
| --- | --- | --- |
| Startup | `401358` and `402754` call `4240d0(hwnd)` | Native startup path, no title override |
| Timer / format allocation | `424118`: SetTimer(hwnd,1,100,NULL); zero result takes failure path. `424132` calls thunk `427d08`, IAT `47b468`: acmMetrics(NULL,50,&size); nonzero fails | `src/09a3-handlers-audio.wat`: `$acm_metrics` writes size50, returns0 for metric50 |
| Device | `4241ad` -> thunk `427d02`, IAT `47b33c`: DirectSoundCreate(NULL,&[463440],NULL) | `src/09a8-handlers-directx.wat`: `$handle_DirectSoundCreate` |
| Primary | `4241c7`: SetCooperativeLevel(hwnd,2); `4241fd`: CreateSoundBuffer, legacy descriptor size20, flags1, NULL format, result at `45fd50` | Existing cooperative-level and CreateSoundBuffer handlers, including legacy20 descriptors |
| Failure | Any initialization failure reaches `424208`: warning at `472390`, then releases device/primary/format and kills timer | Guest explicitly permits continuing with no sound; a visible game is insufficient proof |
| Load effects | `4209c0` immediately skips if device `463440` is NULL. Table starts `467bb8`, stride28, 37 entries. `420a29` calls `421660`, which calls `421420` RIFF/fmt reader and `4215b0` buffered data reader | WINMM mmioOpenA/Descend/Read/Ascend/Seek/GetInfo/Advance/SetInfo/Close in `09a3-handlers-audio.wat` |
| Populate | `420a94`: CreateSoundBuffer(size20,flags0xe0,data length,loaded format); `420acb`: Lock; guest copies PCM; `420b0b`: Unlock; `420b26`/`420b41`: volume/pan0 | Existing DirectSound buffer format, Lock/Unlock, gain/pan handlers |
| Request playback | `420840` returns early if byte `4633e0` is0 or device `463440` NULL. `4208bc`: DuplicateSoundBuffer; `420904`: secondary-buffer Play (vtable+0x30), reserved args0 and flags derived from caller | `$handle_IDirectSound_DuplicateSoundBuffer`, `$handle_IDirectSoundBuffer_Play` |
| Host | Play obtains voice and calls `host_voice_play_ring` with backing bytes, start offset and loop bit | `lib/guest-rpc.js` brokers initial Play to page; `lib/host-audio.js` voice_play_ring -> `_voices.playRing` -> PCM decode/BufferSource or eligible looping worklet -> voice gain/pan -> wave bus -> master -> destination |

Startup's separately allocated default format is PCM stereo22050Hz/16-bit
(bytes/sec88200, block align4). This is **not** the effect-file format.
The 37 original `RFIREDAT/SOUND/*.~AD` files are RIFF/WAVE PCM tag1, mono8-bit;
35 use11025Hz, JEEPSTAR uses5563Hz and RELOAD uses11127Hz. Each has a complete
data chunk containing bytes differing from unsigned PCM silence128. For example
HELI has data offset58, length17407, SHA256
`0ccfb24afbe30c796f83d38a99990f919f05c167a7fe579e09664f6860ac2859`.
No ADPCM decoder or missing effect assets are demonstrated. A string
`Music/RFireScore.aiff` exists but that asset is absent from the original inventory;
a string alone does not establish an executed open or explain silent effects.
MCI imports/call sites are separate from the demonstrated DirectSound effect path.

The small offline fixture reads originals in place, checks all payload hashes,
case-normalized VFS coverage, RIFF chunk bounds, effect formats/data, all37 table
references, and nine exact instruction pins. Its first run incorrectly assumed
all effects used11025Hz; that failed assertion is retained. The corrected fixture
validates each file's own byte rate/block alignment and preserves unusual rates.
It establishes the actual inputs/checkpoints for the missing observation, not
execution of guest calls. No permanent regression test is warranted without a
demonstrated implementation failure.

Validation: `node scratch/runs/20261105-return-fire-audio-cause/offline-fixture.cjs`
passes (58 payloads,37 effects,37 table entries,9 instruction pins).
`node test/test-audio-worklet-routing.js` passes36/36;
`node test/test-audio-mixer.js` passes its four groups. These are isolated mocked
host checks, with no shared module mutation. Existing DirectSound format,
volume/pan, replay, loop-refresh and mmio tests were inspected as relevant
coverage; WAT compilation suites were not run. No code edit/full build was needed
or attempted before the Stronghold final runtime/file RELEASE gate.

Next bounded observation, for a separately authorized runtime after lane release:

1. Preserve the unchanged original58-file manifest and pin the actual served
   source/module/Worker route. Use the accepted ordinary Play/H/W inputs with
   `defaultViewport:null`, indexed8 and default audio. Retain API entry **and
   return** values from startup through the first H effect, with a hard30-second
   audio observation window and normal cleanup. Do not redo launcher/paint fixes.
2. Record SetTimer result, acmMetrics50 output/result, DirectSoundCreate result
   and `463440`, primary creation, each effect open/load byte count and secondary
   creation/Lock/Unlock result. At the effect request record `4633e0`, device,
   DuplicateSoundBuffer/Play HRESULT, flags, format, byte length and PCM hash.
   Stop at the first failed boundary. No calls means inspect the guest gates;
   a failed open means inspect VFS requests before blaming host routing.
3. If Play succeeds with populated bytes, observe the page's matching
   `voice_play_ring`, source scheduling, AudioContext state/currentTime progression,
   wave/master gain and mute, and existing `_wineWaveAnalyser` /
   `_wineMasterAnalyser` signal. Trusted pointer/keyboard gestures drive
   `_voices._installUnlock`; a suspended context must be distinguished from
   missing requests. Gain-aware mixer peaks can reflect queued input PCM, so
   they alone do not establish destination delivery. Capture/listen only under
   separate authorization; even a running nonzero master analyser does not prove
   audible output, quality, looping correctness or synchronization.

Evidence stores Git SHA plus relevant binary diff/new-note patch and input
path/hash inventory, without source/media/module snapshots or archives. Runtime,
box ID/state/expiry: N/A. Coordinator retains lifecycle/shutdown ownership.
