# Age of Empires III trial

## Original media inventory (2026-10-10)

- Local source: `test/binaries/win98-games-a-d/Age-of-empire-3trial-Win98-SW.exe`
- Bytes: 383598224
- SHA-256: `4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad`
- PE32 x86 GUI executable; initial bootstrap contains InstallShield strings.
- No entry in the inspected public `DESKTOP_APPS` list or prior qualification in the task/re-note index. This is not a release or redistribution decision.

Original bytes are staged on temporary boat `bx_hx8msa33` with verified SHA-256. No installed game path has been established. No installer approval, gameplay, audio or FPS result is claimed.

Task: `NEW-GAME-AOE3-DEMO-20261010`; owner root Codex, one worker with serialized runtime resources.

Boat staging completed with matching SHA-256. 7-Zip recognizes PE sections and a383337416-byte `[0]` overlay, not a ready installed tree. Version resources identify Microsoft Game Studios, Age of Empires III Trial and an InstallShield11.0 setup launcher (2005-04-14). Next capture original bootstrap extraction/child launch without accepting installer dialogs.

## Bootstrap observation (2026-10-10)

Original bootstrap starts at `0x0041e77c`, creates the InstallShield Wizard, and reports OS checking, Windows Installer configuration, then extraction of `instmsia.exe` and `Age of Empires III Trial.msi`. At 04:03:58Z controller332371/guest332378 was still running; guard04:07:20Z. This is extraction progress, not proof of complete MSI or gameplay. Output remains `/home/user/aoe3-bootstrap-20261010` on the boat; inspect terminal cleanup and captured files before launching a child.
