# Slave Zero (demo)

Accolade/Ronin Entertainment, 1999, third-person mech shooter, Direct3D.
**Registered as `slave_zero_demo` (candidate `slave-zero-demo`, local
only).**

## Source and layout

- archive.org `SlaveZeroDemo`, `SlaveZeroDemo.zip` (sha1
  881fdbf2d7e239e7986be34f8fbc1e19199e1326). The readme says the demo "may
  not be copied, distributed, transferred or sold", so it is a local ignored
  fixture only.
- The zip is an InstallShield 5 Setup tree. File group `DEFAULT` of
  `data1.cab` is the whole game; the manifest unshields it into
  `installed/Slave Zero/` and copies `InstData/GameData/INSTSUPP/szHardware.ini`
  beside the exe (the installer writes it there; without it the renderer
  probe has no hardware table). No installer run needed.
- Run `SlaveZero.exe` with the working directory `C:\Slave Zero`
  (`exeGuestPath` `c:\slave zero\slavezero.exe`). It LoadLibrary's
  `d3d.dll`, `wgamescript.dll`, `winputkbm.dll`, `wdsound.dll` and
  `a3dapi.dll` from its own folder.

## Runtime requirements found

- **Real msvcrt.** The app declares `dlls: ['binaries/dlls/msvcrt.dll']`.
  With the built-in WAT CRT it stopped at `_putenv` (now implemented,
  51ef79adc) and then `_strdate`; the real DLL avoids that whole tail. The
  CLI finds `test/binaries/dlls` on its own, so the CLI never showed it.
- **~15000 live DirectDraw surfaces** in the demo level (tiny textures plus
  their mip levels). It exhausted the 8192 DX object slots and then the 63 MB
  DIB arena (whole 4K pages per surface). Fixed in c758a6742: `$DX_MAX`
  16384 and heap storage for plain textures and mip levels when the arena is
  full.
- **A3D.** `a3dapi.dll` CoCreateInstance's the A3D class whose server
  `a3d.dll` is not shipped. CoCreateInstance fails with REGDB_E_CLASSNOTREG
  and the game continues with DirectSound. In the browser the guest-main
  Worker's failure path left EIP on the CoCreateInstance thunk (it only set
  EAX and popped ESP), so the thunk re-ran on the caller's stack and the
  guest trapped `unreachable` at a heap EIP. The CLI had this fixed for
  Pirates!; both now share `DllLoader.failComDllYield`.
- **"AudBuffer error in lock"** (wdsound.dll): an intermittent modal box.
  The music stream thread locks a buffer that has already been released.
  Known, not yet root-caused.

## Headless route

`node test/run.js --app=slave_zero_demo --quiet-api --max-batches=2600
--batch-size=200000` reaches the front-end menu. In 640x480, NEW GAME is at
(320,153).
