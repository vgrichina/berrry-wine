# Kobo Deluxe 0.5.1 (Win32 binary release)

(Recovered from branch `task/kobo-deluxe-original-win32-closure-oct24`, Oct 2026.)

Status: **not acquired; no fixture, no registry entry, never run.** Not in
`lib/apps.js`.

## Source and acquisition blocker

- Upstream page: <https://olofson.net/kobodl/>; intended original release
  <https://olofson.net/kobodl/download/KoboDeluxe-0.5.1-Win32-bin.zip>.
- 2026-10-24: the first request, `HEAD https://olofson.net/kobodl/`, returned
  **HTTP 403 Forbidden**; the ZIP itself was never requested, so it is not known
  whether the archive URL is also denied (or whether an intermediary produced
  the 403). One attempt, no retry.
- Consequently there is no archive SHA-256, inventory, licence check, PE/import
  analysis, DLL closure or launch recipe yet. Kobo Deluxe is an SDL game, so
  expect bundled SDL DLLs (as with Penguin Command / Airstrike) once acquired.
- The branch's `tools/kobo-deluxe-acquire.py` helper (HEAD, size guard, bounded
  streaming GET, optional `--sha256` pin) was not merged to main.

Next step: obtain the original ZIP through a working route (alternate
authentic mirror or retained bytes), pin its digest, then inventory imports
before any launch.
