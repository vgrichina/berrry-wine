# Independent acceptance of the empty-token repair — 2026-10-20

Accepted: only the four-line `$env_find` correction in **ea6f896e8099fc8072009fbf0014b52fa06bbedd**, directly over **e295f11287fde0ce2efa0d0da9491933481fc81f**. No production changes or main integration were made. This is a bounded follow-up to independent review **96360e91d971aca8940f8199b2623dee8ceb8858**, not a new broad ShellEx review or runtime qualification.

The guard preserves `$env_ensure`, then reads the first ANSI byte or full UTF-16 code unit through actual `$gl_char`. Empty names return no entry. Every nonempty lookup follows the unchanged comparison and entry-walk code, including case-insensitive hidden names `=C:`. `$env_name_len` already skips a hidden entry's initial equals sign. Thus both expansion passes keep `%%` literal instead of interpreting a hidden entry as its value. `$env_get` and CRT `getenv` inherit the correct miss, and empty deletion through `$env_set` no longer removes a hidden entry. Named get/set/replace/delete behavior remains covered. `_putenv` already rejects an empty parsed name. General invalid-name setter validation remains preexisting and outside this repair.

The acceptance helper obtains immutable source with `git show`; it redirects the submitted helper's one local source read to the exact repaired object. It replays actual WAT compilation and the original tests without editing their expectations. It additionally compares the complete eight-case options/actual/expected block byte-for-byte with the earlier independent review. All eight A/W × tracked/untracked × file/directory literal expectations pass repaired source and reject the exact parent with the original `D:\Drive` corruption. The production result does not rely on the separate diagnostic expansion guard.

Verification:

- Submitted repair helper: 177 named checks and 13 rejecting controls pass, including the eight exact-parent failures, three original mutations, parent shared-lookup rejection and overbroad hidden-name guard rejection.
- Nested original correction replay: 30 handler, 24 environment, 28 error, 52 allocation, 16 namespace rejection, 16 untracked-host and 12 queue cases, plus 13 controls pass. These are replay evidence, not newly claimed independent coverage. Its legacy `candidate` metadata names an older baseline; the wrapper pins actual tested inputs to the exact parent plus repaired helper, and records source hashes.
- Eleven additional narrow checks pass: empty blocks and hidden-entry ordering with whole-memory preservation, multiple hidden names and prefix nonmatches, unchanged UTF-16 U+0100 miss, and empty-name queries retaining lazy initialization in A/W. Two additional exact-parent controls reject empty queries when a hidden entry follows an ordinary entry.
- JS syntax and `git diff --check` pass. Compilation is in-memory source-slice compilation, not a full build.

Exact identities (SHA-256):

| Input/module | SHA-256 |
| --- | --- |
| Repaired `src/10-helpers.wat` | `7fa0c6e66a45c9fabe52dc6db0110fc4a726b4314d2d6b8fb8378db405877574` |
| Repaired ShellEx slice | `09d8a0e4b2e4a9e952cf9f77cf5dda8e72e9f393cefe5f14e471ec00bd8bf2d4` |
| Repaired shared environment/CRT slice | `8ea36419462c4aa6d9f3a4690cad8e781bb8ef8632a85ed4dae99c0d2912c437` |
| Parent ShellEx slice | `defbc847c76040f656772173511f8deef1c65c923f2c383fa557c19b47a7c1a9` |
| Parent shared environment/CRT slice | `32846b2c1ff004164f84948d6899b32ef3fabf82460b9f3c95da1712888cb8c4` |

Evidence and recovery: `scratch/runs/20261020-shell-env-repair-acceptance-oct20/{setup.json,tests.json,receipt.json,remote.txt,SHA256SUMS.json}`. From the isolated repository with candidate/parent/review objects available, run `node docs/reviews/shell-env-repair-acceptance-20261020.js OUTPUT_DIRECTORY`. The helper refuses writes below the conservative full-budget threshold 2277507072 bytes. This exceeds or equals `2210398208 + 33554432 + 25165824 + remaining` throughout the 8 MiB task budget. No cleanup retry occurred. Exact two-file sparse patterns preceded checkout; alternates were read-only. The receipt records original evidence seals, shared HEAD/index/config preservation, allocation and remote verification. Only this report/helper pair is committed atop the candidate on `task/shell-env-repair-acceptance-oct20`.

Remaining limits: `showCmd`/`hidden` transport does not implement guest STARTUPINFO/window startup state; CLI ignores nShow. Existing unsupported flags remain accepted without implementation. Memory translation, allocation and host UI boundaries use adapters; Unicode narrowing, invalid pointers/extreme overflow, full dispatch, Worker ordering, CLI child behavior and actual game/runtime behavior remain unqualified. Runtime403 restriction and laptop HeroesII/WarcraftIII ownership remain binding. No full build, runtime/Boat/browser, benchmark, public deploy, Claude, held diagnostics, worker launch or queue refill occurred. Acceptance here closes the empty-token defect only.
