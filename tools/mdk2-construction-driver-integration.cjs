'use strict';

// Offline-testable composition of the retained original guarded driver.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..');
const RUNS = path.join(ROOT, 'scratch/runs');
const SOURCE = '1329b1ba6eb00144ff77d4cd92a8513d4fc953ad';
const OBSERVER = 'de6a33f257d93e8814d666bdec62361161569ac4';
const OBSERVER_REPAIR_SHA256 = '341f705e65d292ab014146af0594cc0531913428f14b0f47a125f7fba4acf0cb';
const DRIVER = '20261104-mdk2-fresh-pending-scene/browser-driver.cjs';
const MAIN = '20261104-mdk2-post-lua-native-boundary/main-state.cjs';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const CLOSURE = Object.freeze({
  '20261104-mdk2-measured-escape-original/launch.cjs': 'db81fbe5abc6cc065e79739eee730735132b52e91ef6441a390d185ff9bad66e',
  '20261104-mdk2-measured-escape-original/endpoint-preflight.cjs': 'c41b3ae1b56af801540e2464cb26e1d5e4833babfda622992c21624f612999eb',
  '20261104-mdk2-measured-escape-original/next.py': '6fe23ef43aaa7d5441c7a131ace23a75ab06ed406ebb014e9313e8c4375a5035',
  '20261104-mdk2-measured-escape-original/control.py': 'c6e5fb27f430b74ea21d18201da80b3c21411359742c3ac5ffce098ad5643e32',
  [MAIN]: 'a5e74ab20befce8196c654886b8597ed7da1cb5fddd22efada161e02a7822e32',
  '20261104-mdk2-explicit-capture-native-onward/driver-wrapper.cjs': 'b5f85284acebec7339786c655f56929954cd8212e64bce3ff71fcc65f071e787',
  '20261104-mdk2-explicit-capture-native-onward/read-only.cjs': 'b5428b5ef914c34dbad89cd1f3dfcefd79f799cdf8080189ac89a9303fa7ebb0',
  [DRIVER]: '4a888df46221def0396b2b6be5e52ff2423cdb26714de50127f36a807b04086c',
  '20261104-mdk2-fresh-pending-scene/observe-browser.js': '12cedfe958c4fe2acc11dfdaf4a7e06843d4826b1cc0bd0bcf92639a161e7f7a',
  '20261104-mdk2-fresh-pending-scene/native-readiness.cjs': '3d1f97e39e56d95038344e519efb0321e8ed02feb7dcb87e535d8abffe493e71',
  '20261104-mdk2-fresh-pending-scene/native-opening.cjs': '04ecc705c539cb024744002ad9c4af3cf5736b5571644a405aeac414ed4be644',
  '20261104-mdk2-fresh-pending-scene/native-menu.cjs': '1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed',
  '20261104-mdk2-fresh-pending-scene/opening-boundary.cjs': '52f06bacd248e07d7c9d774b51eaf17637fa825a548900f57908f97e624ccacd',
  '20261104-mdk2-fresh-pending-scene/finite-deadline.cjs': '7a6ef003de6014c10bdff9d6485d2ceeee55101cc80068fa31dbf86982580ff7',
  '20261104-mdk2-fresh-pending-scene/inspection-guard.cjs': '3770e1569569257c009fa055ea878df591f2fb35ad84d48d2d3908bf15924dec',
});
// Exact run-helper closure, including the repaired measured Escape and operator chain.
const HELPERS = Object.freeze({
  "20261104-mdk2-measured-escape-original/endpoint-preflight.cjs": "c41b3ae1b56af801540e2464cb26e1d5e4833babfda622992c21624f612999eb",
  "20261104-mdk2-measured-escape-original/operator.py": "fca307d4f9d121682ada6f1045b50eb4d400b2e8524fd4aa92d5eca1e343c533",
  "20261104-mdk2-measured-escape-original/verified_inputs.py": "b3cded24f3a947401421007947fb6bcec740c122b065ab6c463f44ec118257c6",
  "20261104-mdk2-measured-escape-original/verified-fs.cjs": "9c9fb129b6573291d279b8389892b7961854ca6160517ffa6f6eadea1dfab7a0",
  "20261104-mdk2-measured-escape-original/next.py": "6fe23ef43aaa7d5441c7a131ace23a75ab06ed406ebb014e9313e8c4375a5035",
  "20261104-mdk2-measured-escape-original/launch.py": "32ded67358fdfe2f1d6bcfabf528d29e06e8446290068b4021fcc01f6ebdb18a",
  "20261104-mdk2-measured-escape-original/personal.py": "018dd88fd56022a82f0f23a233d4725e7fd9f656488f263e75d422390df37760",
  "20261104-mdk2-measured-escape-original/closure.py": "cc3e3633457fac8ca962c6a7de8405738312b6d5b5fb7068e165d45c722d3d9f",
  "20261104-mdk2-measured-escape-original/readiness.cjs": "4a8acf77ccc140edb0cebc26bd7ee0803063929611cd999679d18f129cf10add",
  "20261104-mdk2-measured-escape-original/control.py": "c6e5fb27f430b74ea21d18201da80b3c21411359742c3ac5ffce098ad5643e32",
  "20261104-mdk2-measured-escape-original/prebrowser.cjs": "ad33dc2bc807b83187a788bc6bef7e3a02501f1488b724cb6212a4c431841759",
  "20261104-mdk2-measured-escape-original/verify_closed.py": "97fd42d09b2ba03216d3a3680546f70e321dcf6e31a2236e20cd1dc7a434dcbd",
  "20261104-mdk2-measured-escape-original/qualify.py": "0f1b5dc8ee28c46c0ade44165bb9e43d921c377e6d8f792f4804ff8ab7069c09",
  "20261104-mdk2-measured-escape-original/runtime_io.py": "fa10aff606222c5ee2dfc17e5d70ff0c8d7ff5fba5f4880a2913f4310106d52e",
  "20261104-mdk2-measured-escape-original/author.py": "0e4e139b6fd3e6f2eae9fe3e759ac41c6a70d9f8e37cd27d128b0edbaf472cf9",
  "20261104-mdk2-measured-escape-original/recover.py": "3df24961b885d9843dbf9e522e45cfa155e03b11961e60f29cbb5369b70be29e",
  "20261104-mdk2-measured-escape-original/native-menu.cjs": "470e9f4b6de50155ca03711c6850698f232d00908ae5723635dee4bf1fada052",
  "20261104-mdk2-measured-escape-original/launch.cjs": "db81fbe5abc6cc065e79739eee730735132b52e91ef6441a390d185ff9bad66e",
  "20261104-mdk2-adequate-lifetime-menu/cinematic-review.cjs": "cd1f4a24f52e16c5958277e0e1d1aac4376c34da086d0bacbc32182ead058e3b",
  "20261104-mdk2-adequate-lifetime-menu/browser-driver.cjs": "4a888df46221def0396b2b6be5e52ff2423cdb26714de50127f36a807b04086c",
  "20261104-mdk2-adequate-lifetime-menu/postclose.py": "a295a991e1df976f33bb98b4fd42486b31bb6a3d847e29b1701133f3e90c04e6",
  "20261104-mdk2-adequate-lifetime-menu/repaired-suite.cjs": "dbbadcf8437061bee0a988a835795a126e9e83a43f6fecf96ab05864108f7c26",
  "20261104-mdk2-adequate-lifetime-menu/opening-boundary.cjs": "52f06bacd248e07d7c9d774b51eaf17637fa825a548900f57908f97e624ccacd",
  "20261104-mdk2-adequate-lifetime-menu/memory-fixture.cjs": "6ece6e6006294ca52bcbbae9fb8e70a14b3186906d7f7f1bc8700ac1a45c9b72",
  "20261104-mdk2-adequate-lifetime-menu/native-readiness.cjs": "3d1f97e39e56d95038344e519efb0321e8ed02feb7dcb87e535d8abffe493e71",
  "20261104-mdk2-adequate-lifetime-menu/native-opening.cjs": "04ecc705c539cb024744002ad9c4af3cf5736b5571644a405aeac414ed4be644",
  "20261104-mdk2-adequate-lifetime-menu/construction-control.cjs": "b8176b7c3a923a02630f65f9df1edf9b8117ccbca82f0fe83727c71dd3d374d2",
  "20261104-mdk2-adequate-lifetime-menu/inspect-original.cjs": "109ca3da742fd7a5df8bd30568183174ba057beaf166e1724c003dff600dc320",
  "20261104-mdk2-adequate-lifetime-menu/movie-boundary-repaired.cjs": "637507b0d72eb41d0ddeaf1e8120a4386ba3be118f4b32e023bf5f3256f764f4",
  "20261104-mdk2-adequate-lifetime-menu/scene-transition.cjs": "86d8c9a7ede50f6fc8fb03ed6ca7c8119524c1bc0855ef01e7dc8932365afd5d",
  "20261104-mdk2-adequate-lifetime-menu/author-review.py": "739b1a60ec46739bc7ac5169cc866be277767a3b406214b24781599d2043fe17",
  "20261104-mdk2-adequate-lifetime-menu/observe-browser.js": "12cedfe958c4fe2acc11dfdaf4a7e06843d4826b1cc0bd0bcf92639a161e7f7a",
  "20261104-mdk2-adequate-lifetime-menu/process-preflight.py": "e8071ae8d5f5a948749a0f293737ea46d801647371cd5a8c8bed26cc2a5fad48",
  "20261104-mdk2-adequate-lifetime-menu/next.py": "c4e29a5cf1e17f0724807e71c2f5c126cb1f1a2f88e7bc78036eff12611e42a5",
  "20261104-mdk2-adequate-lifetime-menu/candidate-suite.cjs": "6d54713ca14b8624d741b107d876a473e2d6b4620ea0f109331436147916d958",
  "20261104-mdk2-adequate-lifetime-menu/launch.py": "df382011ae44360b29aa81e2b80e58665bf31dbbeb0c81dc98e6b4a8ca2c2676",
  "20261104-mdk2-adequate-lifetime-menu/ack-control.cjs": "86d0b0fe1af7311e45b72a66a931e83c7fd6f96a791e5311a5b124bc9d6c5a17",
  "20261104-mdk2-adequate-lifetime-menu/validate.py": "850f05a713b748813b1c3703ba60eba61a2aabec2a40a18bb2f7d57bdace80e8",
  "20261104-mdk2-adequate-lifetime-menu/control.py": "edfdcf38dbd4e9c5da68cf6096ba3fd538e42aab8365a103cda2c3a1e81afd15",
  "20261104-mdk2-adequate-lifetime-menu/prebrowser.cjs": "49d2d656ba7738bc955967eae6355fd6509f4b8dce1dac445e23cedafa590179",
  "20261104-mdk2-adequate-lifetime-menu/cache-preflight.cjs": "b0857f6a1622877fc91c18af408ebbd71d0dee35a94a128c50ab0d4dd0e7ab5f",
  "20261104-mdk2-adequate-lifetime-menu/comic-control.cjs": "820dd72ffedbcd3478bbcda2e6bd33440410a5fd3e7b91cd39c4574bef6e2484",
  "20261104-mdk2-adequate-lifetime-menu/stage.py": "914d4b24edb15401cac648e672e6110a85dad2d9859a505b6878f9a100df5423",
  "20261104-mdk2-adequate-lifetime-menu/runtime_io.py": "41e00b3095fddbfbfca809933e58ad690992f7bba5347834fd1134be20702874",
  "20261104-mdk2-adequate-lifetime-menu/movie-boundary-old.cjs": "c81330dfd5367e878bd1bab44dd16531d19426acaa91d6ff1287a7861c1c9500",
  "20261104-mdk2-adequate-lifetime-menu/movie-boundary.cjs": "637507b0d72eb41d0ddeaf1e8120a4386ba3be118f4b32e023bf5f3256f764f4",
  "20261104-mdk2-adequate-lifetime-menu/recover.py": "a74efac25f15036d851969808b78677967d934d490aaf6c0101d0fbc288c7123",
  "20261104-mdk2-adequate-lifetime-menu/finite-deadline.cjs": "7a6ef003de6014c10bdff9d6485d2ceeee55101cc80068fa31dbf86982580ff7",
  "20261104-mdk2-adequate-lifetime-menu/preflight-current.py": "875c9d96b3b2bbc734ed94f866ca8eab95c4eb2afc41d8a7242c46f3aa8267f0",
  "20261104-mdk2-adequate-lifetime-menu/preflight-input-review.cjs": "15277613557af2b911b8384dacf263cb86ebb5e59eae6077b1a23a453cff6d87",
  "20261104-mdk2-adequate-lifetime-menu/opening-complete-control.cjs": "d97ec202586637e61df87701e4b59dc42f9797cd5c8ccf0aa9eebaa37b5cabb4",
  "20261104-mdk2-adequate-lifetime-menu/native-menu.cjs": "1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed",
  "20261104-mdk2-adequate-lifetime-menu/inspection-guard.cjs": "3770e1569569257c009fa055ea878df591f2fb35ad84d48d2d3908bf15924dec",
  "20261104-mdk2-adequate-lifetime-menu/cache-checker.cjs": "e7044e9e609581e757da476a016a51233fc502ccbfe2b9d87a7568c8726fc638",
  "20261104-mdk2-unhighlighted-menu-onward/prepare.py": "4d9ea83849220b0d0fb53e225b3ec69e1febb460dbc0fe08ffa5e0f99142b2ad",
  "20261104-mdk2-unhighlighted-menu-onward/unhighlighted-control.cjs": "b116e469f472a79affd4757850cfc509b618f7c665a3707c1a282b403821a6c7",
  "20261104-mdk2-unhighlighted-menu-onward/driver-wrapper.cjs": "1a4ef218dc5b8ce35c9713605a540ab2b1e37e6d260f7813529d0d5195479a2d",
  "20261104-mdk2-unhighlighted-menu-onward/recover-first-failure.py": "bffc2933d7ec146417632c18217a400141d33be0e2270bebff682d6fb296e893",
  "20261104-mdk2-unhighlighted-menu-onward/next.py": "4597a7665bbd7c06550a195ae12690506035c166efb3d86ea05f4e83a8358982",
  "20261104-mdk2-unhighlighted-menu-onward/launch.py": "720ef540660f541bb3a8099b3c64700d369c6ce5a50678d9def13a4b5c4a655d",
  "20261104-mdk2-unhighlighted-menu-onward/control.py": "ad0eb94227871d31dc56205d462fa89ae3f0bca923adde25d3c020f8c1d8ceff",
  "20261104-mdk2-unhighlighted-menu-onward/runtime_io.py": "f4bfe1258bc746e5c6ea2b5e877d9eec485f23676e967ae268e013103265c2f6",
  "20261104-mdk2-pending-scheme-cause/provenance.cjs": "68a819c8183dccf0a3312ce1a3bbcc6eebf710a5df1bc70f72264e46954735db",
  "20261104-mdk2-pending-scheme-cause/next.py": "4597a7665bbd7c06550a195ae12690506035c166efb3d86ea05f4e83a8358982",
  "20261104-mdk2-pending-scheme-cause/phase-gate.cjs": "67b0eba42cb49d2608db868d6f6f639a4607b59103d48d00f02b0980d6379956",
  "20261104-mdk2-pending-scheme-cause/transition-evidence.cjs": "e15bc67f97f62558a5e6ba9ebfe49b499ad2710171ce3f552df4347c3d019cf2",
  "20261104-mdk2-pending-scheme-cause/control.py": "47feb512a1fc5b98abbec828a1832a2b44a5cb915e3d19007082aab20a6312d9",
  "20261104-mdk2-pending-scheme-cause/pending-control.cjs": "8d96656540eb39a873e50ce5bb006dd8b51524a26d6177e915c7305c5448fbb0",
  "20261104-mdk2-pending-scheme-cause/inspect-cause.cjs": "07350dd5d3e383241b641caf6dd70ec294b3db1fbbbf08af04db0fd8cc7a9d24",
  "20261104-mdk2-fresh-pending-scene/cinematic-review.cjs": "cd1f4a24f52e16c5958277e0e1d1aac4376c34da086d0bacbc32182ead058e3b",
  "20261104-mdk2-fresh-pending-scene/browser-driver.cjs": "4a888df46221def0396b2b6be5e52ff2423cdb26714de50127f36a807b04086c",
  "20261104-mdk2-fresh-pending-scene/postclose.py": "a295a991e1df976f33bb98b4fd42486b31bb6a3d847e29b1701133f3e90c04e6",
  "20261104-mdk2-fresh-pending-scene/repaired-suite.cjs": "dbbadcf8437061bee0a988a835795a126e9e83a43f6fecf96ab05864108f7c26",
  "20261104-mdk2-fresh-pending-scene/opening-boundary.cjs": "52f06bacd248e07d7c9d774b51eaf17637fa825a548900f57908f97e624ccacd",
  "20261104-mdk2-fresh-pending-scene/memory-fixture.cjs": "6ece6e6006294ca52bcbbae9fb8e70a14b3186906d7f7f1bc8700ac1a45c9b72",
  "20261104-mdk2-fresh-pending-scene/native-readiness.cjs": "3d1f97e39e56d95038344e519efb0321e8ed02feb7dcb87e535d8abffe493e71",
  "20261104-mdk2-fresh-pending-scene/native-opening.cjs": "04ecc705c539cb024744002ad9c4af3cf5736b5571644a405aeac414ed4be644",
  "20261104-mdk2-fresh-pending-scene/construction-control.cjs": "b8176b7c3a923a02630f65f9df1edf9b8117ccbca82f0fe83727c71dd3d374d2",
  "20261104-mdk2-fresh-pending-scene/inspect-original.cjs": "109ca3da742fd7a5df8bd30568183174ba057beaf166e1724c003dff600dc320",
  "20261104-mdk2-fresh-pending-scene/movie-boundary-repaired.cjs": "637507b0d72eb41d0ddeaf1e8120a4386ba3be118f4b32e023bf5f3256f764f4",
  "20261104-mdk2-fresh-pending-scene/scene-transition.cjs": "86d8c9a7ede50f6fc8fb03ed6ca7c8119524c1bc0855ef01e7dc8932365afd5d",
  "20261104-mdk2-fresh-pending-scene/author-review.py": "0bccb287355857fa31896805d9e9da427572743e34a4f4c4ed1b4d59fca9be74",
  "20261104-mdk2-fresh-pending-scene/observe-browser.js": "12cedfe958c4fe2acc11dfdaf4a7e06843d4826b1cc0bd0bcf92639a161e7f7a",
  "20261104-mdk2-fresh-pending-scene/process-preflight.py": "e8071ae8d5f5a948749a0f293737ea46d801647371cd5a8c8bed26cc2a5fad48",
  "20261104-mdk2-fresh-pending-scene/next.py": "42e4f2a6bd5ef2856f02a717300d5678759cb2a9afefad2a3f25c823ec3b8c19",
  "20261104-mdk2-fresh-pending-scene/candidate-suite.cjs": "6d54713ca14b8624d741b107d876a473e2d6b4620ea0f109331436147916d958",
  "20261104-mdk2-fresh-pending-scene/launch.py": "df382011ae44360b29aa81e2b80e58665bf31dbbeb0c81dc98e6b4a8ca2c2676",
  "20261104-mdk2-fresh-pending-scene/ack-control.cjs": "86d0b0fe1af7311e45b72a66a931e83c7fd6f96a791e5311a5b124bc9d6c5a17",
  "20261104-mdk2-fresh-pending-scene/validate-fresh.py": "fede122cd044c98de0d4f7bd558439159900732e911828d7e489feeea6c1bc2a",
  "20261104-mdk2-fresh-pending-scene/phase-gate.cjs": "67b0eba42cb49d2608db868d6f6f639a4607b59103d48d00f02b0980d6379956",
  "20261104-mdk2-fresh-pending-scene/transition-evidence.cjs": "7fa39bd66d0b0c25b5bd03c66e8e9a7c76faef8a21e8107a6d62750c34dcd98d",
  "20261104-mdk2-fresh-pending-scene/control.py": "df82ec74961d28e74f5e9c31c8766c06a98affd0f1ae470534ebca9fe55876b5",
  "20261104-mdk2-fresh-pending-scene/prebrowser.cjs": "49d2d656ba7738bc955967eae6355fd6509f4b8dce1dac445e23cedafa590179",
  "20261104-mdk2-fresh-pending-scene/cache-preflight.cjs": "b0857f6a1622877fc91c18af408ebbd71d0dee35a94a128c50ab0d4dd0e7ab5f",
  "20261104-mdk2-fresh-pending-scene/pending-control.cjs": "8d96656540eb39a873e50ce5bb006dd8b51524a26d6177e915c7305c5448fbb0",
  "20261104-mdk2-fresh-pending-scene/comic-control.cjs": "820dd72ffedbcd3478bbcda2e6bd33440410a5fd3e7b91cd39c4574bef6e2484",
  "20261104-mdk2-fresh-pending-scene/stage.py": "914d4b24edb15401cac648e672e6110a85dad2d9859a505b6878f9a100df5423",
  "20261104-mdk2-fresh-pending-scene/runtime_io.py": "3beda02c000d830b3af049fa5ba98eb23e7dbae926415b0afe1310438a6cdc85",
  "20261104-mdk2-fresh-pending-scene/movie-boundary-old.cjs": "c81330dfd5367e878bd1bab44dd16531d19426acaa91d6ff1287a7861c1c9500",
  "20261104-mdk2-fresh-pending-scene/movie-boundary.cjs": "637507b0d72eb41d0ddeaf1e8120a4386ba3be118f4b32e023bf5f3256f764f4",
  "20261104-mdk2-fresh-pending-scene/recover.py": "a74efac25f15036d851969808b78677967d934d490aaf6c0101d0fbc288c7123",
  "20261104-mdk2-fresh-pending-scene/finite-deadline.cjs": "7a6ef003de6014c10bdff9d6485d2ceeee55101cc80068fa31dbf86982580ff7",
  "20261104-mdk2-fresh-pending-scene/preflight-current.py": "875c9d96b3b2bbc734ed94f866ca8eab95c4eb2afc41d8a7242c46f3aa8267f0",
  "20261104-mdk2-fresh-pending-scene/preflight-input-review.cjs": "15277613557af2b911b8384dacf263cb86ebb5e59eae6077b1a23a453cff6d87",
  "20261104-mdk2-fresh-pending-scene/opening-complete-control.cjs": "d97ec202586637e61df87701e4b59dc42f9797cd5c8ccf0aa9eebaa37b5cabb4",
  "20261104-mdk2-fresh-pending-scene/native-menu.cjs": "1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed",
  "20261104-mdk2-fresh-pending-scene/inspection-guard.cjs": "3770e1569569257c009fa055ea878df591f2fb35ad84d48d2d3908bf15924dec",
  "20261104-mdk2-fresh-pending-scene/cache-checker.cjs": "e7044e9e609581e757da476a016a51233fc502ccbfe2b9d87a7568c8726fc638"
});
function gitFile(commit, file) {
  return cp.execFileSync('git', ['show', `${commit}:${file}`], {cwd: ROOT, maxBuffer: 2000000});
}
function verifyClosure(read = file => fs.readFileSync(path.join(RUNS, file))) {
  const rows = [];
  for (const [file, expected] of Object.entries({...CLOSURE, ...HELPERS})) {
    const bytes = read(file);
    assert.equal(sha(bytes), expected, `retained closure mismatch: ${file}`);
    rows.push({path: file, bytes: bytes.length, sha256: expected});
  }
  const file = 'tools/mdk2-lua-construction-observer.cjs';
  assert.equal(sha(gitFile(OBSERVER, file)), '3692d60b20d38d00ac6bd57994cdbd669e5839ba482fee1f1e36edabf18ea248', 'original observer changed');
  assert.equal(sha(fs.readFileSync(path.join(ROOT, file))), OBSERVER_REPAIR_SHA256, 'published observer repair changed');
  return rows;
}
function pinnedRuntime() {
  // Decode in memory; no modules/media/source snapshots are written.
  const b = zlib.gunzipSync(fs.readFileSync(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/runtime-pins.json.gz')));
  const inventory = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/seal.json.gz'))));
  const row = (Array.isArray(inventory) ? inventory : inventory.files).find(x => x.path === 'runtime-pins.json');
  assert(row, 'missing original pins inventory');
  assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256);
  assert.equal(sha(b), '4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed');
  const pins = JSON.parse(b);
  assert.equal(pins.commit, SOURCE); assert.equal(pins.files.length, 432);
  const files = {};
  for (const name of ['host.js', 'lib/guest-worker.js', 'lib/guest-rpc.js', 'lib/guest-thread-host.js']) {
    const original = gitFile(SOURCE, name), pin = pins.files.find(x => x.path === name);
    assert(pin, `missing original dependency ${name}`);
    assert.equal(original.length, pin.bytes); assert.equal(sha(original), pin.sha256);
    files[name] = original.toString();
  }
  return {pins, files, pinsSHA256: sha(b)};
}
// This function is serialized verbatim into page and paused Worker realms.
// Metadata travels on the existing init message; no additional guest command.
function installBinding(options) {
  const g = globalThis, key = '__mdk2BoundTrace';
  if (g[key] || g.__mdk2Observe?.events?.some(e => ['received-module', 'instantiated', 'compiled'].includes(e.kind)))
    throw Error('late or duplicate binding hook');
  const isPage = typeof document !== 'undefined', seen = new WeakMap(), received = new WeakMap();
  if (!isPage && new URL(options.workerURL).pathname !== '/lib/guest-worker.js') {
    const report = () => ({realm:'worker',targetId:options.targetId,workerURL:options.workerURL,binding:null,fatal:null,skipped:'non-guest Worker'});
    return g[key] = {report, invoke:report};
  }
  const audit = [], allowed = options.moduleHashes;
  let fatal = null, entry = null, receivedOnce = false, started = false, terminal = false, timer = null, traced = false, observer = null;
  const report = () => ({realm: isPage ? 'page' : 'worker', targetId: options.targetId || null,
    workerURL: options.workerURL || null, fatal, started, terminal, traced,
    binding: entry?.binding || null, thread: entry?.instance?.exports.get_current_thread_id?.(),
    observer: observer?.report || null, audit});
  function stop(reason) {
    terminal = true; clearTimeout(timer);
    if (traced) { traced = false; entry.instance.exports.set_trace_esp(0, 0, 0); }
    observer?.finish(reason);
    return report();
  }
  function fail(reason) { fatal ||= reason; stop('binding-failure'); throw Error(fatal); }
  const add = row => { if (audit.length >= 128) fail('binding audit limit'); audit.push(row); };
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const compile = WebAssembly.compile;
  WebAssembly.compile = async function(bytes, ...args) {
    // Copy before hashing/compiling so mutation across await cannot change identity.
    const copy = bytes instanceof ArrayBuffer ? new Uint8Array(bytes.slice(0)) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice();
    const sha256 = await digest(copy), module = await Reflect.apply(compile, this, [copy, ...args]);
    const row = {kind: 'compiled', sha256, bytes: copy.byteLength, compilation: audit.length};
    seen.set(module, row); add(row); return module;
  };
  if (isPage) {
    const NativeWorker = Worker, post = NativeWorker.prototype.postMessage, urls = new WeakMap();
    let owningSend = false;
    g.Worker = new Proxy(NativeWorker, {construct(target, args, newTarget) {
      const worker = Reflect.construct(target, args, newTarget); urls.set(worker, new URL(String(args[0]), location.href).href); return worker;
    }});
    NativeWorker.prototype.postMessage = function(message, ...args) {
      if (message?.t === 'init' && message.module instanceof WebAssembly.Module && message.slot === 0) {
        if (owningSend) fail('ambiguous or replacement slot0 init');
        const compiled = seen.get(message.module), workerURL = urls.get(this);
        if (!compiled || !allowed.includes(compiled.sha256) || !workerURL || new URL(workerURL).pathname !== '/lib/guest-worker.js') fail('foreign or unhashed owning Module');
        if (Object.hasOwn(message, '__mdk2Binding')) fail('preexisting binding metadata');
        owningSend = true;
        const binding = {...compiled, kind: 'sent', workerURL, slot: 0, endpointIdentity: message.endpointIdentity};
        add(binding);
        // A new envelope, with the identical Module, memory, and original fields.
        return Reflect.apply(post, this, [{...message, __mdk2Binding: binding}, ...args]);
      }
      return Reflect.apply(post, this, [message, ...args]);
    };
  } else {
    if (typeof addEventListener !== 'function') throw Error('Worker message hook unavailable');
    addEventListener('message', event => {
      const message = event.data;
      if (message?.t !== 'init' || !(message.module instanceof WebAssembly.Module)) return;
      if (entry || receivedOnce || received.has(message.module)) fail('replacement or duplicate Worker init');
      if (message.slot !== 0) { receivedOnce = true; add({kind: 'foreign-slot', slot: message.slot}); return; }
      const b = message.__mdk2Binding;
      if (!b || b.kind !== 'sent' || b.slot !== 0 || !allowed.includes(b.sha256) ||
          b.endpointIdentity !== message.endpointIdentity || b.workerURL !== options.workerURL ||
          !Number.isInteger(b.compilation) || !Number.isInteger(b.bytes)) fail('foreign or missing transferred Module binding');
      receivedOnce = true; received.set(message.module, Object.freeze({...b})); add({...b, kind: 'received'});
    });
  }
  const instantiate = WebAssembly.instantiate;
  WebAssembly.instantiate = async function(module, imports, ...args) {
    if (isPage) return Reflect.apply(instantiate, this, [module, imports, ...args]);
    const binding = received.get(module);
    // Other Worker slots retain their ordinary, unobserved instance.
    if (!binding) {
      if (audit.some(row => row.kind === 'foreign-slot') && !entry) return Reflect.apply(instantiate, this, [module, imports, ...args]);
      return fail('unbound or foreign instantiation');
    }
    if (entry || terminal || !imports?.host || typeof imports.host.log_block !== 'function') return fail('late or replacement owning instantiation');
    entry = {binding, module, instance: null, installedBeforeInstantiation: true};
    // The wrapper exists before the native instantiate call. Attachment remains
    // dormant until the driver authorizes its sole construction quantum.
    const original = imports.host.log_block;
    const host = {log_block: original};
    imports.host.log_block = function(...values) {
      if (!traced) return Reflect.apply(original, this, values);
      let result;
      try { result = Reflect.apply(host.log_block, this, values); }
      catch (error) { fatal ||= String(error); stop('original-import-failure'); throw error; }
      if (observer.report.status !== 'running') {
        const status = observer.report.status;
        if (observer.report.error) fatal ||= observer.report.error;
        stop(status);
      }
      if (traced && (observer.report.blocks >= 100000 || observer.report.records.length >= 512))
        stop(observer.report.blocks >= 100000 ? 'boundary-limit' : 'record-limit');
      return result;
    };
    entry.host = host;
    try {
      const result = await Reflect.apply(instantiate, this, [module, imports, ...args]);
      entry.instance = result.instance || result; add({kind: 'installed-before-instantiation', sha256: binding.sha256}); return result;
    } catch (error) { fatal ||= String(error); stop('instantiation-failure'); throw error; }
  };
  function invoke(action, row = {}) {
    if (action === 'report') return report();
    if (action === 'finish') {
      if (observer?.report.status === 'running') { observer.sample(); observer.check(); }
      if (observer?.report.error) fatal ||= observer.report.error;
      return stop(row.reason || 'driver-finish');
    }
    if (action !== 'start') throw Error('unknown trace operation');
    if (fatal || terminal || started || !entry?.instance) return fail('trace cannot restart or bind late');
    const ex = entry.instance.exports;
    if (ex.get_current_thread_id() !== 1 || ex.get_image_base() !== 0x400000 || typeof ex.set_trace_esp !== 'function') return fail('wrong owning instance/thread/loader');
    const end = Math.min(row.commandEnd, row.absoluteEnd, Date.now() + 10000);
    if (!Number.isFinite(end) || end <= Date.now()) return fail('trace deadline');
    started = true;
    observer = g.Mdk2LuaConstructionObserver.attach({host: entry.host, getExports: () => entry.instance.exports,
      workerSlot: 0, exeSha256: g.Mdk2LuaConstructionObserver.EXE_SHA256, wasmSha256: entry.binding.sha256,
      now: Date.now, deadline: end}); // Published smaller defaults: 100000 / 512.
    observer.sample();
    if (observer.report.error || observer.report.status !== 'running') return fail(observer.report.error || 'initial sample failed');
    traced = true; ex.set_trace_esp(1, 0, 0);
    timer = setTimeout(() => stop('deadline'), Math.max(0, end - Date.now())); timer.unref?.();
    return report();
  }
  g[key] = {invoke, report};
  return g[key];
}

function preloadSource(options = {}) {
  const runtime = pinnedRuntime();
  const original = fs.readFileSync(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/observe-browser.js'), 'utf8');
  const observer = fs.readFileSync(path.join(ROOT, 'tools/mdk2-lua-construction-observer.cjs'), 'utf8');
  return original + '\n' + observer + '\n;(' + installBinding.toString() + ')(' + JSON.stringify({moduleHashes: runtime.pins.moduleFiles.map(r => r.sha256), ...options}) + ');void 0;';
}

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'missing or ambiguous original composition seam: ' + before.slice(0, 80));
  return source.replace(before, after);
}

