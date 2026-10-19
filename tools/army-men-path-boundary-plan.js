'use strict';
// One original instruction boundary: after fullpath -> CString -> slash normalization.
// Single address avoids the runner's multi-address BATCH_SIZE=1 fallback.
const flags=['--trace-at=0x43c7ee','--trace-at-limit=8','--trace-at-mem=ebp-0x234:64,*ebx:64,ebx:4'];
const interpretation={
 address:'0x43c7ee',
 stack:'EBP-0x234 is the original native _fullpath output; CString normalization does not modify this stack buffer.',
 heap:'*[EBX] is the separately assigned and slash-normalized CString byte buffer.',
 upstream:'Both leading bytes NUL: defect already exists at/before native fullpath output, barring later unrelated stack corruption.',
 downstream:'Stack drive byte nonzero, CString drive byte NUL: assignment/copy-on-write/SetAt normalization is the next boundary to narrow.',
 clean:'Both drive bytes nonzero: corruption occurs later; neither producer is proven faulty.',
 noHit:'No TRACE-AT record is an unavailable observation, never evidence that the path was not executed.'
};
module.exports={flags,interpretation};
if(require.main===module)console.log(JSON.stringify({flags,interpretation},null,2));
