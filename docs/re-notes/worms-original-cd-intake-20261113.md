# Original Worms CD candidate: verified stream and recovery

Owner187 requested the original Worms, separately from the later Worms 2 and
Armageddon demos. This task independently streamed the complete public candidate
on 2026-11-13 and verified its ISO9660 file closure. No media was saved, installed,
registered or executed. Publisher authenticity and gameplay remain unverified.

## Candidate identity

- Provider item: <https://archive.org/details/worms_team17>
- BIN: <https://archive.org/download/worms_team17/CDWORMS.bin>
- Complete bytes: **578,432,064**; exact provider size match.
- Independently calculated SHA-1: `a7c9b3adee3a9fe8d8cdffb858d70f9d6a775cc6`; exact provider match.
- Independently calculated SHA-256: `e353ccf735d26f2c56d87614ab26f700f2ee5dfb79dd1848c18208276ff5d888`.
- CUE: <https://archive.org/download/worms_team17/CDWORMS.cue>
- Complete cue: 401 bytes; SHA-1 `ad14316f962fd862209c1b6780c220a1b3937223`;
  SHA-256 `fca976865b9d008014d334fc4562e8b2ccb3f9cb1a414c6e23d2ae3cdd7a7052`. Both prior cue identities match.

The provider title describes an English US MSDOS 1995 release. Matching provider
hashes establishes identity of this candidate, not independent publisher provenance
or an independently authenticated original pressing. The known executable hashes
match the prior complete bounded observations exactly. Those bytes previously
identified the DOS/protected-mode route (`WRMS.EXE` has an LE header), not a Windows
PE entry. This is a verified remote candidate, not an available local installed
corpus. No fake runnable entry was added; no full-version playability is claimed.

## Verified closure and byte locations

The ISO volume is `CDWORMS`, 44,040 logical blocks of
2,048 bytes. All **68 files** across **14 directories** were enumerated and every
file's complete declared byte length hashed from the full stream. Group totals:

| Group | Files | Complete file bytes |
|---|---:|---:|
| ROOT | 9 | 783,597 |
| DATA | 46 | 3,293,261 |
| FMV | 13 | 85,970,893 |

This includes every DATA terrain/font/sound asset, every FMV AVI, the FMV player
and both copies of DOS4GW, all root executables, configuration and installation
files. File-byte closure here means the full ISO file contents; installation
behavior, generated state, CD access and runtime dependency behavior were not
tested. The README and INSTALL.BAT also match the prior complete-file hashes.

Extent is the ISO logical block address. For file byte offset `x`, the exact raw
BIN byte location is `(extent + floor(x/2048))*2352 + 16 + (x % 2048)`.
Only the declared file length is hashed: omit 16-byte raw headers, 288-byte sector
trailers and final logical-sector padding. The JSON manifest additionally records
each first raw payload byte and logical start byte. Names below retain ISO `;1`
versions and trailing dots; preserve an explicit name mapping if later extraction
normalizes these names.