async function installBeforeFirstScript(session, expression, workerURL, absoluteEnd) {
  let settle, reject, completed = false;
  const scripts = new Map(), first = new Promise((yes, no) => {settle=yes;reject=no;});
  const parsed = row => scripts.set(row.scriptId, row.url);
  const paused = async row => {
    try {
      if (completed) throw Error('ambiguous first-script pause');
      completed = true;
      const frame = row.callFrames?.[0], url = frame && (scripts.get(frame.location?.scriptId) || frame.url);
      assert(row.reason === 'instrumentation' && frame?.callFrameId && url === workerURL, 'foreign first-script context');
      const result = await session.send('Debugger.evaluateOnCallFrame', {callFrameId:frame.callFrameId, expression, returnByValue:true});
      assert(!result.exceptionDetails, 'first-script preload failed: ' + JSON.stringify(result.exceptionDetails));
      settle();
    } catch (error) { reject(error); }
  };
  const waitMs = Math.min(30000, absoluteEnd - Date.now());
  assert(Number.isFinite(waitMs) && waitMs > 0, 'first-script absolute deadline');
  const timer = setTimeout(() => reject(Error('first-script preload deadline')), waitMs);
  session.on('Debugger.scriptParsed', parsed); session.on('Debugger.paused', paused);
  let breakpoint;
  try {
    await session.send('Runtime.enable'); await session.send('Debugger.enable');
    breakpoint = (await session.send('Debugger.setInstrumentationBreakpoint', {instrumentation:'beforeScriptExecution'})).breakpointId;
    assert(breakpoint, 'first-script breakpoint unavailable');
    // This releases startup waiting only. The instrumentation pause prevents
    // the first Worker instruction from running until the hook is installed.
    await session.send('Runtime.runIfWaitingForDebugger'); await first;
    await session.send('Debugger.removeBreakpoint', {breakpointId:breakpoint});
    await session.send('Debugger.resume'); await session.send('Debugger.disable');
  } finally {
    clearTimeout(timer); session.off('Debugger.scriptParsed', parsed); session.off('Debugger.paused', paused);
    // On error do not resume a Worker with missing observation imports.
  }
}

