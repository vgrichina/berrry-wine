# SimCity 2001 (VB6 p-code) — interpreter benchmark candidate

App id `simcity_2001_vb` (local-only). Files and provenance: `test/binaries/SOURCES.md`
("SimCity 2001, VB6 p-code"); archive.org item `sim2001`, anonymous 2000 freeware.

## Why it qualifies

`installed/simcity2001.exe` imports `ProcCallEngine`, `MethCallEngine`, `EVENT_SINK_*`,
`DllFunctionCall` and exactly one `__vba*` (`__vbaExceptHandler`) by name — the p-code shape.
Native-compiled VB exes import 100+ `__vba*` helpers and never `ProcCallEngine`. Seven other
VB5/6 games checked on archive.org were native code (Gridlock, Cowtris, Paku-Paku Pac-Man,
VBPong, Jouster 4, Tic Tac Doh, Space Harrier VGL, MarioNES, The Track); only Microsoft's
setup stubs (`SETUP1.EXE`) and this game were p-code.

## Load bases

- `simcity2001.exe` at its preferred `0x400000` (180 KB).
- `MSVBVM60.DLL` 6.00.8268, **the copy shipped in the CAB** (the app entry names it in
  `dlls`): loaded at `0x52e000`, origBase `0x66000000`, so `runtime = orig - 0x65ad2000`.
  Its `ENGINE` section (`0x66102000..0x6610f0b5`, runtime `0x630000..0x63d0b5`) is the p-code
  interpreter. The registry `test/binaries/dlls/msvbvm60.dll` is a different build with a
  different layout (ENGINE at `0x660fd000`); do not disassemble that one for these addresses.
- `oleaut32.dll` at `0x786000`.

## Dispatch shape: direct-threaded, replicated tail jump

There is no central loop. Every p-code handler ends with its own fetch-and-jump:

```asm
66104fbe  mov [ebp-0x14], esi
66104fc1  xor eax, eax
66104fc3  mov al, [esi+0x1]        ; next opcode byte
66104fc6  add esi, 0x2             ; esi = p-code IP
66104fc9  jmp [0x66106d14+eax*4]   ; primary 256-entry handler table
```

Runtime table base `0x634d14`. Lead bytes FB..FF select secondary tables the same way.
Handlers call into `.text` (`__vba*` helpers, variant/string ops) with ordinary calls, so the
benchmark exercises both a hot indirect `jmp` per opcode and call/ret pairs into the runtime.
Hot handler entries (runtime): `0x633cab` (push signed byte const), `0x632fbe`,
`0x6331c4`, `0x63319d`, `0x633609` (`movsx eax, word [esi]; mov ax,[eax+ebp]` — load local
I2), and a variant-type switch at `0x63497c` (`cmp eax,0x11; ja; jmp [0x66106a18+edx*4]`).

## Headless route (no input)

```
node test/run.js --app=simcity_2001_vb --quiet-api --quiet-blocks --max-seconds=60 \
  --max-batches=30000 --no-close
```

The main window (empty map, side panels) is up by batch 6000 (~4 s); the simulation timer
then advances the date and treasury every tick with no input (JAN 1900 at 6000, FEB 1901 at
15000). Over batches 20000..30000 (`--handler-hist --handler-hist-thread=0
--handler-hist-start=20000 --handler-hist-stop=30000 --hist-json`): **75.4% of block entries
in ENGINE**, 20.7% in the rest of msvbvm60, 0.6% in the exe, 0.8% oleaut32. `--count` on
`0x632fbe,0x633cab` gives 0.70M / 0.89M hits by batch 20000. The run reaches 20000 batches in
~13 s wall; `--cpu-window=10000:20000` measured 6.3 s user.

Open: the map picture box stays white (a GDI/picture gap, not investigated). The route does
not depend on it.

Evidence: `scratch/runs/20261124-interp-bench/simcity_2001_vb/`.
