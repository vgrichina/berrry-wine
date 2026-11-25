#!/bin/zsh
# Rebuild sigs/all.json from the reference binaries (paths relative to the
# main checkout's test/binaries). Run from the run folder.
set -e
B=${B:-/Users/vg/Documents/projects/phone/wine-assembly/test/binaries}
mkdir -p sigs
rm -f sigs/msvc.json sigs/delphi.json sigs/static.json
# Exported CRT bodies from the DLL CRTs (dynamic-CRT apps reach these by name).
N=memcpy,memmove,memset,memcmp,memchr,strlen,strcmp,strcpy,strcat,strchr,strrchr,strncpy,strncmp,strstr,_strnicmp,_stricmp,_strcmpi,_ftol,_ftol2,_ftol2_sse,_CIsqrt,_CIpow,_CIsin,_CIcos,_CIatan2,floor,ceil,malloc,free,realloc,calloc,rand,srand,sprintf,vsprintf,qsort,wcslen,toupper,tolower,atoi,atol,strtol,_itoa,fread,fwrite,fopen,fseek,abs,labs,_purecall,_EH_prolog,__CxxFrameHandler,_except_handler3,_global_unwind2,_local_unwind2,_onexit,_initterm
for r in "dlls/msvcrt.dll:vc6" "dlls/msvcrt20.dll:vc2" \
         "candidates/unreal-tournament-2003-demo/installed/msvcr70.dll:vc70" \
         "candidates/pirates-2004/cab/msvcr71.dll:vc71" \
         "candidates/dungeons-of-dredmor-release/game/msvcr80.dll:vc80"; do
  node scripts/krsig.js extract --ref="$B/${r%%:*}" --tag=${r##*:} --names=$N --out=sigs/msvc.json --append 2>&1 | grep -v '^warn' || true
done
# Statically linked CRT bodies (never exported: _chkstk, the 64-bit helpers,
# and the static-library builds of the string routines, whose jumps are
# encoded differently from the DLL builds). Seeded by a short known opening.
F=(--find=memset=8b54240c8b4c240485d274 --find=strlen=8b4c2404f7c1030000007414
   --find=strcmp=8b5424048b4c2408f7c203000000 --find=_chkstk=513d001000008d4c2408
   --find=memcpy=558bec57568b750c8b4d108b7d088bc18bd103c63bfe --find=_aulldiv=53568b4424180bc075
   --find=_alldiv=57565333ff8b4424140bc07d --find=_aullrem=538b4424140bc07518
   --find=_allrem=535733ff8b4424100bc07d --find=strcpy=578b7c2408eb6a
   --find=strcat=8b4c2404578b7c2408 --find=strchr=33c08a442408538bd8c1e008
   --find=memcmp=558bec57568b4d1085c9 --find=_strnicmp=558bec5756538b4d1085c9
   --find=_allshl=80f940731580f92073)
G=$B/candidates/gta2-demo/installed/Program_Executable_Files/gta2.exe
H=$B/candidates/heroes-2-demo/files/H2DEMOW.EXE
node scripts/krsig.js extract --ref=$G --tag=s-gta2 --va=_allmul=0x5de950 --va=_allshr=0x5de920 --va=_ftol=0x5deb40 $F --out=sigs/static.json 2>&1 | grep -v '^warn' || true
node scripts/krsig.js extract --ref=$H --tag=s-h2 --va=memmove=0x4d35f0 $F --out=sigs/static.json --append 2>&1 | grep -v '^warn' || true
# Delphi System unit (Game Maker 8's Delphi 7 RTL), VAs from docs/re-notes/spelunky-classic.md.
SP=$B/candidates/spelunky-classic/extracted/Spelunky.exe
node scripts/krsig.js extract --ref="$SP" --tag=d-gm8 --va=Move=0x4030a8 --va=_LStrClr=0x405934 \
  --va=_LStrAsg=0x405988 --va=_InitializeRecord=0x406448 --va=_FinalizeRecord=0x4064e8 \
  --va=_FinalizeArray=0x406534 --va=_CopyRecord=0x40674c --body=96 --out=sigs/delphi.json
jq -s 'add' sigs/msvc.json sigs/static.json sigs/delphi.json > sigs/all.json
jq length sigs/all.json