// Read-only queue fences, with unchanged frozen scheduling and no run/setter.
async function frozenOwnership(persistRejection = false) {
  const rows = []; let before, after;
  try {
  const w = wine; before = WineFrozen.status();
  if (!before.frozen || before.hosts !== 1 || w._frozenBudget || !w.guestWorker || !w.threadManager?.threads) throw Error('frozen owning Worker barrier unavailable');
  // guestWorker is GuestThreadHost, not WorkerLink. Its readExports delegates
  // to .link, but it has no slot/endpoint/_pending of its own.
  const host = w.guestWorker, main = host.link, manager = w.threadManager, table = manager.threads, backend = manager.workerBackend;
  if (!main || host.localMainExports || typeof main.readExports !== 'function') throw Error('main WorkerLink unavailable');
  const threads = [...table.entries()];
  const threadLinks = new Map(threads.map(([handle,t]) => [handle,t.link]));
  if (threads.some(([,t]) => t.inFlight || t.freeRunPending || t.importRetryPreparing) ||
      w.threadManager.workerBackend?._startingLinks?.size) throw Error('unfrozen Worker lifecycle');
  const links = [{handle: null, link: main}, ...threads.filter(([, t]) => t.link).map(([handle, t]) => ({handle, link: t.link}))];
  if (new Set(links.map(r => r.link)).size !== links.length) throw Error('ambiguous Worker ownership');
  const identities = links.map(({link}) => ({slot:link.slot, endpointIdentity:link.endpointIdentity, worker:link.worker, pending:link._pending}));
  const lifecycle = () => host._stopped || host._startingLinks?.size || w._guestWorkerStarting ||
    threads.some(([,t]) => t.inFlight || t.freeRunPending || t.importRetryPreparing) || manager.workerBackend?._startingLinks?.size;
  if (lifecycle()) throw Error('unfrozen Worker lifecycle');
  if (links.some(({link}) => link._stopped || !link.worker || !(link._pending instanceof Map) || link._pending.size)) throw Error('Worker queue not frozen');
  for (const {handle, link} of links) {
    const values = await link.readExports(['get_current_thread_id', 'get_eip', 'get_esp']);
    rows.push({handle, slot: link.slot, endpointIdentity: link.endpointIdentity, values});
    if (!values || ['get_current_thread_id','get_eip','get_esp'].some(k => !Number.isInteger(values[k]) || values[k] < 0 || values[k] > 0xffffffff)) throw Error('malformed Worker exports');
  }
  after = WineFrozen.status();
  if (w.guestWorker !== host || host.link !== main || w.threadManager !== manager || manager.threads !== table || manager.workerBackend !== backend || lifecycle() ||
      JSON.stringify([...w.threadManager.threads.keys()]) !== JSON.stringify(threads.map(([h]) => h)) ||
      threads.some(([handle,t]) => w.threadManager.threads.get(handle) !== t || t.link !== threadLinks.get(handle) || t.inFlight || t.freeRunPending || t.importRetryPreparing) ||
      w.threadManager.workerBackend?._startingLinks?.size ||
      links.some(({link},i) => link._stopped || link._pending !== identities[i].pending || link._pending?.size || link.worker !== identities[i].worker || link.slot !== identities[i].slot || link.endpointIdentity !== identities[i].endpointIdentity) || w._frozenBudget ||
      JSON.stringify(before) !== JSON.stringify(after)) throw Error('changed all-Worker frozen ownership');
  if (rows[0].slot !== 0 || rows[0].endpointIdentity !== 1 || rows[0].values.get_current_thread_id !== 1) throw Error('foreign main ownership');
  if (new Set(rows.map(r => r.slot)).size !== rows.length || new Set(rows.map(r => r.endpointIdentity)).size !== rows.length ||
      rows.some(r => !Number.isInteger(r.slot) || r.slot < 0 || !Number.isInteger(r.endpointIdentity) || r.endpointIdentity < 1)) throw Error('foreign Worker identity');
  return {frozen: after, owners: rows};
  } catch (error) {
    const rejection = {reason:String(error.message || error), before, after, owners:rows};
    if (persistRejection === true) return {rejection};
    error.ownership = rejection; throw error;
  }
}

