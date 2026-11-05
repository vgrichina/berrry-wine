# Site and SEO work: what is built, how it is generated, what is left
<!-- description: The public site of Wine-Assembly: how the app, article, design and story pages are generated, what was done to make them findable, and the open list. -->

The live site is https://wine-assembly.berrry.app. Everything below `index.html` (the desktop) is static HTML written by one script, so this page is both the map of that machinery and the running worklog. Pick it up from **Remaining** when continuing.

## How the pages are made

`node tools/gen-site-pages.js` writes every page (about 160) and `sitemap.xml`. The generated files are gitignored except `story.html`; `tools/deploy-berrry.js --update` regenerates and uploads them, so a deploy is the publish step and nothing needs committing besides the sources below.

| Output | Source | Notes |
|---|---|---|
| `apps/<id>.html`, `apps/index.html` | `lib/apps.js` desktop set, `tools/site-app-blurbs.json` (blurb per app, `_skip` list), `tools/site-app-faq.json` (`controls` per app, `_sound` per app) | Screenshot from `screenshots/apps/<id>.png`; OG card built into `screenshots/og/` by `tools/gen-og-images.js` |
| `articles/<slug>.html` | `articles/*.md`, order from `articles/README.md` | Description from the `<!-- description: ... -->` comment under the H1; mermaid fences become `<pre class="mermaid">` and the page loads mermaid only when it has one |
| `design/index.html` | `articles/README.md` body + the `docs/` and `docs/re-notes/` listings | The one hub in the nav; `/articles/` and `/docs/` still serve but declare it canonical |
| `docs/**/*.html` | `docs/**/*.md` | Listed automatically; this file is one of them |
| `story.html` | `docs/story.md` | Committed, unlike the rest |
| `sitemap.xml` | all of the above | `lastmod` from git history |

Rules the generator enforces, so new content follows them for free:

- **Descriptions** are at most 158 characters. Write the comment under the H1; the fallback cuts the first paragraph at a sentence end and is worse. `desc-lengths` style checks are one grep away: `grep -o 'name="description" content="[^"]*"' <page>`.
- **One nav**: Home, Apps, Design, The Story, GitHub. Do not add a page to it; link from the hub instead.
- **Diagrams** must be `TD`/`TB` flowcharts or sequence diagrams; a wide `LR` chain scales down to unreadable in the 710px column.
- **Screenshots** are cropped to the window by `tools/png-crop-desktop.js` inside `tools/screenshot-registry.sh` (`SHOT_CROP=0` opts out). An OG card is a 1200x630 teal card around the shot.
- **App pages** carry `SoftwareApplication` and `FAQPage` JSON-LD. The FAQ answers are built from facts (touch layout, exe format, localStorage persistence, the audio host) plus the per-app strings in `tools/site-app-faq.json`. Only write an answer that was measured; "not verified" is a valid answer.

## What was done (2026-09-04 to 2026-09-09)

