Public left/right modifier polling repair

Parent: 67b01162d74016f0f9f9915e1b07d7a81f942770 (accepted ancestor
9148ceb18768955f647130c2e936228429892477, not current main).
Independent rejection: 69c6043c7692dc14b11c12ac2f5a7165e85d5138.
Only lib/renderer-input.js, the new side-polling test and focused evidence/docs
are changed. The independent 29-group fixture and supplied 37-group fixture
remain byte-exact. Sourcepins identify them and the pinned legacy test.

Physical side VKs 160–165 now follow the existing actual side owners. Generic
numeric Shift/Ctrl/Alt owns no inferred side; numeric release clears all owners.
Physical reset clears side state with the same physical map. Async side state
is published on a new physical side press and captured with each modifier
message, so buffered releases advance at their message position. A released
left side does not clear a held right side, and the inverse holds as well.

Each side has its own pressed-since-query latch. Peek reads only the high bit;
GetAsyncKeyState consumes that side's low bit independently of aggregate and
opposite-side queries. An unqueried tap retains its low bit after release.
Repeats and dispatch of an already observed press do not recreate a side latch.
The existing aggregate/nonmodifier delivery-latch behavior remains unchanged,
as required by the unchanged supplied suite. Explicit async overrides remain
separate from physical ownership.

Small Node behavior tests only: 192 MiB old-space, timeout 25 seconds each.

| Unchanged test | Before | After |
| --- | --- | --- |
| Independent reproducer | 23 pass, 6 fail | 29 pass, 0 fail |
| Supplied aggregate suite | 37 pass, 0 fail | 37 pass, 0 fail |
| Pinned legacy keyboard-message suite | PASS | PASS |
| New public side polling controls | 1 pass, 27 fail | 28 pass, 0 fail |

The unchanged baseline additionally yields independent 2 pass/27 fail and
supplied 1 pass/36 fail. All 23 predecessor manifest payloads are verified and
retained, including original failures, early repair logs and incidents. The new
tests use installed public handleKeyDown/handleKeyUp/takeInput/polling methods,
plus explicit public device-reset and async-override controls. They never seed
private maps or owners. Both press orders and release orders, opposite-side
holds, repeat, low-bit consumption, peek, buffered release, numeric ownership,
location/code precedence, reset and nonmodifiers are covered. The unchanged
independent/supplied suites retain context, system/menu, focus/reset and message
bit checks. Focus coverage exercises the numeric release boundary, not a browser
blur listener. System/menu coverage is host-side messages/stubs, not guest menus.

One sparse setup attempt lacked two required modules and ran no assertions.
The exact pinned dependencies were recovered from the read-only donor with blob
verification; the original failed-load logs remain in evidence. No oracle was
changed to obtain a pass. Local Git identity was explicitly configured from the
root's existing Codex identity before publication.

Resource receipts count the isolated checkout/Git, evidence, launcher/session,
one conservative shared-WAL charge, 12 MiB future growth and 8 MiB reserve.
Installed Node and read-only donor object leaves are standing inputs. No full
checkout/history fetch, compile, wasm arena, runtime, guest, browser, service
restart, deploy or main merge occurred. Mount argv is empty, so mount parser
validation is inapplicable. Dedicated trusted SSH configuration is retained.
No box assigned; ID/state/expiry are N/A. Coordinator retains lifecycle ownership.

Remaining gate: independent acceptance of this repair, then separately owned
current-main reconciliation/integration and any separately authorized runtime
validation. These results make no gameplay claim.

See RECOVERY.md and evidence/checkpoint.json for exact recovery and test commands.
