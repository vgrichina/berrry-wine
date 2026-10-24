#!/usr/bin/env python3
"""Print the unexecuted original-game argv. Never launches or installs anything."""
import json,pathlib
H=pathlib.Path(__file__).parent
if __name__=='__main__':
 base='/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23'
 game='/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a'
 module='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm'
 dll=[game+'/'+x for x in ['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll']]
 dll+=['/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll','/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll']
 argv=['node','--max-old-space-size=512',base+'/test/run.js','--no-build','--wasm='+module,'--exe='+game+'/airstrike-pre6a.exe','--dlls='+','.join(dll),'--vfs-include=airstrikerc','--vfs-include=data/**/*','--cwd=C:\\','--quiet-api','--no-threads','--memory-mb=512','--max-seconds=60','--max-batches=200000','--batch-size=20000','--tick-ms-per-batch=5']
 print(json.dumps({'status':'UNEXECUTED; NOT a runnable/admitted recovery on the sparse donor','argv':argv,'requiredBeforeExecution':['coordinator assignment and live box lifecycle','complete exact historical harness materialization plus pinned pngjs7.0.0 from an authorized existing retained supplier; downloads/installs remain prohibited','fresh two-host allocation/free-space and memory checks','same-task full import/region ABI and runtime-data/codec validation','90second CPU/wall group supervisor,512MiB oldspace,one fixed512MiB arena,TERM then5second KILL/reap','observe startup before scheduling Enter/held movement/fire; matched keyup; separated captures','preserve evidence and publish result metadata last with actual candidate identity']},indent=2))