| ISO path | Extent | Bytes | SHA-256 of complete file |
|---|---:|---:|---|
| `BLACK.EXE;1` | 23 | 20604 | `18a8aee978aa752c88ebbeb6cc4e245838e2e41fcdd854e9fa2215556483d954` |
| `DOS4GW.EXE;1` | 34 | 265420 | `dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c` |
| `INSTALL.BAT;1` | 164 | 7 | `0949888c614d02518f48a1137b75fd27028bfc8e927bd4181bb90af6b637d91f` |
| `README.TXT;1` | 165 | 6454 | `c854c996af3871bd7c66f17cfe3ee497fca34ed0bc057516c296d399577ccedb` |
| `SETUP.EXE;1` | 169 | 39746 | `92805b6402fb28b8b6d07e57038ce97d9939fd6febbdb9c5c7dde639c62b0771` |
| `T17VIEW.EXE;1` | 189 | 6677 | `42507a63606e392bb4a023dcd9bfadb28a6d28309aa6bb7133b308fd0361920c` |
| `WORMS.CFG;1` | 193 | 4204 | `7421858c3d465ced1c1e2d934194cc8d439b413ac26ef6d1a04b0951c09256f6` |
| `WORMS.EXE;1` | 196 | 14368 | `7dd42f1d5d719912855c567e95570423cd4c816500c754ff8628dd84f67d46ec` |
| `WRMS.EXE;1` | 204 | 426117 | `483f9f2376f76224602e67fc608f19ea13c218c0ef66643de30f2daf18d51ada` |
| `DATA/WATER.;1` | 424 | 7446 | `7772c5fd613a92b78317cc1f6d62e0b177a1583826ae6f463fac73f554672e96` |
| `FMV/AIRSTRKE.AVI;1` | 428 | 4848414 | `bdc25ee1b75f4a95361b7fbdf810febc6b1a3440a941a4ad379a3d8e56368f1c` |
| `FMV/ARMUP.AVI;1` | 2796 | 6612414 | `369b362e9898c7f44a8a565fa97d0b092b45a75582ccb6326df28230c6837612` |
| `FMV/DOS4GW.EXE;1` | 6025 | 265420 | `dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c` |
| `FMV/FLAME.AVI;1` | 6155 | 6600414 | `9c18c7384a108488853dbca6575bf87f7bde0b2001a8af47126e3f4936af22d7` |
| `FMV/GRENADE.AVI;1` | 9378 | 7680414 | `ea45690c5b3449c238ee2ad3c23b2455c365f6169f50a1a077e6f47f07339ce2` |
| `FMV/KAMIKAZE.AVI;1` | 13129 | 11904414 | `a0ab7889d0d7150ed9b2b6a8f12e38d5e49e9917b3ebbba628b168a920457475` |
| `FMV/LOGO1.AVI;1` | 18942 | 3780414 | `63ebf84da7890a29ac2125a664d55aac8e35f98cfa25cda7bb066195334d15d7` |
| `FMV/LOGO2.AVI;1` | 20788 | 4908414 | `5d671ebdaba97e4412acc7f8b923ab7dc05337607938e661ca68c40ceb74ab41` |
| `FMV/MINE.AVI;1` | 23185 | 3984414 | `0df21ac137bd42faf84d32410dc5dfd353a4583cb3a764d31618ce3d2d505c63` |
| `FMV/MISSILE.AVI;1` | 25131 | 12300414 | `24c87cbd030d446eef88130dfb8f39fd2cc2bc8114c0ca82bb4f5192ecb9448b` |
| `FMV/PLAY.EXE;1` | 31138 | 164919 | `73b78483f41950c76663898b664d2293774a4a0e577199ef8ae329002d319a9a` |
| `FMV/TELEPORT.AVI;1` | 31219 | 13104414 | `3c2c0db88481a9c0358ac1d4fee39a653831ab1bc1199e266c2d2a7aef627810` |
| `FMV/UZI.AVI;1` | 37618 | 9816414 | `226a51f20c46ae5847a4d8032b60f089666336614963cb7d1ebc45a13b06a28f` |
| `DATA/AUDIO/WORMS.SFX;1` | 42412 | 710912 | `9c76d33b44bce7c8440b24e489ba7be9e6c2ddbdf1f8948f1ad464e7fee946d2` |
| `DATA/AUDIO/WORMSA.SFX;1` | 42760 | 720128 | `83891f9d4fcfb6cf01920f8e41a3d03de2e1c6050d5062fcce3b51f8a801ee09` |
| `DATA/AUDIO/WORMSF.SFX;1` | 43112 | 666624 | `fc6f4b79fb2da54c8fc2a3edb7824e804f81747e4a3a7207fcdcaab417dcbe10` |
| `DATA/AUDIO/WORMSG.SFX;1` | 43438 | 692480 | `3e76519ca50633b8d0dde1df48499d1c908e48ee3f1cd25f7b35c7c08b4fd395` |
| `DATA/BEACH/COLTAB1.;1` | 43777 | 1024 | `17b909b237192e240b82a8058ff4e7b649fd4607e6219c65f81ef9dfc967c106` |
| `DATA/BEACH/LAND1.;1` | 43778 | 18723 | `3154930cdeab8c809c29ee5d5bb6ab127fe7985f7f419680df9bedb54664bdb9` |
| `DATA/CANDY/COLTAB1.;1` | 43788 | 1024 | `3255f68d57e040445fd40414db1f26057230825f12a1eee95e45af7b58926705` |
| `DATA/CANDY/LAND1.;1` | 43789 | 17818 | `d19ed0ada2b439471506fa65871931e5c658a003d6c23939d51f3bb9e6a2c9f1` |
| `DATA/DESERT/COLTAB1.;1` | 43798 | 1024 | `5c44487f31eff2225276092cecf54e00fd0fea2fa0eaa6c05cbc083a55e60158` |
| `DATA/DESERT/LAND1.;1` | 43799 | 29571 | `e927540bebf8faf9af449c29a89fcd6fa7f511af3a80d746a865d1168ceab860` |
| `DATA/FORREST/COLTAB1.;1` | 43814 | 1024 | `ce3e451bd544ab21e2c6880a9bbcbd5c73d100367260605040be94ba67651cb2` |
| `DATA/FORREST/LAND1.;1` | 43815 | 23638 | `68e940a28a15bb086fae5444b0df90fee1f74eda3006ed6045d90fa8f9d717b4` |
| `DATA/GEIGER/COLTAB1.;1` | 43827 | 1024 | `312e336e8373494cffb439c26634b0bc8885a1a3dc043dfd777e97947a08d3e0` |
| `DATA/GEIGER/LAND1.;1` | 43828 | 24684 | `dc1602c533bdb1bb6228c7f824b327f8a1357690d26083bbbb6ee933d5aa2753` |
| `DATA/HELL/BACK1.;1` | 43841 | 13412 | `5788babf707ad66e701f9d2e7329de97866c384d6440efc2b1b240a0183a8fa8` |
| `DATA/HELL/BACK2.;1` | 43848 | 14896 | `266a7b2f861c825e9dffdd9169f4ec8394fe323d62ce7154e1490fe55ae8bdb0` |
| `DATA/HELL/COLTAB1.;1` | 43856 | 1024 | `aee862b5abda044926e2146e69b83566d61a99ce02233aaeb4a2a02e42779d87` |
| `DATA/HELL/LAND1.;1` | 43857 | 24405 | `495047f5d1bf5bdbe34c923222c6756fdb4a7d69a73a06f73a79c4450ff70a32` |
| `DATA/HELL/LAVA.;1` | 43869 | 15562 | `70883cfcc76753fd66d7c0ad6c6f664c4289a7e1763d0d3a13c42f61a83956e7` |
| `DATA/JUNK/COLTAB1.;1` | 43877 | 1024 | `b65774db5a86ff62d137cca6aac4d9aa654525d1adb41c9a20175352eae02af7` |
| `DATA/JUNK/LAND1.;1` | 43878 | 31959 | `3239041fd17f777fa3dc47bc1c3942330f9105f424eda92870b19d55e18de509` |
| `DATA/MARS/COLTAB1.;1` | 43894 | 1024 | `5dbc6e228b5db646aca419e3873bbe5fc15756752cf6e10f97ef0e8dd11f3c30` |
| `DATA/MARS/FCOLTAB.;1` | 43895 | 1024 | `d1739896885a83990612b3351ed575ac728e3acd2d9ac8cf7b49157720bb2dde` |
| `DATA/MARS/FONT1.;1` | 43896 | 3840 | `986c7305ba01377e38b780bebe26e8cf2ea84d9bfc58329482a7dd0511b7436b` |
| `DATA/MARS/FONT2.;1` | 43898 | 7104 | `33e77272eab2ebc8cf27b0baccdb744a775c1334aaddb36d98a20a0bedf50de6` |
| `DATA/MARS/FRONTFNT.;1` | 43902 | 2774 | `3c6cda4a99d311c6dfd6d35004b7839726c3ad31ab0f6eeb306ae4701e465863` |
| `DATA/MARS/ICONS.;1` | 43904 | 10391 | `6ed93e951bda0b08578aed99b5a50ff9db199cb6c1768ff79d14c919a258f8c1` |
| `DATA/MARS/KODATA.;1` | 43910 | 1177 | `e415da1c89abe19d9ffd6abe5e982e2949acb7435dda4af34ea05e436848332e` |
| `DATA/MARS/LAND1.;1` | 43911 | 24214 | `fd1cab8d5099f208e5f8e0d16392f6c7ba3ee6fcd5f988c8a668c7cdc71cbab1` |
| `DATA/MARS/LAYER2.;1` | 43923 | 12513 | `26a770d787ea05f88c729f0ce747246489e5cf19ed3812c88d7e24439305418e` |
| `DATA/MARS/LAYER3.;1` | 43930 | 13316 | `c5541bfc937443b0deece341e1b84d1f1f280dc79231139ce3a927f8b3be7a7c` |
| `DATA/MARS/LOGO3.WCT;1` | 43937 | 1024 | `a522ca5dca4a70e684a9e6f27701a51c7761bd91c34e6f319c873345fce7be4a` |
| `DATA/MARS/LOGO3.WRW;1` | 43938 | 76800 | `2bf588fd47331a33e88acf953bb3fb692baf7a639044abbdd084eeb038d7b564` |
| `DATA/MARS/MLAYER2.;1` | 43976 | 11373 | `4957f09262fb779c7046232a5cb7b32ecff8503026e0ee4beac730517c4ecfdc` |
| `DATA/MARS/MLAYER3.;1` | 43982 | 11614 | `637841a40b180a732771e073bca0401e30137e67c908d4eee3bc6bff4f7cf06c` |
| `DATA/MARS/SCORB.;1` | 43988 | 4896 | `00beb11c9159dcd93e25ce55a1ea416e0713433ae6189957276f604454657b84` |
| `DATA/MARS/SCORBDAT.;1` | 43991 | 1038 | `abe71abfc93411fead30e43d083651623bfa867eb5e175df0547f5b6da61d677` |
| `DATA/MARS/SNOT.;1` | 43992 | 7381 | `0d515ca2253e2522ba883a1aeabdcba43de9dd1e869c30c1fd488fe5e6a61ff3` |
| `DATA/MARS/WATER.;1` | 43996 | 1793 | `6b290278cbfa2649363ea0f9b9d731e7ae46c7644dc6732d6ccb64805a54db31` |
| `DATA/MARS/WLOGO.;1` | 43997 | 7420 | `34aa1b056a627135f7922f44c25ae69287b44002a311af0e8a2554e8cebd4a61` |
| `DATA/MARS/WORMS.;1` | 44001 | 19338 | `786cf99fdc9b5656e9c47566dc53028a7c7f9a4a9728e081526e26c266da1efa` |
| `DATA/NAM/COLTAB1.;1` | 44011 | 1024 | `aeafb4915856d759510d232fbcba725ebee5c8b88de81a880472e80665ac6fc4` |
| `DATA/NAM/LAND1.;1` | 44012 | 24760 | `4c46a40b94fa3629817452c06482a379ab053cdc0ef573228902dba36744b08b` |
| `DATA/SNOW/COLTAB1.;1` | 44025 | 1024 | `c558fb5cba21d7b9a0dfc7df2b4c13c36f15ccad190db15e6097133395dd366b` |
| `DATA/SNOW/LAND1.;1` | 44026 | 26973 | `a86bbcbed13e6f4f7367777b1ba49e746fdad25784c9aa054be2b0e8b70547cd` |

