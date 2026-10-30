'use strict';

// Win16 loader status is an HINSTANCE16 below 32, not a Win32 last-error.
// Keep these failures typed: traps, unsupported host services and failed WEP
// cleanup must never be converted to an ordinary missing-library result.
class NeLoadError extends Error {
  constructor(code, message, options) {
    super(message, options);
    if (![null, 0, 2, 11].includes(code)) throw new RangeError('Invalid NE load failure');
    this.name = 'NeLoadError';
    this.guestCode = code;
  }
}

const neLoadErrorApi = { NeLoadError };
if (typeof module !== 'undefined' && module.exports) module.exports = neLoadErrorApi;
else globalThis.NeLoadErrorApi = neLoadErrorApi;
