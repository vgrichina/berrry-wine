# Browser keyboard focus loss — 2026-10-26

Pinned parent: `061461fb3e2bd088ccb6ec464ecbe958c83d46ca`.
Branch: `task/browser-key-focus-release-repair-oct26`.

The bridge delivered keydown but only cancelled mouse ownership on window blur/hidden. A guest key stayed held without a later DOM keyup. The focused unchanged reproducer fails 14 of 19 groups on that parent and passes all 19 with this change. Earlier 16-group checkpoints and the initial fakeDOM setup error are retained separately.

The bridge now records only forwarded downs, using physical code or code-less VK/location identity, and keeps the first down metadata. Duplicate/repeat downs still reach the renderer. Noncapturing window blur and hidden visibility cancel each owned key once. Ordinary proxy/canvas element blur does not cancel keyboard ownership. Normal keyup retires an owned down even if focus moved to a page input; unowned/stale ups are ignored. Swallowed Alt+Enter never gains Enter ownership. Composition callbacks, soft keyboard balanced pairs, character delivery and mouse ownership are unchanged.

Validation uses the actual bridge in fresh VM contexts with a small DOM implementing capture, nonbubbling blur, bubbling key events, listener removal and focus transitions. The recording renderer tracks held physical keys and ordered calls; it does not run the guest or model renderer queue dispatch. Groups cover modifiers/chords, both sides, metadata drift, duplicate/repeat downs, code-less location identity, repeated cancellation, stale ups, ignored controls/agent keys, browser-reserved forwarded keys, toolbar refocus, proxy focus, Alt+Enter, composition commits/deduplication, soft input and mouse capture.

Run from the task repository:

```sh
timeout 25s node --max-old-space-size=16 test/browser-key-focus-release-oct26.test.cjs
```

Recover the exact failing source (the donor and root remain readonly):

```sh
git show 061461fb3e2bd088ccb6ec464ecbe958c83d46ca:lib/browser-input.js > /tmp/browser-input.focus-baseline.js
BROWSER_INPUT_SOURCE=/tmp/browser-input.focus-baseline.js timeout 25s node --max-old-space-size=16 test/browser-key-focus-release-oct26.test.cjs
```

Expected baseline exit 1, repair exit 0. `pins.json`, `checkpoint.json` and the evidence manifest bind exact source/fixture/log hashes. Recovery working files and publication receipts are in `/tmp/browser-key-focus-release-repair-oct26/ops`; readonly alternates are standing inputs, not remote backups. No renderer edits, canonical compile, browser, service, guest, game, box or public deploy was used. Independent review, current-main integration and real browser/runtime qualification remain coordinator gates.