## Mixed-mode preservation

The 401-byte cue declares one MODE1/2352 track and eight AUDIO tracks in the same
BIN. Keep the exact BIN and CUE together. A data-only ISO or extracted DATA/FMV
tree discards the eight CD audio tracks and raw layout. Whole-disc hashes cover
every byte, including non-file sectors, track gaps and audio. Each cue-delimited
raw span also has a SHA-256 below (end is exclusive). These are byte-span hashes,
not WAV hashes or an independent TOC/pressing verification; the boundaries follow
the provided cue, whose only indexes are INDEX 01.

| Track | Type | Raw start | Raw end exclusive | SHA-256 |
|---:|---|---:|---:|---|
| 1 | MODE1/2352 | 0 | 104468784 | `1b667e22b50746fd09895a713da0e9ee5d460d53dd3b63fde12e9b3f410d193d` |
| 2 | AUDIO | 104468784 | 164872848 | `fde7998caa5eb8ff9670f6eede9bf820250bb84650ca6ea329b74c6bfcaf9b7c` |
| 3 | AUDIO | 164872848 | 237566112 | `18755e0275454463dfcec2d840e9daa2fb5ec805d8ed5ad3d0291f77ef68765c` |
| 4 | AUDIO | 237566112 | 306787824 | `3fc61205c1fae20d385c5ea938926f04f8eeb7e2f6e853d94ae62ceefdd85b73` |
| 5 | AUDIO | 306787824 | 377366640 | `02a5bcd6ea40bf30d9e1484db972b4fda33cebb5ba920659a3147967660b7886` |
| 6 | AUDIO | 377366640 | 447204576 | `9b2b99bdd10a7881bffd978a9d4cfe9dd6137c9ccd2fb9ebecc87204b00fe8ac` |
| 7 | AUDIO | 447204576 | 520883328 | `fbb575bb4e78f374be1a088cbc1c3ba2c054267afd00f21b49bf8f78ab716e60` |
| 8 | AUDIO | 520883328 | 576414048 | `b002f21bf46ae1add19ece2711cfda764e96008779a355583a07421c9aab24ea` |
| 9 | AUDIO | 576414048 | 578432064 | `5f6c674d325d34852b43317e8e73000e180e313b8eadefc4a0f275fcfc4db085` |

