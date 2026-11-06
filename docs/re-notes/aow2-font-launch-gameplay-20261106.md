# AoW II: full-shell font mechanism reproduced; original held at an omitted DLL pin

Worker `aow2-font-launch-gameplay1610`; evidence:
`scratch/runs/20261106-aow2-font-launch-gameplay/` (ignored).
Tested original main: `2e0468ca734b9008a1e42d05119de475bd835365`.
No production emulator or collector changes. No current gameplay or terrain
acceptance; historical accepted army displacement and movement points stand.

The actual shell was exercised with a generated PE, through ordinary Launch,
`host.init`, module/API-table compilation, all three W95FA `document.fonts.load`
calls, font readiness and an instantiated running guest. An isolated FontFace
test had not covered this path. The run-local server records request arrival,
request aborted/error/close, response finish/error/close and destroy, with its
own request/socket identities. Browser identities remain separate; no URL-only
join substitutes for a missing owning receipt.

The cache-enabled collected full shell reproduces a Font `Failed` before any
recorded server request arrival. Its Chrome netlog identifies the font URL's
`URL_REQUEST_START_JOB` completion as **-400, ERR_CACHE_MISS**. The strict
collector sees generic `Failed`, retains its first fault and holds subsequent
responses. This establishes the mechanism in this generated run; the older
15:15:16 original lacks that netlog, so its exact cause remains unknown.
The same full shell without collection succeeds. With browser caching disabled
before navigation, collection also succeeds: the server receives the font,
finishes HTTP 200, and its 7,880 bytes/hash match the owning browser receipt.
All three actual host font loads fulfill. No failed resource was accepted,
refetched through another channel or supplied from server bytes.

Failed setup attempts are preserved separately: a generated-app icon omission,
then the local `SYSTEM_DATA_FILES` stdole2 type-library pin omission. The complete
passing generated control verifies 176 browser responses, including the tracked
manifest, fonts, module, API table and system type library. Seven prior passing
transport controls are reused only after exact adapter/collector hash equality;
the published owning-worklet collector remains unchanged. Both shipped modules,
observer disabled/armed, pass the retained 27-draw controls with equal pixels,
counters and architecture; armed cells retain 159 CPU and 57 GPU events.
The locked full build passes. These controls do not establish original gameplay.

The sole registered original Launch is **17:08:24.577 UTC**. The font succeeds,
and the actual main Worker instantiates standard module
`43a0097ab79e1e9102d6f12411485a359ebe10b03af5fcf22675b75ad701a081`.
At **17:08:26.189**, the first fault is a missing run-local inventory entry for
`binaries/dlls/oleaut32.dll`, an actual `DLL_PATHS` registry URL. It is not an
observed server failure or differing DLL bytes. Exact owning identities are
session `09ACD721F270F110AEAAFA82E943C253`,
target `5D795C0678C37F497A62455220A0818D`,
Fetch `interception-job-169.0`, Network `598414.270`.
Both captured browser body and server request169's completed HTTP200 response
are 598,288 bytes, SHA256
`baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`.
The original pins are retained unchanged, including the omission.

The same original browser survived the fault and module guard. I personally
inspected `initial.png`: Downloading Age of Wonders II Beta Demo libraries,
not menu/world. `running=false`, main completed slices0, no renderer endpoint.
No game input, army commands or movement-point changes followed Launch.
The retained per-Worker durable drains contain zero CPU/DX/GPU events and zero
terrain births; this is a startup observation gap, not evidence of absent draws.
The collector has no recovery API; its first fault was not cleared or bypassed.
On the coordinator's 17:10:17 instruction, the browser closed normally at
**17:10:55.968**, preserving the original boundary without a second launch.

The next-run inventory is now generated from actual `DLL_PATHS` aliases plus
the existing shell/font/system-data/media inputs. A focused generated guest
importing oleaut32 passes strict full-shell collection, native DLL loading and
DllMain, then runs. Its receipt verifies the exact DLL body. The 19 present
registry DLL paths are hashed, without copying native DLLs or game media.
`next-browser-input-pins.json` is separate from the failed original inventory.

Next: separately authorize a new original using that corrected inventory and
the passing cache-disabled full-shell recipe, then inspect menu/world, perform
two ordinary army commands with visible points, and retain terrain creation,
upload and draw contribution. No emulator mismatch or terrain repair is claimed.
Git SHA/binary diffs and helper adaptation patches preserve source provenance;
all 1,064 media references and shipped modules remain unchanged. No boxes were
assigned or created; box ID/state/expiry are not applicable.
