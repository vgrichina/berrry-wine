# Jedi Knight: Dark Forces II original demo — source preflight

2026-10-15, owner `/root/new_game_refill_20261015`, proposed candidate
`jedi-knight-demo`. Source-only selection against main `729d3fc73675762407a5f45f425a70eb7186866b`.
No package downloaded, executable inspected, registration created or guest run.

## Selection and provenance

The [preserved official LucasArts demo page](https://www.jkdf2.net/JKBot/JKArchive/JKDF2/JKDF2/Websites/Official%20Jedi%20Knight%20Website/Star%20Wars%20Jedi%20Knight%20Dark%20Forces%20II%20-%20Demo_files/demo_download.htm)
names `jedidemo.exe`, approximately 20 MB, as a self-extracting Windows 95
demo requiring DirectX 5 and supporting 3D accelerator cards. It describes
one single-player mission and one multiplayer level. Single player begins
at a fuel station while pursuing 8t88. This is the original Windows demo;
OpenJKDF2, other replacement engines and remakes are outside this lane.

Proprietary LucasArts demo, proposed local-only compatibility fixture. The
publisher's historical public demo offer establishes the intended trial
package, **not** permission to redistribute. Bundled licence terms remain
unread. The official `readme.doc` link now redirects to the generic Star Wars
games page; do not count that redirect as a licence review. Inspect the
original package's readme/licence before running any installer. No EULA has
been presented or answered in this lane.

Acquisition lead: [PCGamingWiki demo entry](https://community.pcgamingwiki.com/files/file/1308-jedi-knight-dark-forces-ii-demo/).
Its page was indexed but direct retrieval returned HTTP 403 during this
preflight. Another candidate mirror is [Frag-Net's original-game file list](https://frag-net.com/game_jk.html),
which lists `jedidemo.exe`; its exact download target and bytes still need
verification. Mirrors are leads, not authenticated package identities.
Package size, SHA-256, executable identity and extraction layout are unknown.

## No existing claim or qualification found

Case-insensitive searches for `jedi.knight`, `jedi.outcast`, `dark.forces`,
`jkdemo` in current `lib/apps.js`, corpus manifest, `TODOS.md`, append-only
messageboard and re-notes returned no entry. All-ref commit-subject searches
for Jedi/JKDF/Dark Forces also returned none. Filename search of local
`test/binaries`, `scratch` and `packages` found no Jedi/JKDF fixture. This is
a bounded search result, not proof about unavailable archives or saved boxes.
The title is absent from current `DESKTOP_APPS`, and no recovery recipe or
reviewed gameplay evidence was found. Existing Interstate '76 was rejected
as a refill candidate because its later re-notes record qualified gameplay.

## Exact next actions

1. After coordinator acquisition grant, resolve an original demo mirror and
   acquire only `jedidemo.exe` on the designated temporary box. Record source
   URL, retrieval time, bytes and SHA-256. List/extract the self-extractor
   without running it; inspect readme/licence and full file inventory. Do not
   download retail data, a source port or enhancement patch. Report an actual
   licence prompt if encountered; no acceptance is assumed.
2. Identify the original game PE and its dependencies from extracted bytes.
   Preserve all original assets and record hashes. Determine whether the
   package supplies a ready-to-run tree or needs its original installer;
   neither `JK.EXE` nor a particular directory layout is yet verified.
   Add a pinned recovery recipe and local-only registry entry only after
   those facts are established and relevant corpus checks pass.
3. With the separately serialized runtime grant, use the normal original
   executable, its ordinary New Game/player creation route and single-player
   demo mission. Prefer its Direct3D option if available; record the actual
   backend. Do not substitute another engine or skip game code. Use a bounded
   first launch and capture any actual startup blocker before further work.
4. Review an in-world screenshot, then use ordinary configured movement and
   release it. Compare stationary landmarks before/after input and capture
   the resulting world state. Save source/module/fixture identities, command,
   input transcript, images and cleanup receipt under one unique run folder.
   Only reviewed visible movement completes core qualification; menu, intro,
   render activity or successful extraction does not. Audio/FPS/public release
   remain independent scopes.

No runtime resource is owned. Shared HEAD/index and existing fixtures were
untouched; local free disk was about 2.4 GiB before the sparse notes checkout,
with a 2 GiB floor. Acquisition is planned remotely to preserve that floor.
