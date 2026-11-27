# Civilization III public trials: source and identity

Investigated 2026-11-27 on input main
`36c1e6c12267e0cbd55b78dc543f780bffd29fff` plus shared WIP.
Evidence: `scratch/runs/20261127-civilization3-demo-root/` (ignored).

## Selected candidate

Use the publicly offered **Civilization III Game of the Year Edition,
English, 60-minute trial** as the obtainable candidate. This is a timed
commercial trial, not a full retail giveaway. The current
[Gamepressure demo page](https://www.gamepressure.com/download/sid-meiers-civilization-iii-game-of-the-year-edition-demo/zfaf8)
identifies it as a legal demo, lists 379.7 MB and a May 14, 2003 update.
The page's download workflow actually returned a working file GET during
this investigation. A complete publisher-to-mirror cryptographic chain has
**not** been established; exact installed edition/build remains unverified.

| Candidate | Identity | Availability checked here |
| --- | --- | --- |
| GOTY 60-minute trial | `Civ3-GameoftheYear.exe`, HTTP Content-Length **398157168 bytes** (379.712 MiB) | GET 200; first 262144 bytes retained, then stream cancelled |
| Gold Edition three-hour trial | `civ3goldsetup.exe`, ModDB lists **727102713 bytes** (693.42 MiB), MD5 `62a4a6cbfa6001695c2d7e1b27d94b0f` | Listing verified; download endpoints returned 403; no installer bytes retained |

Gold's MD5 is source-listed metadata, not a locally computed hash. No
complete installer was acquired, hashed, installed or launched by this worker.
The coordinator separately acquired the complete installer into volatile
tmpfs. Its receipt `scratch/runs/20261127-civilization-acquisition-root/civilization3-acquisition.json`
records 398157168 bytes, completed 07:46:48 UTC, measured SHA-1
`f9dfca4e525df25ce0667588da6fb51246fb3ba1` and SHA-256
`d0207027cf0ace1818d299db8c2b65f3a57067867cbe756d4dc6fa6d3aa96aad`.
These are coordinator-measured recovery pins, not publisher signatures or
hashes computed by this worker. Its tmpfs file is not a persistent fixture.

## Publisher provenance and edition ambiguity

[Infogrames' GOTY announcement reported September 6, 2002](https://www.gamespot.com/articles/civilization-iii-game-of-the-year-edition-announced/1100-2879633/)
describes a retail base-game revision at 1.29f with bonus material, shipping
alongside the separate Play the World expansion. This establishes the
historical edition, not the exact version of the current mirror's trial.

[Atari/Firaxis' Gold announcement, reproduced September 17, 2003](https://worthplaying.com/article/2003/9/17/news/12517-sid-meiers-civilization-iii-gold-edition-announced/)
describes base Civilization III plus Play the World, planned for October 28.
[Contemporary November 6, 2003 reporting](https://www.gamedeveloper.com/game-platforms/gamespy-and-ign-sign-up-for-digital-distribution)
explicitly identifies Civilization III Gold as IGN's first Trymedia download,
with a three-hour evaluation before purchase. This supports an authorized
historical trial release, distinct from unauthorized retail redistribution.
Neither report authenticates the bytes of a surviving mirror.

The [ModDB Gold trial listing](https://www.moddb.com/games/civilization-iii/downloads/civilization-iii-gold-edition-trial-version)
was uploaded by a community account in 2016; its date is not the original
publisher release date. [GameFront's Civilization III directory](https://www.gamefront.com/games/civilization-3)
also lists a Gold trial of 693.42 MB under Official Demos. Its listing date
must likewise not be treated as a publisher announcement.

The GOTY prefix contains an Infogrames Interactive EULA dated September 13,
2002, with explicit Play the World language. This supports publisher-origin
installer material but also cautions against deriving exact contents from
the host's GOTY label. A shared EULA alone proves neither that PTW is present
nor that the label is wrong. Do not record a verified game version of 1.29f,
PTW 1.27f, Gold or Complete until the actual installed payload is inspected.

An [Archive.org item named Civ3GoldSetup](https://archive.org/metadata/Civ3GoldSetup)
advertises **728105511 bytes**, MD5 `b75b67ac22fe6318f73c6dfd276bb92b`,
and an additional `C3GE.zip`. It is a different identity from ModDB's trial;
the extra archive's purpose and installer authenticity are unverified.
Do not substitute it or transfer hashes between packages. No retail images,
cracks, trial bypasses or activation workarounds are needed for this task.

## Direct source and HTTP behavior

Resolved URL at 2026-11-27 07:44 UTC:

```text
https://metrocf.gameplay.pl/c/Civ3-GameoftheYear.exe?st=8558ab631583e2c29671f7b5d669e30dd531ad2f6108e51ad571f1c57221c748
```

Treat the `st` query as a generated token; refresh through the page when it
expires. HEAD returned 403 even when GET worked. GET ignored `Range` and
returned 200, `application/x-msdownload`, Content-Length 398157168 and ETag
`"dabb3b6ea35e4fe2aa3ce6bdfeade808-76"`. That ETag is not a verified MD5.
Use an enforced stream/file bound; a Range header alone does not bound traffic.
The prefix probe cancelled after retaining exactly 262144 bytes. A preceding
curl request with `--max-filesize 65536` refused the large response (exit 63,
zero payload retained). Receipts: `prefix-receipt.json`, `http-probes.json`.

Gold endpoints `https://www.moddb.com/downloads/start/111618` and
`https://www.moddb.com/downloads/mirror/111618/1` returned Cloudflare 403.
Historic Trymedia locators `fe.trymedia.com/dm/infogrames/3h_d_v127f/trygames/Civ3GoldSetup.exe`
and `fe.trymedia.com/dd/infogrames/60ma_d_v129f/trygames/Civ3.exe` no longer
resolved in this environment. They are historical leads, not usable sources
or proof of the currently hosted bytes' version.

## Reproducible acquisition after capacity is available

Do not run a bulk acquisition on this worker's nearly full `/home`.
Choose an authorized destination with room for the 398157168-byte installer,
extracted data and installer temporary files. The following JavaScript recipe
uses curl for the same observed cookie/countdown workflow; it has not been
run here as a full download. Save it outside the tracked source tree, then
run `node acquire-civ3.cjs /authorized/path/Civ3-GameoftheYear.exe`.
It refuses to replace an existing file. The size check detects truncation
but does not replace publisher authentication.

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {createReadStream} = require('node:fs');
const page = 'https://www.gamepressure.com/download/' +
  'sid-meiers-civilization-iii-game-of-the-year-edition-demo/zfaf8';
const out = process.argv[2];
if (!out || fs.existsSync(out)) throw Error('Supply a new destination');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'civ3-source-'));
const jar = path.join(tmp, 'cookies');
function curl(args) {
  const r = spawnSync('curl', ['--fail', '--silent', '--show-error',
    '--location', '--max-time', '1800', ...args], {encoding:'utf8',
    maxBuffer:2*1024*1024});
  if (r.status !== 0) throw Error(r.stderr || `curl exit ${r.status}`);
  return r.stdout;
}
(async () => {
  try {
    curl(['-c', jar, '-b', jar, '--max-filesize', '1048576', '--data',
      'FORM_TYPE=POBIERZ_ZA_DARMO&IS_MOBILE=0', page]);
    await new Promise(resolve => setTimeout(resolve, 11000));
    const html = curl(['-c', jar, '-b', jar, '--max-filesize', '1048576',
      '--data', 'FORM_TYPE=POBIERZ_TERAZ&IS_MOBILE=0', page]);
    const url = html.match(/downloadFile\('(https:[^']+)'\)/)?.[1];
    if (!url || new URL(url).hostname !== 'metrocf.gameplay.pl')
      throw Error('Source changed; review page before downloading');
    curl(['--max-filesize', '398157168', '--output', out, url]);
    if (fs.statSync(out).size !== 398157168) throw Error('Size mismatch');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(out)) hash.update(chunk);
    const sha256 = hash.digest('hex');
    if (sha256 !== 'd0207027cf0ace1818d299db8c2b65f3a57067867cbe756d4dc6fa6d3aa96aad')
      throw Error('Identity differs from coordinator receipt; review source');
    console.log(JSON.stringify({url, bytes:398157168, sha256}, null, 2));
  } finally { fs.rmSync(tmp, {recursive:true, force:true}); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
```

On failure, retain the diagnostic and inspect/remove a partial output before
retrying. Preserve the final URL, headers, byte count and computed SHA-256.

## Format, expected executable and runtime requirements

The observed **installer** executable is `Civ3-GameoftheYear.exe`: PE32 GUI,
Intel 80386, image base 0x400000, entry RVA 0x21af. Its description is
`Civilization III Installation`. Resource version placeholders do not identify
the game build; the stub's 2001 timestamp is not a release/version measurement.
Strings identify the Wise Installation Wizard, `WISE0001.DLL`, `W32INST.DLL`,
`PROGRESS.DLL` and `UNWISE32.EXE`. This is a Windows self-extracting installer,
not a ready-to-run game executable or plain ZIP distribution.

`7z l goty-prefix.bin` recognizes an embedded ZIP stream at offset 15025
and reports unexpected EOF, as expected for an intentional prefix. Complete
early entries include the EULA and small Wise DAT records; extracting those
does not establish that all game data can be reconstructed with 7-Zip.
Use full-installer `7z l`/`7z t` and a Wise-aware extractor first; retain the
original tree and trial wrapper. Complete raw recovery has since succeeded by
the independent method below; measured Windows installation behavior still
requires an owner-provided real Windows VM reference run.

The coordinator's full `civ3-installer-list.txt` confirms **`CIVILIZATION3.EXE`,
1787905 bytes**, and `README.TXT`, 61793 bytes. Its full archive has 3480
records and 534931311 uncompressed bytes. Duplicate/flat names mean naive
unpacking can lose the installer's directory mapping. The expected game
basename is therefore observed, but its final installed path is unverified.
Do not launch the installer as if it were the game or flatten all assets.

The full-installer `7z t` exited **2**, reporting data after the payload for
**22 embedded entries**, including `TILEINFO.PCX`, `SWON-AGES2-UP.PCX`,
`PALACE01.PCX` and audio files. The coordinator retained the result in
`archive-validation.json`. This may reflect Wise ZIP interpretation limits;
the measured installer hash and successful selected-EXE extraction do not
establish full archive integrity or a usable installation.

Subsequent nonexecuting analysis in
`scratch/runs/20261127-civilization3-wise-layout-root/` recovered the Wise
script's mapping to **3465 unique `%MAINDIR%` game destinations**, including
`%MAINDIR%\Civilization3.exe`. Record offsets distinguish duplicate basenames;
3464 game records match the script's basename, size and CRC, while the license
record uses a zero script CRC and passes its archive CRC. The original
installer must remain the source for those relative paths. A user-selected
absolute installation directory remains unverified.

Complete raw recovery subsequently succeeded in
`scratch/runs/20261127-civilization3-payload-root/`. Its `extract.cjs`
independently parses the original local headers and Wise destination mapping,
rejects traversal and case-insensitive collisions, and validates every output.
All **3480 records, 534931311 bytes**, passed expanded-size and CRC32 checks,
then on-disk size/CRC32/SHA-256 readback. The game tree contains 3465 files
(534146615 bytes); 15 installer-only records contain the remaining 784696
bytes. Duplicate basenames retain distinct mapped directories. Each of the
22 suffix-bearing compressed records has exactly one trailing zero byte;
its expected expanded size and CRC pass. The earlier `7z t` exit 2 remains
a failed 7-Zip check, separate from this independently verified recovery.

The script also invokes `decoder.exe -f lfiles.lsy -p .` for **635 assets**,
then removes decoder components. All 635 manifest entries are Ogg Vorbis
audio jobs with mode `a` and output depth `16`; paths end in `.wav.ogg`.
Static decoder analysis identifies RIFF/WAVE PCM output with the original
channel count and sample rate (22050 or 44100 Hz), dropping the final `.ogg`
suffix. These are audio jobs, with no image conversions in this manifest.
The original decoder has not been executed. A separate host FFmpeg recovery
produced all 635 destination WAVs (103750098 bytes); independent JS RIFF and
Ogg CRC checks, source hashes, decoded frame counts and output SHA-256
readback passed. All outputs are PCM16 with original channels/rates. Exact
historical decoder sample/frame identity remains unknown: host output frame
counts differ from EOS granules for 123 files, and three cross-decoder samples
have rounding differences of up to two sample units. No trimming or padding
was invented. These are validated host reconstructions, not proven original
installer output or complete installation. Evidence:
`scratch/runs/20261127-civilization3-asset-processing-root/` and
`scratch/runs/20261127-civilization3-audio-assets-root/`.
ActiveMARK installer hooks and purchase shortcuts identify
trial machinery; its present-day activation behavior remains unknown. The
recovered raw paths alone do not establish a ready-to-run fixture.

The coordinator reports no version resource on that game PE, a sole static
`KERNEL32.DLL` import, and a README changelog starting at v1.29f. This is
consistent with a protected trial executable; packing/protection is an
inference, and one static import is not a complete dependency inventory.
The README does not establish the executable's version. PTW's possible
`Civilization3X.exe` must not be claimed as included without payload evidence.
Record actual reconstructed paths, PE hashes/resources/imports before adding
an installed executable fixture. The Windows installer and timed-trial
machinery may require installation state; current activation, offline startup,
DirectX requirements and emulator compatibility were not tested. No Wine
reference run, launch, trial unlock or gameplay claim was made.

Its `extracted-pe-identities.json` records the selected game PE as i386/PE32
GUI, image base 0x400000, entry RVA 0x608fa8, five sections, SHA-256
`45aa3c6c61410d0ab24dd6622f56ac62aaa2f5fc5556a67f28c437e4dff17160`.
For inspection only, recover that selected member from the original using
`7z e -so Civ3-GameoftheYear.exe CIVILIZATION3.EXE > selected-CIVILIZATION3.EXE`
in a new output directory and compare the byte count/hash. This does not
reconstruct a playable installation or resolve duplicate asset paths.