- Meta tags, Open Graph, JSON-LD, sitemap, robots, canonical links on every page.
- README gallery and the story page.
- 12 articles, each with at least one mermaid diagram, plus three comparison articles (vs v86, vs Boxedwine, vs DOSBox and js-dos) written from this side with the other project's docs named as the reference.
- 35 per-app pages with window-focused screenshots, per-app OG cards, an About table, a How it runs section, RE-notes links, siblings under the same group, and a Questions section.
- Sound answers per app from a measured sweep (static imports + `--trace-api` on the audio APIs + a read of `lib/host-audio.js`). That sweep found and fixed two emulator gaps: `PlaySoundA` accepted file and memory sounds silently (now real, and a new `PlaySound` stops the previous one; `test/test-playsound-forms.js`), and Bricks shipped without its WAV files (recovered from the author's site through the Wayback Machine, see `test/binaries/SOURCES.md`).
- Nav collapsed to five entries; the Design hub replaced separate article and doc indexes.
- Hand-written descriptions on every article and hub page.
- The desktop's intro text moved from an off-screen header into a draggable Win98-styled Read Me window that opens on a first visit, with a desktop icon and a Start menu entry (`index.html`, `#readme-window`).
- Articles in README order with a dateline and a Previous/Next pager; a Start here list of five pages at the top of the hub.

## Game pages filled (2026-10-30)

The ten desktop games added after the September pass (StarCraft, Diablo, Quake II and III, both NFS demos, SimCity 2000, Moorhuhn, JezzBall) had live pages with the fallback blurb, no screenshot, the site-wide OG image and generic controls and sound answers. Each now has a blurb, a controls answer, a sound answer from a 30-second `--trace-api` run on the DirectSound/MCI/wave entry points (NFS II SE did not open a sound device in that window, and its page says so), and a screenshot. SimCity, NFS III and JezzBall were shot headless with the routes in their RE notes; the other six are crops of reviewed browser captures under `scratch/runs/` (Quake II gameplay takes about 300 s to load headless). Weak game blurbs (Heroes II, RCT, Blobby Volley, Reversi, Minesweeper) were rewritten for a player rather than for this repo.

Generator changes: a game's title and H1 read "Play X in your browser" (accessories and the `_not_games` list keep "X in your browser"); a description too long for the full "Runs in your browser on Wine-Assembly" tail gets a short "Plays in your browser, no install." instead of none; the saving answer names the registry's `persistFiles`.

Search Console, berrry.app domain property, three months to 2026-10-29 (export, not in the repo). Wine-Assembly rows only: the home page 234 clicks from 1,560 impressions at position 5.6; the v86 comparison 30 / 786; `apps/nfs2se_glide_demo.html` 13 / 225 at 6.5, the best app page while it was still a stub; `apps/quake2_demo.html` 3 / 162 at 8.8, a 1.9% click rate that the old title and description explain; `design/` 7 / 511. Queries: "windows 98 emulator" 20 / 261 at 8.7, "space cadet pinball online" 1 / 18 at 42.6, "winmine.exe" 4 / 32, "nfs 2 se browser" 1 / 4. Desktop impressions rank around 30, mobile around 11. Re-read after the deploy has been indexed for a few weeks.

## Compatibility list (2026-11-04)

`/compat/` and one `/compat/<slug>.html` per title (228), from `tools/site-compat.json`, aimed at "does X run in the browser" searches. Each page has the status per edition (one edition per RE note), the date of the evidence, what works and what does not, a Play button when the title is on the public desktop, a "bring your own copy" section that links `/?add-game` (opens My Media, whose Import button is the click a file picker needs), where to get the game, and the RE note links. `VideoGame` JSON-LD; in the sitemap; linked from the Apps hub.

How the data was made: one pass over every per-title RE note assigned a status with a strict rubric (playable only when gameplay was driven by input; when unsure, the lower status), and a second pass looked up stores and demo sources, fetching each listing live. Titles where only a moment of gameplay was driven were then moved to "Reaches gameplay" (`ingame`). Statuses: Plays, Plays with issues, Reaches gameplay, Reaches the menu, Starts only, Does not run yet.

Link policy, decided with the site owner: a store link whenever the game is sold today (the listing name says when it is a remaster, e.g. "Steam (Definitive Edition)"); the demo or shareware download when there is one; an archive.org item page only when no store sells the game, labelled a preservation copy, never a direct file link. The two are kept apart on purpose: under GS Media (CJEU 2016) a for-profit site is presumed to know a linked copy is unauthorised, and referral links make the site for-profit. Referral links: `_affiliate` maps a store name prefix to a template; a templated link gets `rel="sponsored"` and a disclosure line.

## Remaining

Ranked by search value per hour. The first two need a machine that is not running other sweeps; the rest are the site owner's.

1. **"What works" badges on `/apps/`**: sound, phone controls, saved state, one small badge each per card, from a repeatable sweep rather than a hand list. The sound sweep is the template. Feed the same facts into `featureList` on the app pages' JSON-LD.
2. **Short clips per app with `VideoObject` JSON-LD**: 3 to 5 seconds each, recorded headful (headless frame timing is not real), served beside the OG cards. Hold until the apps whose input paths are still rough would not record a still frame.
3. **Deploy and submit**: build green, `node tools/deploy-berrry.js --update`, then `/sitemap.xml` to Google Search Console and Bing Webmaster Tools, a Rich Results test on one `apps/` URL (expect `SoftwareApplication` and `FAQPage`), and a link-preview check on the same URL for the OG card.
4. **Outreach**: the comparison pages are the hook for Hacker News and the emulation subreddits. Wait for the deploy so the first visitors see the finished pages.
5. **A compatibility list page**: done 2026-11-04, see "Compatibility list" below. Open: affiliate templates in `_affiliate` once partner IDs exist; refresh statuses when an RE note moves a title.
6. **Thin `docs/` pages**: 456 of the 519 sitemap URLs are `docs/`, many of them dated investigation logs (`*-2026MMDD.md`). Keep one RE note per title in the sitemap and leave the dated logs out of it, so the site's weight sits on the app and article pages.
7. **Pinball**: "space cadet pinball online" ranks 42; `apps/pinball.html` (20 impressions at 31) is the page that should rank. Its title and H1 said only "Pinball" (the desktop label) and the blurb wrongly said Windows 98 and Maxis; the binary is the XP build (`test/binaries/SOURCES.md`). Fixed 2026-10-31 with a `_titles` override in `tools/site-app-blurbs.json` ("3D Pinball Space Cadet") and a new blurb. The screenshot is now the ball in play ("Hit Mission Targets To Select Mission"), shot headless with `--tick-ms-per-batch=5`, Space held over batches 9000-9250 and the capture at 9700 (the XP build is not ready for the plunger at 8200, where the Plus! 95 route in the RE note presses it). Still open: compare with the pages above it once the new title is indexed.

Pages for apps off the desktop: the generator only writes pages for `DESKTOP_APPS`, but the deploy uploads every `apps/*.html` on disk and the berrry API cannot delete. The four demoscene intros (`heaven7`, `cashcow`, `bakkslide7`, `ptct`, local candidates, not on the production desktop) have live pages from a September run, outside the sitemap and the apps index. They are left as they are on purpose: the intros are meant to come to the desktop later, and their blurbs and shot flags are kept for that. A stale `apps/*.html` in a checkout is uploaded again by a deploy, so delete one rather than leave it.

Skipped on purpose: crawlable launch links (the apps index already links every app page, each carrying the launch link), re-shooting the demoscene entries, Core Web Vitals work, cross-links into the toy VM mini-site.

## Verifying a change

- `node tools/gen-site-pages.js` and read the last line (page count).
- Description lengths: any page over 158 characters is a bug; check the pages you touched.
- Mermaid: open the page in a browser or run a puppeteer render and count `svg` elements against `pre.mermaid` blocks; a parse error renders an error box, not nothing.
- App pages: `grep -c FAQPage apps/<id>.html` should be 1; the Questions section should have six or seven `h3`s.
- The Read Me window: a first visit to `/` shows it, OK hides it and a reload keeps it hidden, `/?app=sol` never shows it, it drags by the title bar and stops at the desktop edge.
