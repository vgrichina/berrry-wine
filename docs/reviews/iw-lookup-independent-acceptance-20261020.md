# Independent FindWindow acceptance review — 2026-10-20

**Reject exact candidate aacd0b19d2ccb9edd804573c4edcde461a059032 for integration.**
The renderer is not an authoritative registry of live HWNDs, and registered
class names are not uniformly ANSI at record offset 44. Three compatibility
defects are detailed below. No production changes or main integration occurred.

Reviewed base: a54049d11955307d06309e146e85c1aca3196657.
Review branch: task/iw-lookup-independent-acceptance-oct20.
Owned files are this report and its adjacent JS helper only.

## Findings

### D1 — High: live WAT-only controls disappear from FindWindowEx

`src/09a-handlers1-user.wat:2636` returns the renderer's zero without consulting
the caller's live WND records. `lib/host-window.js:457` searches only
`renderer.windows`, requires a renderer record for a nonzero parent, and
requires the `after` handle to be in that same dictionary.

That dictionary is deliberately incomplete in production:

* `src/09c3a-dialog-runtime.wat:1411`, `$ctrl_create_child`, allocates an HWND,
  installs its WND record, parent, style, control identity and geometry, sends
  WM_CREATE, and optionally queues paint. It never publishes a renderer record.
  Its callers include the native Find/Replace control construction.
* `lib/host-window.js:722` explicitly handles dialog-template children without
  separate JS window records in `get_window_client_size`.
* `src/09c3a-dialog-runtime.wat:743` documents and handles a rendered property
  page whose parent is a WAT-only frame control. The new lookup rejects that
  parent before even considering its rendered children.

The independent helper compiles **the actual `$ctrl_create_child` together
with the actual FindWindow core/match/Z-order functions**, using controlled
WND-table, allocator, and callback imports. After allocating child 700 under a
published parent 100, `FindWindowExA(100, 0, NULL, NULL)` returns 700 on exact
main and zero on the candidate. This is not a manually invented dead row:
the production allocation function creates it and delivers WM_CREATE.

A separate case has live unpublished `after=401` preceding published child
402. The candidate returns zero; the same WND sequence through the local
fallback returns 402. Missing renderer metadata does not establish that an
HWND or its parent/after relationship is invalid.

### D2 — High: W-registered class atoms are decoded as ANSI

At `src/09a-handlers1-user.wat:2622`, atom resolution loads the class record's
offset 44 and forces class encoding to ANSI by setting `$encoding=$wide`
(only the title bit survives). That field is the original WNDCLASS
`lpszClassName`, not a canonical ANSI name.

`src/09a5c-handlers-wide.wat:124` and `:148` narrow the name **for hashing** but
pass the original WNDCLASSW data to `$class_table_register_data`.
`src/09c0-window-table.wat:1637` copies its 40 bytes into record+8 without
changing the pointer at record+44. It still points to UTF-16. Thus an ASCII
name such as L"WideClass" is read as "W" by the new host lookup.

The independent compiled-core fixture uses the exact retained pointer layout
established by that source: main finds HWND 200 by atom; candidate returns
zero for both A and W queries by that atom. W name-form lookup still finds
200, isolating atom resolution from the rest of the filter logic. Full
RegisterClassW execution is not claimed: the registration copy and adapter
are inspected source; the lookup that consumes the pointer is actual compiled
code. The original 173-check helper populated offset 44 with ANSI bytes even
for its W atom cases, so it could not detect this defect.

### D3 — High: atom-created windows have unusable renderer class metadata

`src/09a5-handlers-window.wat:46` sets `$class_wa=g2w(arg1)` unconditionally,
then `:263` sends that value to `host_set_window_class`. A MAKEINTATOM value is
not a guest string address. The guest WND class slot is separately resolved
through `$class_name_key`, so local FindWindow can identify the window even
when its renderer class string is empty/sentinel-derived.

`lib/host-window.js:425` simply decodes the supplied pointer;
`lib/renderer.js:3385` simply assigns that string. The candidate then resolves
the query atom to a real name and compares it against this bad renderer
metadata, returning an authoritative zero. Name-form class queries also miss
that window. CreateWindowExW preserves small atom inputs when delegating to
the same A implementation (`src/09a5c-handlers-wide.wat:85`).

The helper executes the actual host class setter with a controlled zero-filled
NULL sentinel, and the actual candidate core. Lookup of registered
"AtomCreated" returns zero after the creation-path metadata assignment.
Publishing the real name makes the same query return 300. This is a
source-backed creation-path consequence with an isolated host/core reproduction,
not a claim to have run the entire CreateWindowEx handler. The old renderer
metadata weakness becomes a FindWindow regression when the new host path
replaces the correct local class-slot lookup.

## Does disabling the renderer in test/test-find-window.js hide a regression?

