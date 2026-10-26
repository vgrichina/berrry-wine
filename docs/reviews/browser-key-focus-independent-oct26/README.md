# Independent browser focus-loss acceptance — REJECT

Candidate `2b5eaa0b0db6ef12882a38b6cd143291144d4150`, branch `task/browser-key-focus-release-repair-oct26`, parent `061461fb3e2bd088ccb6ec464ecbe958c83d46ca`.

The unchanged supplied fixture passes **19/19** at Node's 16 MiB old-space limit. Its supplied parent result **5 PASS / 14 FAIL** is reused byte-for-byte, with original fixture/setup and publication incidents retained. Independent challenges pass six groups, then stop on the first behavioral failure. Narrow repeat confirms the same failure on the exact candidate and parent. This is an **incompletely repaired existing focus-loss case**, not evidence of a newly introduced regression.

## Decisive failure

`lib/browser-input.js:1128` calls `renderer.handleKeyDown` before `deliveredKeys.set` at line 1130. Actual pinned production renderer code updates physical key state at `lib/renderer-input.js:3297`, queues the worker-owned down at line 3328, and invokes `_wakeMessageWait(true)` at line 3331. That production method synchronously invokes registered `_stepWakeHooks` (lines 1061–1064).

The challenge registers a one-shot wake hook that delivers hidden visibility through the fake DOM. The callback occurs after the renderer has recorded the key down, but before the bridge has recorded ownership. `releaseDeliveredKeys` snapshots an empty ownership map at browser-input lines 1101–1102. When the outer call returns the bridge adds the key even though cancellation already happened. The measured result is `document.hidden === true`, `peekKeyDownState(65) === 32768`, and a queue containing only WM_KEYDOWN (256), with no WM_KEYUP (257). The required released physical state is zero. See `independent-first.log`, `candidate-narrow.log`, and `parent-narrow.log`.

This is a controlled reentrancy challenge using the renderer's existing synchronous wake hook seam, **not** an assertion that current host wake callbacks routinely hide the document. It does not demand cancellation of a down that was never delivered: actual renderer code has already set physical state and queued the down before the callback. No guest or renderer algorithm was replaced by a handwritten state model in the decisive challenge. The worker-owned route is selected by the production `_guestWorkerWasms` membership check; a minimal exports token avoids guest execution. Region-map BASE placeholders are unused by this keyboard route. The actual renderer module is evaluated in a VM and its unmodified keyboard, physical-state, queue and wake methods execute. No production files were edited.

## Other challenges and scope

Passing independent groups cover capture-before-target routing; repeated down and exact-once hidden/blur cancellation; both modifier sides and original metadata; shifted/layout-changing keyup; real fakeDOM focus changes to page controls with target propagation stopped; unowned/stale ups; proxy focus/composition; swallowed Alt+Enter and subsequent normal Enter; and ordinary cancellation with the actual renderer queue. The small DOM helper is derived from the supplied pinned fixture, with focus blur setting activeElement to body before delivery. Nonbubbling element blur, capture key handling, and target-to-window key bubbling remain faithful for the exercised routes. Independent assertions are new; supplied assertions are unchanged. Each completed independent group atomically records hashes, result, remaining checks and evidence in `independent-checkpoint.json`.

The first failure is retained without weakening assertions. Only the failing group was subsequently run on candidate and parent. No wider audit or repair followed. No browser, runtime, game, canonical build, service, box, deployment or main integration was performed. Remaining gates are a separately authorized repair/review, merged-current-main regression checks, and real browser/runtime qualification. Runtime box ID/state/expiry are N/A; coordinator retains lifecycle ownership. No workers were launched.

## Reproduction

From this repository, run serially:

```sh
timeout 25s node --max-old-space-size=16 test/browser-key-focus-release-oct26.test.cjs
ONLY_GROUP='wake callback hiding' timeout 25s node --max-old-space-size=16 test/browser-key-focus-independent-oct26.test.cjs
```

The first exits zero; the second intentionally exits one with the retained leak. For the full six-passing/one-failing challenge sequence, omit ONLY_GROUP. Recover parent source using `git show 061461fb3e2bd088ccb6ec464ecbe958c83d46ca:lib/browser-input.js` into an isolated file and set `BROWSER_INPUT_SOURCE` to it for the same narrow challenge; never overwrite the pinned production file. `pins.json` binds all exact tested source and fixture bytes. `source-excerpts.json` binds bounded source excerpts. `evidence-manifest.json` covers every other committed review payload, including this report; manifest excludes only itself. Publication and exact review commit are recorded externally in `/tmp/browser-key-focus-independent-accept-oct26/ops/result.json` to avoid self-referential commit seals.
