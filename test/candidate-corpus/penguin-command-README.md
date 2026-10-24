# Penguin Command 1.6.11: original local fixture

Candidate `penguin-command-1611`, localhost selector/CLI app
`penguin_command_1611`. No acquisition packages or payloads are committed.
The executable, DLLs and media are copied unchanged. The launch uses
`C:\penguin-command.exe`, working directory `C:\`, and
`--windowed --nosound`; this preserves the explicitly silent historical scope.

`penguin-command-files.json` is the exact **91-file / 1,778,442-byte** `game/`
subset of the 287-file recovery manifest accepted on main
`3f75d7afdfc93819d4874b2cf126ca83e66d5bd2`. The seven authentic DLLs are
`msvcrt.dll`, `SDL.dll`, `zlib1.dll`, `libpng12-0.dll`, `jpeg.dll`,
`SDL_image.dll`, and `SDL_mixer.dll`. The executable is 107,008 bytes,
SHA-256 `14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`.
The inventory records its accepted manifest identity. Unrelated source files,
runner code, fonts, codec packages and runtime build artifacts are excluded.

Prepare from the retained original directory and the standing authentic CRT:

```sh
node --max-old-space-size=256 tools/verify-penguin-command.js --prepare \
  /home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11 \
  /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll \
  /absolute/repo/test/binaries/candidates/penguin-command-1611
node --max-old-space-size=256 tools/verify-penguin-command.js \
  /absolute/repo/test/binaries/candidates/penguin-command-1611
```

The destination must not exist. All source identities are checked before
creating it. Preparation writes only `game/` and its exact schema-1 companion
manifest. An existing fixture, wrong source, missing file, changed identity,
extra game file or altered mapping is rejected. The source tree is never edited.

The production registry declares `localManifestIntegrity: {inventory, sha256}`,
pinning this inventory for the shared ordinary-loader adapter. Its schema-1
inventory rows have `{path, bytes, sha256, source}`; `source` is preparer metadata.
The companion manifest has exactly `{schemaVersion: 1, files: [...]}`, with
90 `{url, vfsPath, size}` rows and no executable row. URLs are `game/<path>`;
guest paths are `c:\<path>`. Hash pins include the executable as well as every
companion. A new inventory requires updating the trusted registry digest.

**Dependency:** main `3f75d7af` does not enforce this contract. Ordinary
`--app=penguin_command_1611` CLI and browser loading require the concurrently
owned Airstrike manifest-boundary adapter and independent review. The generic
corpus CLI's `buildLaunchArgs` uses explicit EXE/DLL/VFS inputs. The adapter
owner confirmed that a canonical registered `--exe` path inherits its matched
app policy; arbitrary external fixture paths have no generic corpus identity
hook. Main `3f75d7af` alone enforces neither route. Verify the fixture immediately
before launch while the adapter is pending. This task does
not claim ordinary CLI/browser acceptance from a standalone verifier or direct
shared-adapter API test. Do not publish or deploy the local payload.

Filesystem regression, without a guest or build:

```sh
node --max-old-space-size=256 test/test-penguin-command-local-registration.js ORIGINAL CRT
```

An optional third argument names an explicit shared `lib/app-files.js` adapter
for compatibility testing. That mode tests its synchronous API against genuine
bytes, exact mappings and rejection controls, and prints its SHA-256. It does
not test host wiring. Existing Silver and local-dropdown tests are unchanged.

Historical accepted evidence reached Normal Game, score 160 then 240/Wave 2,
and Hiscores/menu with the retained historical module/runner. Individual shot
causality, sustained play, audio and current-main runtime remain unqualified.
