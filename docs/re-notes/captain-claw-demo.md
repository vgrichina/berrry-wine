# Captain Claw Demo

## Original installer

The local fixture starts with the unchanged 11,275,313-byte `claw_demo.exe`
self-extractor linked from `sources.md`. Wine-Assembly runs its original
InstallShield extraction, Win16 bootstrap, and 32-bit setup engine. The app
manifest launches `clawdemo.exe`, `clawdemo.rez`, and `mss32.dll` copied by that
wizard to `C:\\GAMES\\CLAWDEMO`; it does not use a host-extracted substitute.

## Frozen gameplay route

`test/test-captain-claw-gameplay.js` checks the recorded SHA-256 hashes of all
three installer-produced runtime files, then launches the registered
`captain_claw_demo` app through one headless CLI process. Frozen stdio control
and the CLI's internal `--max-seconds=90` guard drive:

```text
main menu -> Single Player -> Demo Level #1: La Roca -> move right
```

The test captures the initial room, holds the real DirectInput right-arrow
state, and captures the scrolled scene. Its visual gate requires the 640x480
game surface, substantial rendered level content, treasure/HUD colors,
Claw/water colors, and more than 30,000 changed pixels after movement. Explicit
paths retain both screenshots:

```bash
CLAW_BEFORE_SCREENSHOT=/private/tmp/claw-before.png \
CLAW_SCREENSHOT=/private/tmp/claw-after.png \
  node test/test-captain-claw-gameplay.js
```

## Weapon consequence (2026-11-27)

Run `20261127-claw-combat-consequence-root` inspected the current La Roca
scene in one original registered-app CLI process (47.527 seconds, finite
`native-supervise.cjs`, exit 0, no leaked processes). After approaching the
blue floor object, DirectInput Alt (VK 18) held for 12 batches fired the
pistol: the visible ammunition HUD changed from **10 to 09**, remaining 09
after release and 30 further batches. Health stayed 60 during that attack.
This establishes an attack-caused ammunition consequence; enemy damage or
removal was not established. Rightward movement is prior accepted behavior.

The run retains inspected `target.png`, `weapon-shot.png`, `after-shot.png`,
an enlarged HUD comparison, exact input/reply logs, Git/diff identity, and the
exact tested module (`d4e95883e44848490831d279a8231cc51a36315bab60462e4fa28b3721fc3615`).
All three installer-produced media hashes matched the gameplay test pins.
No emulator change or guest-memory state modification was needed.