The ISO volume ends at raw byte 103,582,080, while track 2 starts
at 104,468,784. The intervening bytes are preserved by the BIN
hash and track-1 span hash, and are not interpreted as ISO file payloads.

## Evidence and validation

Run: `scratch/runs/20261113-worms-cd-stream-0810/` (ignored; no media binaries).
`manifest.json` records complete disc SHA-1/SHA-256, all file SHA-1/SHA-256 hashes,
directories, cue text, raw track locations and hashes, and all HTTP receipts.
Manifest SHA-256: `ab192a904b8e37d898b679405ac3103481b9a67ace676b3fe561264b4c4dcec0`.
`validation.json` independently checks the manifest's lengths, bounds, track
partition, all 17 exact 206 Content-Range/Content-Length receipts, and all four
prior complete small-file identities. `stream.exit` is zero. The reader verifies
Mode 1 sync/mode inside the ISO volume and dual-endian directory extent/size
fields; interleaved and multi-extent records cause a hard stop.

The first pass stopped because my reader incorrectly required Mode 1 sector
headers outside the ISO volume, before track 2. `first-pass-manifest.json`,
`first-pass.log` and `first-pass.exit` retain that failure; its stream was partial
and makes no complete-disc claim. The corrected fresh pass completed. No HTTP
denial or denied-transport retry occurred. Requests used ordinary public HTTPS,
followed the provider's redirects, and required exact 206 range status and
bounds. There were no authentication changes, alternate transport workarounds,
sandboxes, media staging, reserve changes, emulator/browser/build runs, source
changes or child workers. Peak media buffers are bounded by a 602,112-byte raw
stream block plus its decoded payload (directory reads are capped at 1 MiB).

