# Redline ordinary keyboard route, 1150 — terminal at title splash

Training and Vehicle Training were not reached. The first post-Play capture was the title splash, not the required Start Up menu. This is a concrete screen-review blocker, not evidence that the game lacks keyboard menu support. No navigation key or Enter was sent to the original. SingleTaskSTOP; native REVOKED, allwriters UNKNOWN, edictABA UNKNOWN.

Evidence: `scratch/runs/20261109-redline-keyboard-training-1150/` (ignored). Read the 1140 repair note and 1120 native note before this task. No production change was justified or made; only fresh run inputs and this note were owned.

## Supported route from the retained original

`derive-route.py`, `keyboard-route.json`, and small disassembly extracts retain the derivation. Original `MAINDIR/Redline.exe`: 1,828,864 bytes, SHA-256 `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`. `Redline.bgd`: 71,788,765 bytes, SHA-256 `840dc1421e88708bb64de686e6a996e2638c27693b25ecdb54237824c64808aa`; media was referenced, not copied into evidence.

The actual executable supports arrows and Enter: key-map initializer `492340..4929ad` maps logical `5c` to DIK `c8` (Up), `61` to `d0` (Down), and `1c` to Enter. Poll `43e777` reads edge state through `439b26/49325a` and dispatches logical codes to `49d3b0`. Its current-focus virtual method at `+1c` reaches `499e06`, which follows Down link `+74` or Up link `+70`. Setter `499dd5` installs these links. Start Up builder `4a79ec` chains object fields `44 -> 4c -> 5c -> 6c -> 80 (Training) -> 74 (Quit)`. Initial pictured focus must still be reviewed: no fixed key count was assumed.

Training initializer `4a7477..4a7578` assigns the button at object `+80`, `2TRAIN_active` / `2TRAIN_select`, and callback `4a8336 -> 4a825a`. Enter forwards to the focused bitmap key handler `49b6dd`; update `49b5b1` invokes the registered callback. The BGD contains `2vtrain_select.btf`, `2ftrain_select.btf`, `carTraining.wld`, and `footTraining.wld`. These facts justify a pictured, one-key-at-a-time ordinary route; they do not prove original native consumption or a Training/gameplay consequence.

## Tests and native boundary

The actual generated caller and bound helper passed 18 offline controller cases, including Down/Up/Tab/Enter 100ms delivery with no mouse acquisition, keyDown/keyUp failures, independent UP, sticky first failure, and refusal of later input/capture. Existing mouse controls were retained. Actual invocation preflight, readiness/exit controls, final ready/successful SystemExit(0) guard, helper/menu-selection focused suites and `flock /tmp/wine-build.lock bash tools/build.sh` passed. Input, hold, CDP and caller caps were unchanged. Logs and generated-control results are in the run.

836 fresh runtime pins and 26 unchanged proof references were verified. Source base `2a298a95a899a7eef4a8057d89102e32d3a0b527`, zero production diff and a 73,780-byte small run-input patch are retained; no source archive or module copy was made. Exact predecessor Q21135 `bx_py2e33kc`, UUID `441ad5bf-1891-4ddd-97b4-074bb54bfb50`, was API-verified archived after unforced completed `stop_c13a36e5850d38ad` before allocation. An initial create preflight refused before watchdog arming, without any API allocation; the single actual allocation followed observable watchdog arming.

The whole actual native fixture passed before the original: comma/period held 600ms with physical high and release zero, capture ACKs 0/1, ordinary joined quit ACK2, 188 actual reaps, browser exit0 and separate untruncated stream EOF. `whole-native-gate.json` records the result. Recovering fixture evidence and independent physical-drain verification completed before original launch.

Personally reviewed fresh original launcher screenshot, then ordinary Play at the pictured button center `.14,.326`, held 150ms, wait5000; ACK0. Personally reviewed `review/play-result.png`, captured 11:34:06.481Z–11:34:06.797Z, SHA-256 `f04713b83592f316c76f650e4aa713530640b2a757bbbba2ef96906a438c04f3`: full Redline version0.90 single-player-demo title splash. There was no pictured Start Up selection to navigate. Recorded the mismatch as terminal and immediately invoked independent no-input cleanup. No later guest input, capture, retry, hover, forced lock, private cursor write or fallback menu occurred. The original supervisor subsequently reported failure from this deliberate termination; it was not replayed.

## Retrieval and shutdown

Original evidence: 127 artifact entries, 111 distinct SHA-256/size pairs, 32 gzip CRC checks, all verified before normal box stop; large logs compressed before transfer. Independent cleanup verified 173 actual reaps, complete custody, browser exit0/separate untruncated EOF, closed ports, absent profile, and no owned writers. Cleanup SIGTERM is retained as the first browser failure; the earlier screen mismatch is retained in `original-terminal.json`. No post-terminal guest reads were used to claim input-queue state.

Sole box `bx_fzwrmtpw`, UUID `eae7ddf2-5a31-42db-96bd-caf36c0b61f3`, created 11:31:05.737Z with initial expiry 11:55:54.750Z. Observable immutable 25-minute UUID watchdog was prearmed. After unique evidence retrieval and verification, delegated unforced normal stop `stop_551865d8322068bf` completed 11:34:41.869Z; final state archived, archiveAfter null, expiresAt not returned. `stop-complete.json` and `normal-stop-receipt.json.gz` retain the API receipts. Watchdog and lifecycle both actually waited exit0 with separate stdout/stderr EOF; runtime lock released. Free /home remained above 1.5GB.

Next work requires separate authorization: establish the title-to-Start-Up transition before attempting the reviewed keyboard route. This task does not infer unsupported keyboard navigation from a title splash and makes no Training/gameplay claim.