function correlateSnapshots(before, after, trace) {
  const decode = require('./mdk2-lua-construction-observer.cjs').decodeFileSnapshot;
  const interpret = sidecar => { try { return decode(sidecar.main, sidecar.file); }
    catch (error) { if (/ownership|uncorrelated|unfrozen|foreign/.test(error.message)) throw error;
      return {kind:'unknown', reason:error.message, decode:null}; } };
  const first = interpret(before), last = interpret(after);
  const a = before.main, b = after.main;
  assert.equal(a.request, b.request, 'request replaced across quantum');
  assert.deepEqual(a.rawRequestWords?.slice(0, 4), b.rawRequestWords?.slice(0, 4), 'request buffer/size/name changed');
  const records = trace?.observer?.records || [];
  // These quantities are separate observations, never an inferred call history.
  return {before: first, after: last,
    outputProgress: first.decode && last.decode ? last.decode.outputCopied - first.decode.outputCopied : null,
    completion: records.length ? records.at(-1).resource.completion : null,
    completedBytesDelta: records.length > 1 ? records.at(-1).resource.completedBytes - records[0].resource.completedBytes : null,
    expectedCompletionDelta: 192320,
    mainEvents: records.filter(r => r.kind !== 'sample'),
    levelSamples: records.filter(r => r.kind === 'sample').map(r => r.level),
    history: 'Only delivered events are known; cursors, completion, finalizer, buffer and Level are distinct. Missing history unknown.'};
}

