# DX6/7 palette alpha and source-key contract — 2026-10-28

**D3D-ALPHA-KEY-PRECEDENCE-20261014 remains unresolved. No new final-pixel expected-case fixture is justified.** This bounded source investigation recovered versioned Microsoft SDK text, but no inspected passage explicitly defines simultaneous `DDPCAPS_ALPHA` palette use and `COLORKEYENABLE`. No renderer, tests, runtime, or main branch changed.

Base: `98d132898c963790f797ef3d00c812964e413cab`. Reused `TODOS.md` task at line 11042, both October 14 reports (`20261014-legacy-key-filter-contract` and `20261014-palette-alpha-render`), and `b41362285b9f4973da64c60945316c90571955ca:docs/re-notes/d3d-alpha-key-contract-20261020.md` through read-only donor objects. Their renderer characterization and native observation plan were not rerun.

## Source identity and limits

Sources below are **Microsoft-authored SDK text hosted by a third-party mirror**, not independent third-party technical interpretations. The [DX6 legal page](https://library.thedatadungeon.com/directx6/devdoc/live/directx/legal_7tbg.content.htm) identifies **DirectX 6.1 Programmer's Reference**, copyright 1997–1999, and warns that some development documentation may be inaccurate. The [DX7 legal page](https://library.thedatadungeon.com/directx7/devdoc/live/directx/legal_7tbg.content.htm) identifies **DirectX 7.0 Programmer's Reference**, copyright 1995–1999. Inspected DX7 reference pages carry a September 2, 1999 build footer. The mirror's 2024 HTTP modification dates describe hosting, not API publication. No original CHM/package signature or authenticated SDK distribution was recovered; these are attributable period-text copies with that provenance limitation.

All direct retrievals used certificate verification, identity content encoding, declared-length and streamed-body caps (2 MiB per response, 16 MiB aggregate). Access date: **2026-10-28 UTC**. Exact URL, access timestamp, response size, SHA-256, and failed requests are retained in the canonical receipt's `evidence/sources/fetches.jsonl`; raw HTML and derived text are retained separately. The source identity table below hashes the raw retrieved HTML, not search snippets or extracted text.

## Findings mapped to inspected passages

| Question | Inspected source and narrow result | Remaining limitation |
|---|---|---|
| What identifies a keyed indexed texel? | **Color Key Format**, [6.1](https://library.thedatadungeon.com/directx6/devdoc/live/directx/ddover_0chj.content.htm), [7.0](https://library.thedatadungeon.com/directx7/devdoc/live/directx/ddover_0chj.content.htm), opening paragraphs and 8-bit example: keys use the surface format; a palettized key denotes an index or index range; low=high denotes one color. Range support is hardware dependent; HEL lacks ranges. | Confirms membership representation, not whether keying acts on an alpha palette. Equal expanded RGB does not establish equal indices (inference). |
| What enables ordinary texture keying? | **Color Keying State**, [6.1](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imover_3e78.content.htm), [7.0](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3e78.content.htm), first two paragraphs: matching texels in textures created with `DDSD_CKSRCBLT` are not rendered; `COLORKEYENABLE` toggles keying and defaults FALSE. | Neither page names alpha palettes, specifies replacement alpha, or explains application alpha override/depth consequences. The parenthetical render-target wording is suspect; it is not used to relocate the source key. |
| What does palette alpha mean? | **DDCAPS / dwPalCaps / DDPCAPS_ALPHA**, [6.1](https://library.thedatadungeon.com/directx6/devdoc/live/directx/ddref_5gzb.content.htm), [7.0](https://library.thedatadungeon.com/directx7/devdoc/live/directx/ddref_5gzb.content.htm): `peFlags` supplies an 8-bit alpha value alongside RGB; such palettes attach only to texture surfaces. | Neither definition discusses key precedence. Alpha magnitude is not a definition of raw key membership (inference from this and Color Key Format). |
| What does the application control? | **D3DRENDERSTATETYPE**, [6.1](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_5fdw.content.htm), [7.0](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm), entries `ALPHATESTENABLE`, `ALPHAREF`, `ALPHAFUNC`, `ALPHABLENDENABLE`, `ZWRITEENABLE`: alpha testing defaults disabled, reference is low eight bits, comparison defaults ALWAYS; framebuffer blending has its own enable/factors; disabled depth writes preserve depth comparisons. | These generic controls do not specify the alpha delivered by a keyed alpha palette or an earlier independent rejection. No blanket below-128 discard follows from them. This is absence of support, not proof of every final draw outcome. |
| Are application alpha tests/blends unconditional device promises? | **Alpha States**, [6.1](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imover_8204.content.htm), alpha-testing subsection; **Alpha-Testing States**, [7.0](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_9yqs.content.htm), C++ section: application comparison/reference controls acceptance; inspect `dwAlphaCmpCaps`. **Alpha-Blending States**, [7.0](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3ctg.content.htm), opening/C++ section: blend enable and paired factors, with hardware-support caveats. | No palette/key interaction is stated. The alpha-test prose's comparison-to-existing-color explanation is imprecise; use the explicit reference/state description, not that explanation as an equation. |

The render-state reference's `COLORKEYENABLE` paragraph contradicts itself: it first limits effects to textures created with `DDSD_CKSRCBLT`, then says textures without that flag exhibit effects. The standalone Color Keying State pages explicitly say they do not. This inconsistency exists in both retrieved versions; it is not silently corrected or used to derive an alpha-palette exception. A separate check of source-key creation versus later `SetColorKey` would be needed before extending this wording beyond the controlled creation path.

**Inference boundary:** combining an alpha-palette definition with a generic statement that matching texels are omitted does not settle whether palette alpha makes the texture exempt from keying. The existing NVIDIA *Color Key in Direct3D* evidence distinguishes alpha-bearing textures, but never explicitly includes `DDPCAPS_ALPHA` palettes. That prior evidence is reused, not newly confirmed. Modern Microsoft capability pages, D3D9 advice, headers, Wine, and current renderer behavior supply no missing version-specific authority here.

## Required observation before an expected-case fixture

Reuse the October 20 native matrix, separately on original DX6 interfaces and Device7, on an authorized OS/runtime/driver/device supporting alpha palettes. Record identities, texture-format enumeration, palette flags/attachment, caps, HRESULTs, key creation and read-back states. Unsupported formats are not precedence observations.

Use point sampling at interior centers, one stage selecting texture RGB/alpha, no mixed taps/fog/specular/stencil. Set low=high=7 at creation. Indices 7 and 8 share RGB but independently sweep alpha 0, 1, 64, 127, 128, 255; add ordinary-palette controls and a nonkey whose RGB equals the raw key integer. Toggle keying. Compare alpha test disabled, ALWAYS, GREATER 0, GREATER 127, plus a later-stage alpha-255 override; blending disabled versus SRCALPHA/INVSRCALPHA over known color; passing depth with writes on/off. Record color and depth separately, using readback or an independently validated farther-geometry occlusion probe.

The exact unresolved outputs remain: does key 7 preserve, replace, or bypass palette alpha; do nonkey low-alpha fragments survive when the application would accept them; can an alpha override restore a keyed fragment; and does unchanged blended color still permit depth writes? State144/filter defaults remain outside this task. No native run is authorized or claimed.

## Negative search boundary and validation

Research stopped after this bounded SDK-page examination, not after exhausting the internet. General web searches covered `DDPCAPS_ALPHA` with color key/keying/`COLORKEYENABLE`, alpha palettes, and NVIDIA terminology. Targeted mirror title searches covered render-state types, alpha, palettes, textures, transparency, and color, then inspected the relevant pages above. Additional inspected DX6 pages on palette types and key setting add no precedence statement; compressed-texture alpha pages concern another format and were excluded. Search results involving Wine, wrappers, books, or later APIs were not promoted to normative evidence.

Preserved retrieval failures: DX6 Color Key title query closed its connection; DX7 Color title query failed; the obsolete DX6 alpha-state path under DX7 returned 404 (the actual DX7 alpha-testing/blending titles were then located); TDx Library's claimed verbatim DX7 reference failed TLS certificate verification. No trust weakening or unchanged denial retry occurred. No entire SDK/archive or tools were downloaded.

Validation checked every cited URL against retained bytes, versions/context against the legal pages and interface names, source hashes and locations, the one-path documentation delta, and `git diff --check`. This is documentary validation, not conformance testing. The canonical receipt records **no new decisive precedence evidence** and explicit remaining gates. Previous receipts remain unchanged.

## Retrieved source identities

| Retained raw HTML | Bytes | SHA-256 |
|---|---:|---|
| dx6-legal.html | 3840 | `599d20643dfecdcc4810a718e126c761611a2fda0528bc46737bf1c1a47a0f48` |
| dx7-legal.html | 3943 | `9648cd5fefd9348f6e5e54dab5b6f1026f4fccf4e28ef3603fa4b16b6a9d011b` |
| dx6-key-format.html | 2531 | `d1310de9c11199a51f336257d2595667553a21498ddc0a042965289fd2dd80ac` |
| dx7-key-format.html | 3454 | `35fbd2dfcb1eeee2fd7231016211e0667353e52303b9b287915edad03aa5f2a6` |
| dx6-keying-state.html | 1683 | `4ee818c3f5998c7cee49883d5bcd70748fc02eb4128755a51c57a10c9ec27d48` |
| dx7-keying-state.html | 3165 | `aecde726caa3027bbc66fed838a3d07d5e4008c65803d943f66e46b9b64efdbb` |
| dx6-ddcaps.html | 43826 | `84ff57ba8140990b2d15166a9816eaf95a94a2dcc6f1d91cb35fcd5bc0645242` |
| dx7-ddcaps.html | 40108 | `3aae3a84ddfbaa9016685736f8349bb1fd4719ddea0ea6b8faf300f324b89cbb` |
| dx6-renderstates.html | 40002 | `f6d1980273cf866bc599f8f5c39388ef633d7846ae32086284258f624dbc7e97` |
| dx7-renderstates.html | 40536 | `7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0` |
| dx6-alpha-states.html | 6566 | `faf117872d1f72701c5a8d4d5066d493e7aafb8d2cab3545e78ad36ce91f2275` |
| dx7-alpha-test.html | 6253 | `d5208a9eeaece67d234a097fb3934b59f2cf429491dfbb92e0f910775c9dca68` |
| dx7-alpha-blending.html | 7346 | `75a1ebab1de612e39a4d036ac2f5229cccfedbab96448a64b6fc56c3b345f7ae` |