`source-head.txt` records the inspected Git HEAD; relevant binary diffs and the
owned new document patch are retained beside the logs. Git is the source archive.
No source tree snapshots or media were archived. The independent local deadline
was GNU `timeout --signal=TERM --kill-after=5s 1200s`; its PID/start and completion
receipts are retained. Box ID: none; state NOT_CREATED; expiry null; stop receipt
not applicable. The original screenshot lanes and all other agents' files were
left untouched.

## Reproducible intake and recovery

To repeat this read-only verification, save the Python program below as
`verify.py` in a fresh small metadata output directory and run:

```sh
timeout --signal=TERM --kill-after=5s 1200s python3 -u verify.py > stream.log 2>&1
```

It uses the Python standard library, never writes media and never retries a
failed or denied read. Stop on any status/range/length/hash mismatch. Its output
manifest should reproduce the disc, cue, per-file and per-track hashes above;
timestamps and response headers may differ, so the entire JSON file hash is run
specific. The complete stream needs ordinary HTTP access and about 578 MB of
network transfer, in addition to the small directory and cue reads.

For a future authorized intake with sufficient destination capacity, recover the
exact two public files at the URLs above, verify both complete sizes and hashes
before use, and retain the original pair as the recovery source. Extracting a
data view must preserve every listed file and compare its complete hash; keep
the BIN/CUE for audio and disc semantics. Do not substitute a later demo or a
data-only ISO. No local media recovery was performed in this task. Installation,
the complete installed tree/configuration, DOS/protected-mode support, original
turn input and actual gameplay evidence are the next separate work.