function createTraceDriver({sessions, page, save, deadline, OUT}) {
  let owner = null, active = false, consumed = false, terminal = false, before = null, commandEnd;
  const read = name => JSON.parse(fs.readFileSync(path.join(OUT, name)));
  async function rpc(action, row) {
    assert(owner && sessions.get(owner.id) === owner.entry && owner.entry.session === owner.session && owner.entry.info.url === owner.url, 'lost/replacement owning Worker');
    const response = await owner.session.send('Runtime.evaluate', {expression: `JSON.stringify(globalThis.__mdk2BoundTrace.invoke(${JSON.stringify(action)},${JSON.stringify(row || {})}))`, returnByValue: true});
    assert(!response.exceptionDetails, 'owning Worker trace evaluation failed: ' + JSON.stringify(response.exceptionDetails));
    const value = JSON.parse(response.result?.value || 'null');
    assert(value && value.targetId === owner.id && value.workerURL === owner.url, 'foreign owning Worker report');
    return value;
  }
  async function capture() {
    const ownership = async phase => {
      const result = await page().evaluate(frozenOwnership, true);
      save('bounded-trace-ownership-' + phase + '.json', result);
      assert(!result.rejection, 'frozen ownership rejected: ' + JSON.stringify(result.rejection));
      return result;
    };
    const barrier = await ownership('before');
    const {mainState} = require(path.join(RUNS, MAIN));
    const {ownerState} = require(path.join(RUNS, '20261104-mdk2-explicit-capture-native-onward/read-only.cjs'));
    const main = await page().evaluate(mainState), file = await page().evaluate(ownerState);
    const after = await ownership('after');
    assert.deepEqual(after, barrier, 'all-Worker capture changed');
    for (const sidecar of [main, file]) assert.deepEqual(sidecar.frozen, barrier.frozen, 'foreign frozen sidecar');
    const fileOwner = barrier.owners.find(r => r.handle === 921600);
    assert(fileOwner && fileOwner.values.get_current_thread_id === 2, 'file Worker owner missing');
    assert.equal(main.values.get_eip, barrier.owners[0].values.get_eip);
    assert.equal(file.values.get_eip, fileOwner.values.get_eip);
    return {barrier, main, file};
  }
  async function begin(c, i, pending) {
    const acceptedAt = Date.now();
    if (terminal) throw Error('trace driver terminal');
    // The sole bounded quantum permanently finishes its owning observer.
    // Later reviewed chunks cannot inherit native history from that terminal
    // observer. Reject before WineFrozen.step, including after a scene change.
    if (consumed) throw Error('native construction history ended; no unobserved continuation');
    const approval = read('inspection-approval.json');
    if (approval.screen !== 'post-medium-construction') return;
    // Only the original reviewed, input-free construction quantum qualifies.
    assert.equal(c.n, 16, 'trace construction quantum must be 16');
    assert.equal(approval.originalScene, 'level-destruction-construction');
    assert.equal(approval.selection, 'none'); assert.equal(approval.constructionBlackVisible, true);
    assert.equal(approval.capture, pending.capture); assert.equal(approval.sha256, pending.sha256);
    const menu = read('native-selector-ledger.json'); assert(menu.newgame && menu.medium, 'independent NewGame/Medium prerequisite');
    const state = await page().evaluate(() => ({input: __mdk2InputSnapshot(sharedRenderer), observation: __mdk2Observe,
      binding: __mdk2BoundTrace.report(), frozen: WineFrozen.status()}));
    assert(!state.binding.fatal, 'page binding failure');
    assert.deepEqual(state.input.inputQueue, []); assert.equal(state.input.activeInput, null); assert.equal(state.input.mouseButtonsMask, 0);
    assert.equal(state.frozen.steps, pending.steps);
    const sent = state.binding.audit.filter(r => r.kind === 'sent'); assert.equal(sent.length, 1, 'ambiguous owning Module send');
    const reports = [];
    for (const [id, entry] of sessions) {
      if (new URL(entry.info.url).pathname !== '/lib/guest-worker.js') continue;
      const response = await entry.session.send('Runtime.evaluate', {expression: 'JSON.stringify(globalThis.__mdk2BoundTrace?.report())', returnByValue: true});
      assert(!response.exceptionDetails, 'binding report failed');
      const report = JSON.parse(response.result?.value || 'null');
      assert(report && !report.fatal, 'missing/failed pre-instantiation binding');
      if (report.binding) reports.push({id, entry, report});
    }
    assert.equal(reports.length, 1, 'ambiguous or missing slot0 instance');
    const chosen = reports[0];
    assert.equal(chosen.report.targetId, chosen.id); assert.equal(chosen.report.thread, 1);
    assert.deepEqual(chosen.report.binding, sent[0], 'page compilation/transfer/instance mismatch');
    owner = {...chosen, session: chosen.entry.session, url: chosen.entry.info.url};
    before = await capture();
    assert.equal(before.barrier.owners[0].endpointIdentity, sent[0].endpointIdentity, 'foreign main endpoint');
    // A review of earlier construction never supplies missing level1 history.
    const words = before.main.rawRequestWords;
    const name = words ? Buffer.from(new Uint32Array(words.slice(3, 7)).buffer).toString('ascii').split('\0')[0] : null;
    if (words?.[2] !== 192320 || name !== 'level1') return;
    require('./mdk2-lua-construction-observer.cjs').decodeFileSnapshot(before.main, before.file);
    const aggregateEnds = ['construction-control-ledger.json','comic-control-ledger.json']
      .filter(name => fs.existsSync(path.join(OUT, name))).map(name => {
        const ledger = read(name); assert(Number.isFinite(ledger.startedAt), 'original aggregate deadline missing');
        return ledger.startedAt + 540000;
      });
    commandEnd = Math.min(acceptedAt + 60000, deadline() - 180000, ...aggregateEnds);
    consumed = true; active = true;
    const report = await rpc('start', {command: i, commandEnd, absoluteEnd: deadline() - 180000});
    save('bounded-trace-start.json', {command: i, before, report, commandEnd});
    assert(!report.fatal && report.traced, 'trace failed to start');
  }
  async function end(result) {
    if (!active) return;
    active = false;
    const report = await rpc('finish', {reason: 'original-quantum-ended'});
    save('bounded-trace-end.json', {report, result});
    assert(result.ran === 16 && !result.timedOut && Date.now() < commandEnd, 'original construction command failed/deadline');
    const after = await capture();
    save('bounded-trace-correlation.json', {before, after, correlation: correlateSnapshots(before, after, report)});
    // A stopped main history does not erase independently frozen file progress.
    // Persist that readback, then retain the first main-observer failure.
    assert(!report.fatal, report.fatal || 'observer failed');
    assert(report.observer?.blocks > 0, 'mandatory native history missing');
  }
  async function finish(reason) {
    if (terminal) return;
    terminal = true; active = false;
    // Finish every preload, including a half-installed or lost candidate.
    for (const [id, entry] of sessions) {
      try {
        const response = await entry.session.send('Runtime.evaluate', {expression: `JSON.stringify(globalThis.__mdk2BoundTrace?.invoke('finish',{reason:${JSON.stringify(reason)}}))`, returnByValue: true});
        save('bounded-trace-terminal-' + id.replace(/[^a-z0-9-]/gi, '_') + '.json', response);
      } catch (error) { save('bounded-trace-lost.json', {reason, error: String(error), history: 'unknown'}); }
    }
  }
  return {begin, end, finish};
}

