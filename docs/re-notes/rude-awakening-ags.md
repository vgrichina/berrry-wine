# Rude Awakening (AGS 2.70) — interpreter benchmark candidate (script VM is cold)

App id `rude_awakening_ags` (local-only). Provenance: `test/binaries/SOURCES.md`
("Rude Awakening, AGS 2.70"); archive.org item `rude-awakening` (collection
`adventuregamestudio`).

## Load bases

`RudeAwakening.exe` is UPX-packed (`UPX0/UPX1`, entry `0x6bc200`) and unpacks in place at
`0x400000`. For disassembly, `upx -d` it to a scratch copy (the evidence folder keeps
`RudeAwakening.unpacked.exe`); the unpacked VAs equal the runtime VAs. Engine version string
`2.70.864`, DirectDraw + DirectSound, `gamecolordepth=16`.

## Script VM dispatch (`cc_run_code`)

Located through `"invalid instruction %d found in code stream"` (`0x515ac0`, pushed at
`0x45dfe3` in the default case):

```asm
0045d3ff  mov ecx,[esp+0x2c]; mov eax,[ebx+0x1f88]       ; pc
0045d40b  mov edx,[ecx+0xc]; mov eax,[edx+eax*4]
0045d411  and eax,0xffffff                               ; opcode
0045d41a  call 0x45b300                                  ; per-op debug/abort check
...       ; decode arg1/arg2 register pointers
0045d497  dec edx
0045d498  cmp edx,0x3e ; ja 0x45dfdd                      ; 63 opcodes
0045d4a1  jmp [0x45e018+edx*4]                            ; MSVC switch jump table
0045df16  ...pc += oplen[op]+1 (word table 0x5157bc) ; jmp 0x45d3ff
```

Shape: one central loop, MSVC `switch` jump table, every case rejoins at `0x45df16`; external
calls (`SCMD_CALLEXT`) go through `call eax` at `0x45d4c3` and the arg-count stubs
`call [esp+N]` at `0x45d235..0x45d371`.

## Headless route

```
node test/run.js --app=rude_awakening_ags --quiet-api --quiet-blocks --max-seconds=80 \
  --max-batches=30000 --no-close
```

Black until ~batch 16000, the bedroom (first room, Charles asleep) by batch 22000 (~60 s),
no input needed.

## Finding: render-bound, not interpreter-bound

`--count=0x45d3ff,0x45df16,0x403ab0,0x4c9a50` to batch 27618: the VM loop head ran **3**
times; the per-pixel blender loop ran 6.4M times. Block histogram over 20000..26000: 99% of
block entries in

```asm
00403aa0  mov ax,[edi]; cmp eax,[ecx+4]; jz skip  ; mask colour
00403ab0  push [0x69d05c]; push src; push dst
00403abe  call [ebp-0xc]                           ; Allegro 16-bit blender callback
004c9a50  ...blender body (0x4c9a50..0x4c9a5d)
```

— an indirect call per pixel, so this app does exercise `--uop-icall`, but through a
blitter, not the script VM. Two more AGS games gave the same picture: Pennis (2005, AGS
2.70.861, archive.org `pennis-the-ultimate-in-pong`; VM head `0x45d31f`, 60 hits in 32000
batches on the menu, click did not register) and Mittens Shooter (2003, AGS 2.5x,
`ags-mittens-shooter`; top blocks are Allegro line readers `call [edx+0x20]/[edx+0x24]` at
`0x497718` and the same blender shape at `0x402dc7`). AGS 2.x runs scripts only on events
and once per frame, and one emulated 16-bit frame costs ~77k blender calls.

Evidence: `scratch/runs/20261124-interp-bench/rude_awakening_ags/`.
