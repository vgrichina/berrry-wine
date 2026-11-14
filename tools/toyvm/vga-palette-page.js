'use strict';

// VGA attribute paging, independent of guest execution and DAC contents.
// IBM PS/2 BIOS Interface (Apr 1987), INT 10h/1013, p. 2-21;
// IBM VGA/XGA Technical Reference (May 1992), pp. 2-92, 2-96.
// Callers must exclude BIOS mode 13h: it does not support this service.
function selectPalettePage(attr, bx) {
  const bl = bx & 0xFF, bh = (bx >>> 8) & 0xFF;
  if (bl === 0 && bh <= 1) {
    // Selecting the paging mode does not select a new page or load colours.
    attr[0x10] = (attr[0x10] & 0x7F) | (bh << 7);
    return true;
  }
  if (bl === 1) {
    const sixteen = (attr[0x10] & 0x80) !== 0;
    if (bh > (sixteen ? 15 : 3)) return false;
    // The low two Color Select bits are unused in 64-register mode.
    // Like a VGA BIOS page write, write the four-bit register as a whole.
    attr[0x14] = sixteen ? bh : bh << 2;
    return true;
  }
  // Outside the documented input domain; no invented BIOS success semantics.
  return false;
}

// Four-plane pixel -> attribute palette -> eight-bit DAC address. Defaults
// preserve older geometry objects that only carry the sixteen palette bytes.
// The 256-colour path bypasses this function entirely.
function paletteDacIndex(value, mode = 0, colorSelect = 0) {
  const low = value & ((mode & 0x80) ? 0x0F : 0x3F);
  return low | ((colorSelect & ((mode & 0x80) ? 0x0F : 0x0C)) << 4);
}

module.exports = { selectPalettePage, paletteDacIndex };
