'use strict';
// Source-only plan; no game launch, writes, or automated menu input.
const apiNames=['FindFirstFileA','FindNextFileA','FindClose','GetFullPathNameA','SetCurrentDirectoryA','CreateFileA','ReadFile'];
const memorySpecs=['FindFirstFileA:0:128','GetFullPathNameA:0:128','SetCurrentDirectoryA:0:128','CreateFileA:0:128'];
const hostNames=['fs_find_first_file','fs_find_next_file','fs_get_full_path_name','fs_set_current_directory'];
const flags=['--trace-fs','--trace-api='+apiNames.join(','),'--trace-api-mem='+memorySpecs.join(','),'--trace-host='+hostNames.join(','),'--trace-at=0x43c754','--trace-at-limit=8','--trace-at-mem=ecx:4,*ecx:64,esp:8'];
const interpretation={
 boundary:'43c754 is before the original SetAt thunk call; ECX is the CString object; *ECX its current buffer; ESP DWORDs are index then character.',
 expected:'The original failed-validation branch supplies index=0 and character=0. Correlate object/pointer with the later SetCurrentDirectoryA argument in the same run.',
 distinction:'FindFirstFileA INVALID_HANDLE means initial enumeration failed; successful first then failed native _fullpath can also make MFC FindFile return false; FindNextFileA zero means no further result or error.',
 limits:'Native MFC/CRT bodies are not emulated API traces. Host wrapper returns complement entry-only API parameter dumps. No hit is unavailable, not proof the branch did not execute. Eight boundary captures maximum; raw log remains capped at 4 MiB.',
 scope:'No claim that the prior AVI transition caused BootCamp failure. Startup captures are intentional; inspect menu before any ordinary BootCamp click, stop first result/failure under reviewed controller guards.'
};
module.exports={apiNames,memorySpecs,hostNames,flags,interpretation};
if(require.main===module)console.log(JSON.stringify({flags,interpretation},null,2));
