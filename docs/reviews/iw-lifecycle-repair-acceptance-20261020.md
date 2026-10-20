# Independent lifecycle repair acceptance — 2026-10-20

Reject integration of ac72debe7522d4d57034627712b8ec000f8e1d92 over aacd0b19d2ccb9edd804573c4edcde461a059032: D1 remains incomplete. Accept the bounded D2 registration-encoding and D3 CreateWindowEx atom-publication repairs at the tested source boundaries. No production edits or main integration.

Read the complete submitted report, receipt and helper, and the full prior rejection at 89e876f11bccce852ec22af70c6c2229a0ce49c4. Main dee72253516f9565f1346dc4232b7576723ba0e2 is context only, not the tested source. The review branch is task/iw-lifecycle-repair-acceptance-oct20.

## D1: reject — foreign live windows remain hidden

The actual host reconciliation in lib/host-window.js enumerates only ctx.exports.wnd_lookup_slot. A different process sharing that renderer cannot find another owner's unpublished native child. This is a completed-creation failure, not a hypothetical callback race. The independent helper calls the real compiled ctrl_create_child in owner B under published parent 81. Owner B finds its Edit child 700; caller A sharing the same renderer returns zero for the same parent/built-in class filter. Query pointers stay in the caller's memory throughout.

Two further deterministic failures:

* A valid unpublished after=700 precedes published sibling 82. Owner B returns 82, caller A returns zero.
* Live unpublished parent 91 has published child 92. Owner B finds 92; caller A rejects the parent and returns zero.

The caller-local repair fixes the original single-owner child/parent/after cases, but does not fulfill desktop lookup across owners. Calling foreign unpublished registry coverage merely unqualified would understate these reproduced failures. Required behavior is ownership-aware enumeration of all relevant live windows and validation of parent/after membership, with a consistent desktop sibling ordering. Foreign query strings must be copied or compared safely, never passed as caller-memory pointers to foreign WAT. Publication must include native/dialog windows or an equivalent owner-aware registry must expose them.

## D1: stale owner publication is resurrected after real removal

lib/host-window.js livePublished treats !owner.wnd_lookup_retired(hwnd) as live. In src/09c0-window-table.wat, wnd_lookup_retired returns zero when wnd_table_find returns -1. It therefore cannot distinguish a legitimate renderer-only window from a former guest-backed window whose row has been removed.

The independent case wires a renderer publication to exports compiled from the actual WND allocation, removal, retirement and retired-query functions. Retirement suppresses that publication while the row exists. After actual wnd_table_remove(101), lookup returns 101 again from its retained OldPublication metadata. Reusing its slot for HWND 102 still returns 101. Allocating HWND 101 again without publishing new metadata still matches the old publication. These are three explicit rejected acceptance oracles; the fixture does not invent the removal behavior.

The source has a relevant ordering boundary: wnd_destroy_tree removes the WND row, and wnd_destroy_children calls host_destroy_window afterward (src/09c3a-dialog-runtime.wat). Normal wnd_destroy_recursive uses the opposite order. This review demonstrates the source-slice states, not an executed concurrent or guest-reentrant full destruction chain. The same-HWND reuse case is an adversarial lifetime boundary, not a claim about measured allocator wraparound frequency.

Required behavior is persistent owner/lifetime identity for guest-backed publications, invalidation on removal, and rejection of old-generation metadata after reuse. Legitimate renderer-only publications must remain supported. A per-slot byte that becomes unreachable after removal is insufficient to establish that identity. Unconditional fallback on host zero would also be insufficient.

## Accepted bounded repairs and ownership evidence

D2: actual RegisterClassW and RegisterClassExW adapters, class table copy/hash publication, and atom lookup pass. Independent repeated W/ExW-to-A-to-W replacements verify retained atom, encoding byte, original pointer at record+44, publication text and both A/W atom queries with title filters. Source inspection confirms the encoding write is inside the writer lock before the hash publication word. This is sequential correctness; concurrent replacement readers and Unicode/codepage fidelity are not qualified.