function compose(run) {
  verifyClosure();
  assert(path.isAbsolute(run), 'absolute fresh run path required');
  // This is the actual main-state -> raw/owner -> original-driver composition.
  // Original command, review, ACK, deadline and first-failure code is retained.
  let source = require(path.join(RUNS, MAIN)).sourceForRun(run);
  assert(source.includes('browserDeadline(release,Date.now())'));
  assert(source.includes("await page.evaluate(n=>WineFrozen.step(n),c.n)"));
  const tool = JSON.stringify(__filename);
  source = replaceOnce(source, "const preload=fs.readFileSync(" + JSON.stringify(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/observe-browser.js')) + ",'utf8');",
    `const integration=require(${tool});const preload=integration.preloadSource();\nconst traceDriver=integration.createTraceDriver({sessions,page:()=>page,save,deadline:()=>deadline,OUT});`);
  source = replaceOnce(source,
    "await session.send('Runtime.enable');\n      const result=await session.send('Runtime.evaluate',{expression:preload});\n      if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));",
    "if(!event.waitingForDebugger)throw Error('late Worker attach');await integration.installBeforeFirstScript(session,integration.preloadSource({targetId:event.targetInfo.targetId,workerURL:event.targetInfo.url}),event.targetInfo.url,deadline);");
  source = replaceOnce(source, 'preloadSHA256:sha(preload),waitingForDebuggerAtAttach:', 'preloadSHA256:sha(integration.preloadSource({targetId:event.targetInfo.targetId,workerURL:event.targetInfo.url})),waitingForDebuggerAtAttach:');
  source = replaceOnce(source, "resumeIssuedAfterInjection:true", "firstScriptPause:true,resumeIssuedAfterInjection:true");
  source = replaceOnce(source, "      await session.send('Runtime.runIfWaitingForDebugger');\n    })()", "    })()");
  source = replaceOnce(source, "const result=await page.evaluate(n=>WineFrozen.step(n),c.n);save('step-'+i+'.json',result);",
    "let result;try{await traceDriver.begin(c,i,inspectionGuard.pending);result=await page.evaluate(n=>WineFrozen.step(n),c.n);await traceDriver.end(result);save('step-'+i+'.json',result);}catch(e){halted=true;await traceDriver.finish('command-failure');throw e;}");
  source = replaceOnce(source, 'if(closing)return;closing=true;clearTimeout(timer);',
    "if(closing)return;closing=true;clearTimeout(timer);await traceDriver.finish('terminal-cleanup');");
  source = replaceOnce(source, "halted=true;save('reply-'+i+'.json'", "halted=true;await traceDriver.finish('first-command-failure');save('reply-'+i+'.json'");
  source = replaceOnce(source, "catch(e=>{halted=true;log('first-failures.jsonl',{phase:'worker preload'", "catch(e=>{halted=true;traceDriver.finish('preload-failure');log('first-failures.jsonl',{phase:'worker preload'");
  return {file: path.join(RUNS, DRIVER), source};
}
function inspect() {
  const closure = verifyClosure(), {pins, pinsSHA256} = pinnedRuntime();
  const composed = compose(path.join(RUNS, 'FRESH-MDK2-RUN-PLACEHOLDER'));
  new (require('node:vm').Script)(require('node:module').wrap(composed.source), {filename: composed.file});
  const moduleReferences = pins.moduleFiles.map(row => {
    const bytes = retainedModule(row);
    assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
    return row;
  });
  return {status: 'offline-composition-checked', source: SOURCE, observer: OBSERVER, observerRepairSHA256:OBSERVER_REPAIR_SHA256, closure, pinsSHA256,
    composedSHA256: sha(composed.source), preloadSHA256: sha(preloadSource()), moduleReferences,
    limits: {traceMs: 10000, boundaries: 100000, records: 512, constructionSlices: 16, restart: false},
    runtime: 'Not executed. Fresh release and original pinned served bytes required; coordinator owns allocation/shutdown.'};
}
function retainedModule(row) {
  const file = path.join(ROOT, row.localReference);
  const bytes = fs.existsSync(file) ? fs.readFileSync(file) : zlib.gunzipSync(fs.readFileSync(file + '.gz'));
  assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256, 'retained module mismatch');
  return bytes;
}
// Explicit NEW driver candidate; original runtime pins/helpers stay immutable.
// The historical resolver rejects any changed accepted entry by design. Load
// that exact resolver from Git and change only its entry admission, with both
// the original accepted blob and the caller's recorded candidate hash checked.
function candidateResolver(expectedSHA256) {
  assert.match(expectedSHA256, /^[a-f0-9]{64}$/);
  assert.equal(sha(fs.readFileSync(__filename)), expectedSHA256, 'changed recorded driver candidate');
  const commit = 'da862db135ef8d0b3bf43c0d7d453f945b44c5a5';
  const file = path.join(ROOT, 'tools/mdk2-immutable-runtime-resolver.cjs');
  const original = gitFile(commit, 'tools/mdk2-immutable-runtime-resolver.cjs');
  assert.equal(sha(original), '356f0e7216e375e3e8d7c6a003d958de4f9f611205a222aa7d9cf65c7e53c77c');
  const source = replaceOnce(original.toString(),
    'exact(readLocal(resolver.root, ENTRY), {path:ENTRY, bytes:git(resolver.root, ACCEPTED, ENTRY).length, sha256:ENTRY_SHA});',
    `exact(git(resolver.root, ACCEPTED, ENTRY), {path:ENTRY, bytes:git(resolver.root, ACCEPTED, ENTRY).length, sha256:ENTRY_SHA});
    assert.equal(sha(readLocal(resolver.root, ENTRY)), ${JSON.stringify(expectedSHA256)}, 'changed recorded driver candidate');`);
  const Module = require('node:module'), entry = new Module(file, module);
  entry.filename = file; entry.paths = Module._nodeModulePaths(path.dirname(file)); entry._compile(source, file);
  return {adapter:entry.exports, provenance:{kind:'explicit-new-driver-candidate', candidateSHA256:expectedSHA256,
    resolverCommit:commit, resolverSHA256:sha(original), composedResolverSHA256:sha(source),
    historicalAccepted:'6d5121b5f96ee6032a9e347e2db64db29c478518'}};
}
function controllerSources(runDirectory) {
  assert(path.isAbsolute(runDirectory)); verifyClosure();
  const base = path.join(RUNS, '20261104-mdk2-measured-escape-original');
  const sources = {};
  for (const name of ['author.py','operator.py','next.py','control.py','runtime_io.py']) sources[name] = fs.readFileSync(path.join(base, name), 'utf8');
  // Keep the author -> operator -> next -> control path and personal review
  // validators. Only the obsolete allocation identity is replaced by the fresh
  // release's exact run-directory/assignment binding.
  sources['runtime_io.py'] = replaceOnce(sources['runtime_io.py'],
    "assert v['assignment'] == '20261104-mdk2-measured-escape-original'", "assert v['assignment'] == '20261104-mdk2-bounded-trace-driver-repair'");
  sources['runtime_io.py'] = replaceOnce(sources['runtime_io.py'],
    "assert v['boxId'] == 'bx_p6qbh9x9'", "assert v['boxId'] and v['runDirectory'] == str(E)");
  // The original control expects a run-local CLI at this one seam. Delegate
  // to the sealed measured entry (including readiness.repairSource).
  sources['native-menu.cjs'] = `const fs=require('fs');const {select}=require(${JSON.stringify(path.join(base, 'native-menu.cjs'))});\nconst [phase,dir,review,max]=process.argv.slice(2);select(dir,JSON.parse(fs.readFileSync(review)),phase,max===undefined?{}:{maxCommands:Number(max)}).then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(e);process.exitCode=1});\n`;
  return sources;
}
function assertRunnable() { return inspect(); }
function run(runDirectory) {
  assert(path.isAbsolute(runDirectory), 'absolute fresh run path required');
  // No Puppeteer, HTTP, Chrome, output, endpoint install or main catch before
  // this gate. A stale release from the closed attempt cannot launch it again.
  const release = JSON.parse(fs.readFileSync(path.join(runDirectory, 'runtime-release.json')));
  assert.equal(release.runDirectory, runDirectory, 'fresh release must bind this exact run directory');
  if (release.runtimeKind === 'local-process-v1') {
    // A dated local renewal must validate its real identity/candidate/deadlines;
    // it cannot inherit admission from the previous assignment's release.
    require('./mdk2-local-runtime.cjs').validate(release, runDirectory);
  } else assert.equal(release.assignment, '20261104-mdk2-bounded-trace-driver-repair', 'fresh assignment required');
  assert(!fs.existsSync(path.join(runDirectory, 'browser')), 'one fresh original launch only');
  require(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/finite-deadline.cjs')).browserDeadline(release, Date.now());
  assertRunnable();
  const bytes = fs.readFileSync(path.join(runDirectory, 'runtime-pins.json'));
  assert.equal(sha(bytes), pinnedRuntime().pinsSHA256, 'original sealed runtime pins required');
  for (const row of JSON.parse(bytes).files) assert.equal(sha(fs.readFileSync(path.join(ROOT, row.path))), row.sha256, 'runtime pin mismatch ' + row.path);
  const {file, source} = compose(runDirectory);
  for (const [name, code] of Object.entries(controllerSources(runDirectory))) {
    const destination = path.join(runDirectory, name);
    if (fs.existsSync(destination)) assert.equal(fs.readFileSync(destination, 'utf8'), code, 'changed fresh controller ' + name);
    else fs.writeFileSync(destination, code, {flag:'wx'});
  }
  require(path.join(RUNS, '20261104-mdk2-measured-escape-original/endpoint-preflight.cjs')).install(runDirectory);
  const Module = require('node:module'), entry = new Module(file, module);
  entry.filename = file; entry.paths = Module._nodeModulePaths(path.dirname(file)); entry._compile(source, file);
}
module.exports = {ROOT, RUNS, SOURCE, OBSERVER, CLOSURE, HELPERS, DRIVER, MAIN, sha, gitFile, verifyClosure, pinnedRuntime,
  installBinding, preloadSource, installBeforeFirstScript, frozenOwnership, correlateSnapshots, createTraceDriver, retainedModule, candidateResolver, controllerSources, compose, inspect, assertRunnable, run};
if (require.main === module) {
  try {
    if (process.argv[2] === '--check' && process.argv.length === 3) console.log(JSON.stringify(inspect(), null, 2));
    else if (process.argv[2] === '--run' && process.argv.length === 4) run(process.argv[3]);
    else throw Error('usage: node tools/mdk2-construction-driver-integration.cjs --check | --run ABSOLUTE_FRESH_RUN');
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
