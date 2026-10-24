 * @returns {Array<{name: string, loadAddr: number, dllMain: number, origBase: number}>}
 */
function loadDllsOwned(exports, memory, exeBytes, dlls, log, options = {}) {
  const results = [];
  const life = dllLifecycle(exports, memory);
  try {
  for (const dll of dlls) {
    const modulePath = dll.path || `C:\\${dll.name}`;
    const mapped = loadDll(exports, memory, dll.bytes, modulePath, { reference: 'temporary' });
    const { loadAddr, dllMain } = mapped;
    if (life) withDllLock(exports, () => {
      mapped.priorExeRoot = life.get(mapped.index, DLL_LIFE.EXE_ROOT);
      life.set(mapped.index, DLL_LIFE.EXE_ROOT, 1);
    });
    const thunks = exports.get_num_thunks();
    const peOff = readU32(dll.bytes, 0x3C);
    const origBase = readU32(dll.bytes, peOff + 52);
    if (log) log(`DLL: ${dll.name} at 0x${loadAddr.toString(16)}, DllMain=0x${(dllMain>>>0).toString(16)}, thunks=${thunks}, origBase=0x${origBase.toString(16)}`);
    results.push({ ...mapped, name: dll.name, loadAddr, dllMain, origBase });
  }
  patchExeImports(exports, memory, exeBytes, dlls, log);

  // Patch DLL-to-DLL imports (e.g. MFC42→MSVCRT)
  patchDllImports(exports, memory, dlls, results, log);