D3: the actual CreateWindowExA publication expression invokes class_publication_name; the replay covers A/W registrations and all six built-in atoms. Independent replacement cases also publish through that expression. This accepts the reported atom-to-pointer repair; it does not execute the entire CreateWindowEx handler. Dialog class publication remains a required separate compatibility boundary, already identified in the prior rejection.

Correct-owner memory checks pass: with equal numeric HWNDs in two distinct memories, host destruction retires the published foreign owner and preserves the caller's colliding live row. Direct rendered-child retirement also targets its foreign owner. Explicitly retired foreign publications are suppressed. Actual WND tests cover different-handle slot reuse, later original-handle reuse, adjacent-slot preservation, and stale retirement of an absent handle. These successes do not resolve the missing registry or publication-generation defects.

## Tests, identity and layout

Run:

    node docs/reviews/iw-lifecycle-repair-acceptance-20261020.js . /absolute/path/tests.json

The helper obtains the exact submitted helper from the candidate Git object, replays all 89 checks and five rejecting mutations unchanged, then adds 67 successful independent checks and six reproduced defect oracles (39 compiled slices total). The helper needs the candidate and parent objects; changed source is materialized from exact candidate, other source is read from the parent object. tests.json records every source SHA-256 and compiled module hash. The independent extension reuses the submitted compilation/fixture machinery, but supplies new cases and acceptance expectations. Its ordering table is modeled; actual WND allocation/removal and actual registration/publication/child source slices are explicitly distinguished.

The unchanged host relation suite, 290 import signatures, logical-AND gate, six fragment gates and actual generated-map freshness replay pass. Independent comparison preserves every preexisting generated region's full descriptor. Only CLASS_NAME_WIDE (64 bytes) and WND_LOOKUP_RETIRED (256 bytes) are added; source declarations are appended. The layout hash changes from eb58be38f5ebb837 to 466744875737f2d2, so future integration must pair compiled source with its matching generated map. Existing base/size compatibility does not authorize mixing old and new artifacts.

Key source SHA-256 identities:

* lib/host-window.js: 9b858c6d4d983a8ee14053c9fe421b60c76dbfb724f95c1dfe69d3a90fc5e65f
* src/09c0-window-table.wat: 2a234aa13c9ad290e33d37371ebd027927984c6c9db38e4af97d3b69e33b1e45
* src/09a-handlers1-user.wat: e033fecf609935e2889637bc8e52794445110d4cc9d517a184420f53043ed2b4

## Evidence and limits

Evidence: scratch/runs/20261020-iw-lifecycle-repair-acceptance-oct20/{setup.json,tests.json,validation.json,receipt.json,remote.txt,SHA256SUMS.json}. The committed JS/report are the recovery recipe; ignored evidence is retained locally, not claimed as remotely backed up. Initial execution exposed a review-side JSON parser assumption about the JavaScript region literal; corrected to evaluate the actual literal before the successful final run. No production source was changed to pass tests.

Fresh isolated exact-sparse patterns were installed before checkout; object alternates are read-only. Every write is gated with available >= 2277507072, conservatively retaining the entire 8 MiB allowance in remaining, stronger than reducing remaining as allocation grows. Allocation is checked against the 8 MiB cap, with a publication reserve. Shared HEAD/index/config and prior evidence seals are checked independently. Only this report and adjacent JS are committed.

No full VM, runtime/Boat/SSH runtime access, full build, browser, benchmark, public deployment, Claude, held diagnostics, worker launch, refill, game selection or protected laptop work. Runtime403 remains binding. Worker/RPC/IPC, concurrent/reentrant full lifecycle chains, complete Unicode and launcher/game behavior remain unqualified. D1's deterministic foreign lookup failures remain required repairs, not excused by those limits. Stop after publishing this bounded review.