**Yes, it hides the D1 compatibility boundary.** The old test injects WND rows
without publishing renderer windows. That is a synthetic setup, but production
also intentionally has live WND rows without renderer windows. Disconnecting
`hostCtx.renderer` forces the -1 branch, so the test can no longer detect the
new failure with an attached desktop. Our independently allocated production
child fails with the renderer attached and passes after precisely that
disconnection.

The edit can serve a separately named no-desktop fallback test. It cannot
justify accepting the changed production behavior or replace an attached
desktop test for native/dialog children and valid unpublished parents/after
handles. The original fixture also uses `class_table_register` without
WNDCLASS data; its atoms have no stored name, and therefore take local fallback
even on the candidate. Test counts alone obscure which path is being checked.

## Publication, destruction, ownership and remaining boundaries

Normal CreateWindowExA seeds the top-level WND record before
`host_create_window` (`:226-256`), then publishes class metadata and later the
actual child parent through `host_set_parent` (`:451-454`). The renderer's
initial guessed child parent is subsequently corrected; I do **not** report
that transient guess as a completed-creation defect. The browser host creates
records with the calling instance/memory and processId (`host.js:2495-2515`);
the common host follows the same pattern. `renderer.createDialog` publishes
the dialog frame, not every WAT child. It also does not assign `className`;
class-filtered dialog lookup needs additional qualification, beyond D1-D3.

For normal recursive destruction, `$wnd_destroy_recursive`
(`src/09c0-window-table.wat:503-552`) destroys children, sends WM_DESTROY and
WM_NCDESTROY while records are live, calls host destruction, then removes the
guest record. Creation abort (`src/09b-dispatch.wat:8-52`) similarly removes
host publication before the guest row after WM_NCDESTROY. The alternative
dialog tree cleanup removes WND records before per-child host cleanup
(`src/09c3a-dialog-runtime.wat:715-751`); callers remove the root renderer
record. These are distinct ordering windows, not one universal lifecycle.

The candidate's zero behavior does suppress an intentionally stale WND row
after host destruction; the independent helper confirms that. But neither the
original helper nor this source-only review proves guest reentry into every
such interval. Restoring unconditional zero-to-local fallback would revive the
previous stale-row risk and is **not** a sufficient correction for D1.
Lookup needs a complete ownership-aware registry or a reconciliation rule
that distinguishes live non-rendered windows from retired publication.

The host lookup returns an HWND scalar, reads query strings only from the
caller, and uses host strings for foreign records. It does not dereference
foreign guest pointers or modify ownership. Browser app ranges start at
`0x10001 + appIndex*0x10000` (`lib/browser-shell.js:3286`); worker ranges subdivide
the owning app range (`lib/thread-manager.js:864`). These support ordinary
dictionary identity, but exhaustion, reuse, worker publication, process-stop
cleanup and live IPC were not qualified. The unchanged host destroy routine
deletes the named row and direct rendered children; complete recursion is
owned by the WAT callers, not by that host method alone.

For complete rendered sibling groups, the class/title filters and descending
renderer Z order, strict after membership, no descendant recursion and
desktop-handle alias are internally consistent. They fail when publication
is incomplete as above. Renderer Z order versus WAT Z order under callbacks
and cross-instance updates remains a runtime gate. Unknown/unresolvable atoms
bypass host lookup and use local matching; “desktop is authoritative” is
therefore not even a uniform rule across query forms. Built-in 0x80–0x85 names
are explicitly mapped, but their creation metadata still needs D3 coverage.
Wide pointer filters decode UTF-16, while production wide creation narrows
names/titles; full Unicode/codepage equivalence is not established.

## Evidence and recovery

Run from a repository with the candidate and main Git objects:

```sh
node docs/reviews/iw-lookup-independent-acceptance-20261020.js . /absolute/path/tests.json
```

31 assertions/recorded outcomes pass, including five explicit rejected
acceptance oracles for D1-D3. This means **the defects were reproduced**, not
that the candidate passed acceptance. Seven small modules were instantiated;
the actual compiled core/child closure is 1129 bytes on main and 1270 on the
candidate. `tests.json` records hashes and exact source seals. No rerun of the
173-check helper was used for this conclusion; its report, helper, fresh
tests and receipt were read.

Evidence directory:
`scratch/runs/20261020-iw-lookup-independent-acceptance-oct20/`.
It contains setup/admission and shared-file seals, tests, publication receipt,
remote verification, and evidence hashes. The helper/report are the remote
recovery recipe; ignored run evidence is not represented as a Git backup.
An initial helper parser assumed a space after a WAT function name; it was
corrected to accept a newline before the successful run. No production source
was changed to make the reproductions pass.

Runtime403 remains binding. Full VM creation/registration/destruction,
reentrant guest callbacks, worker RPC, CLI IPC, current-build launcher/game
handoff and real Unicode remain unexecuted gates. No runtime, full build,
browser, benchmark, deployment, held diagnostic, worker launch or laptop
Heroes II/Warcraft III work was performed. Stop after publishing this review;
the coordinator owns any correction assignment.