```python
#!/usr/bin/env python3
"""No media output; bounded public reads, no retry on error or denial."""
import hashlib, json, math, pathlib, re, sys, time, urllib.request
OUT = pathlib.Path(__file__).resolve().parent
URL = 'https://archive.org/download/worms_team17/CDWORMS.bin'
SIZE = 578432064
PROVIDER = 'a7c9b3adee3a9fe8d8cdffb858d70f9d6a775cc6'
result = {'url': URL, 'providerBytes': SIZE, 'providerSha1': PROVIDER,
          'startedUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
          'complete': False, 'receipts': [], 'files': [], 'directories': []}
def save():
    (OUT/'manifest.json').write_text(json.dumps(result, indent=2)+'\n')
def request(url, start, end, total):
    req = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity'})
    rec = {'url': url, 'start': start, 'endInclusive': end}
    result['receipts'].append(rec)
    save()
    try:
        response = urllib.request.urlopen(req, timeout=45)
    except Exception as e:
        rec['error'] = repr(e)
        rec['status'] = getattr(e, 'code', None)
        save()
        raise
    rec.update(status=response.status, finalUrl=response.url, headers=dict(response.headers))
    save()
    assert response.status == 206, rec
    assert response.headers.get('Content-Range') == f'bytes {start}-{end}/{total}', rec
    assert int(response.headers['Content-Length']) == end-start+1, rec
    assert response.headers.get('Content-Encoding', 'identity') == 'identity', rec
    return response, rec
def small(start, count):
    assert count <= 1024*1024
    with request(URL, start, start+count-1, SIZE)[0] as r:
        data = r.read(count+1)
    assert len(data) == count
    result['receipts'][-1]['sha256'] = hashlib.sha256(data).hexdigest()
    save()
    return data
def logical(extent, length):
    raw = small(extent*2352, math.ceil(length/2048)*2352)
    for i in range(0,len(raw),2352):
        assert raw[i:i+12] == b'\x00'+b'\xff'*10+b'\x00' and raw[i+15] == 1
    return b''.join(raw[i+16:i+2064] for i in range(0,len(raw),2352))[:length]
def entry(data):
    n = data[32]
    extent = int.from_bytes(data[2:6],'little')
    size = int.from_bytes(data[10:14],'little')
    assert extent == int.from_bytes(data[6:10],'big')
    assert size == int.from_bytes(data[14:18],'big')
    assert not data[26] and not data[27] and not data[25]&128, 'interleaved/multi-extent unsupported'
    return {'name':data[33:33+n].decode('ascii'), 'extent':extent, 'bytes':size, 'flags':data[25]}
def main():
    cueurl = URL.replace('.bin','.cue')
    with request(cueurl,0,400,401)[0] as r:
        cue = r.read(402)
    assert len(cue)==401 and hashlib.sha1(cue).hexdigest()=='ad14316f962fd862209c1b6780c220a1b3937223'
    result['cue'] = {'text':cue.decode('ascii'),'bytes':401,'sha1':hashlib.sha1(cue).hexdigest(),'sha256':hashlib.sha256(cue).hexdigest()}
    indices = re.findall(r'INDEX 01 (\d+):(\d+):(\d+)', cue.decode())
    starts = [(int(m)*60*75+int(s)*75+int(f))*2352 for m,s,f in indices]
    assert len(starts)==9 and starts[0]==0 and SIZE%2352==0
    result['tracks']=[{'track':i+1,'type':'MODE1/2352' if i==0 else 'AUDIO','rawStart':s,'rawEndExclusive':(starts+[SIZE])[i+1]} for i,s in enumerate(starts)]
    pvd=logical(16,2048)
    assert pvd[:7]==b'\x01CD001\x01' and int.from_bytes(pvd[128:130],'little')==2048
    result['volumeId']=pvd[40:72].decode().strip()
    result['volumeSectors']=int.from_bytes(pvd[80:84],'little')
    queue=[('',entry(pvd[156:]))]; seen=set()
    while queue:
        path,e=queue.pop(0)
        assert e['extent'] not in seen, 'directory cycle'
        seen.add(e['extent'])
        data=logical(e['extent'],e['bytes']); pos=0
        result['directories'].append(dict(e,path=path,sha256=hashlib.sha256(data).hexdigest()))
        while pos<len(data):
            n=data[pos]
            if not n:
                pos=(pos//2048+1)*2048; continue
            assert n>=34 and pos%2048+n<=2048
            child=entry(data[pos:pos+n]); pos+=n
            if child['name'] in ('\x00','\x01'): continue
            child['path']=(path+'/' if path else '')+child['name']
            if child['flags']&2: queue.append((child['path'],child))
            else:
                assert (child['extent']+math.ceil(child['bytes']/2048))*2352<=starts[1]
                child['rawFirstPayloadByte']=child['extent']*2352+16
                child['logicalStartByte']=child['extent']*2048
                result['files'].append(child)
    save()
    # One whole-disc ranged response, streamed without buffering the image.
    sha1=hashlib.sha1(); sha256=hashlib.sha256(); count=0
    hs=[(hashlib.sha1(),hashlib.sha256(),0) for _ in result['files']]
    th=[hashlib.sha256() for _ in starts]
    response,rec=request(URL,0,SIZE-1,SIZE)
    with response:
        while count<SIZE:
            target=min(2352*256,SIZE-count)
            raw=response.read(target)
            assert len(raw)==target, ('short stream',count,len(raw),target)
            sha1.update(raw); sha256.update(raw)
            for t,h in zip(result['tracks'],th):
                lo=max(count,t['rawStart']); hi=min(count+len(raw),t['rawEndExclusive'])
                if hi>lo: h.update(raw[lo-count:hi-count])
            # Track 1 may contain a non-ISO gap before the first AUDIO index.
            # Interpret sector payloads only within the declared ISO volume.
            volume_end=result['volumeSectors']*2352
            if count<volume_end:
                dataraw=raw[:min(len(raw),volume_end-count)]
                for i in range(0,len(dataraw),2352):
                    assert dataraw[i:i+12]==b'\x00'+b'\xff'*10+b'\x00' and dataraw[i+15]==1
                payload=b''.join(dataraw[i+16:i+2064] for i in range(0,len(dataraw),2352))
                logicalstart=count//2352*2048
                for j,f in enumerate(result['files']):
                    lo=max(logicalstart,f['logicalStartByte']); hi=min(logicalstart+len(payload),f['logicalStartByte']+f['bytes'])
                    if hi>lo:
                        a,b,n=hs[j]; fragment=payload[lo-logicalstart:hi-logicalstart]
                        a.update(fragment); b.update(fragment); hs[j]=(a,b,n+len(fragment))
            count+=len(raw)
            result['streamedBytes']=count
            if count//(32*1024*1024)!=(count-len(raw))//(32*1024*1024):
                print('streamed',count,flush=True); save()
        assert response.read(1)==b'', 'extra bytes'
    result['disc']={'bytes':count,'sha1':sha1.hexdigest(),'sha256':sha256.hexdigest()}
    for f,(a,b,n) in zip(result['files'],hs):
        assert n==f['bytes']
        f.update(verifiedBytes=n,sha1=a.hexdigest(),sha256=b.hexdigest())
    for t,h in zip(result['tracks'],th): t['sha256']=h.hexdigest()
    assert count==SIZE and sha1.hexdigest()==PROVIDER
    expected={'WORMS.EXE;1':'7dd42f1d5d719912855c567e95570423cd4c816500c754ff8628dd84f67d46ec','WRMS.EXE;1':'483f9f2376f76224602e67fc608f19ea13c218c0ef66643de30f2daf18d51ada'}
    for name,digest in expected.items(): assert next(f for f in result['files'] if f['path']==name)['sha256']==digest
    result.update(complete=True,providerMatch=True,priorExecutableMatch=True)
    save(); print(json.dumps(result['disc']),flush=True)
try:
    main()
except BaseException as e:
    result['error']=repr(e); save(); raise
finally:
    result['finishedUtc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()); save()
```
