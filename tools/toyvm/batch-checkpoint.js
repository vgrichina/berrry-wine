'use strict';
// A persistent version of the deliberately bounded runDosBatch launcher.
// Batch frames are data. External commands use ordinary fresh DOS machines;
// DOS INT 21h EXEC inside a command remains the Machine's real child path.
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { Machine } = require('./dos');
const { createMachineRunner, resumeMachineRunner } = require('./checkpoint');
const hash = b => createHash('sha256').update(b).digest('hex');
const schema = 'toyvm-batch-machine-v1';
const keysAre = (x, keys) => x && Object.getPrototypeOf(x) === Object.prototype && Object.keys(x).sort().join(',') === keys.sort().join(',');
const clone = x => v8.deserialize(v8.serialize(x));
const source = () => fs.readdirSync(__dirname).filter(n => n.endsWith('.js')).sort()
  .map(n => [n, hash(fs.readFileSync(path.join(__dirname, n)))]);
const loaded = source();
function unchanged() { if (!isDeepStrictEqual(source(), loaded)) throw Error('batch source identity mismatch'); }
function read(bytes) {
  const e = v8.deserialize(bytes);
  if (!keysAre(e, ['schema','body','sha256']) || e.schema !== schema || !(e.body instanceof Uint8Array) || hash(e.body) !== e.sha256) throw Error('corrupt batch checkpoint');
  const r = v8.deserialize(e.body);
  if (!keysAre(r, ['sources','recipe','state','child'])) throw Error('invalid batch archive shape');
  if (!isDeepStrictEqual(r.sources, loaded)) throw Error('batch source identity mismatch');
  return r;
}
function recipeFor(o) {
  if (!o || Object.keys(o).some(k => !['entry', 'files', 'directories', 'currentDirectory', 'budget', 'machineOptions', 'sessionOptions'].includes(k)) ||
      typeof o.entry !== 'string' || !/\.bat$/i.test(o.entry) || !Array.isArray(o.files)) throw Error('invalid batch recipe');
  // Machine factory checks all DOS paths, directories, bytes and option types.
  return clone({ entry: o.entry, files: o.files, directories: o.directories || [], currentDirectory: o.currentDirectory || '',
    budget: o.budget ?? 3000000000, machineOptions: o.machineOptions || {}, sessionOptions: o.sessionOptions || {} });
}
function diskFor(s, child) {
  const d = new Machine(new Uint8Array(0));
  d.tempFiles = child ? child.machine.tempFiles : s.files;
  d.virtualDirectories = new Set(s.directories); d.currentDirectory = s.currentDirectory;
  return d;
}
function frame(d, name) {
  const key = d.fileKey(name), bytes = d.readWholeFile(name);
  if (!key || !bytes) throw Error('launcher batch not found: ' + name);
  return { name: key, bytes: Uint8Array.from(bytes), next: 0 };
}
function lines(f) { return Buffer.from(f.bytes).toString('latin1').split(/\r\n|\n|\r/); }
function validateState(s, recipe) {
  if (!keysAre(s, ['frames','files','directories','currentDirectory','dispatched','handbacks','count','commands','runs','completed','activeName','activeArgs','childIndex','childRecipe']) || !Array.isArray(s.frames) || s.frames.length > 9 || !(s.files instanceof Map) ||
      !Array.isArray(s.directories) || !s.directories.includes('') || typeof s.currentDirectory !== 'string' ||
      !s.directories.includes(s.currentDirectory) || !Number.isSafeInteger(s.dispatched) || s.dispatched < 0 ||
      !Number.isSafeInteger(s.count) || s.count < 0 || s.count > 256 || !Array.isArray(s.commands) ||
      !Array.isArray(s.runs) || typeof s.completed !== 'boolean' || typeof s.activeName !== 'string' || typeof s.activeArgs !== 'string' ||
      !Number.isSafeInteger(s.handbacks) || s.handbacks < 0 ||
      s.frames.some(f => !keysAre(f, ['name','bytes','next']) || typeof f.name !== 'string' || !(f.bytes instanceof Uint8Array) ||
        !Number.isSafeInteger(f.next) || f.next < 0 || f.next > lines(f).length) ||
      !Number.isSafeInteger(s.childIndex) || s.childIndex < 1 || s.childIndex > s.count ||
      s.runs.some(r => !keysAre(r, ['executable','args','dispatched','handbacks','exited','exitCode']) || !Number.isSafeInteger(r.handbacks) || r.handbacks < 0 || typeof r.executable !== 'string' || typeof r.args !== 'string' ||
        !Number.isSafeInteger(r.dispatched) || r.dispatched < 0 || r.exited !== true || (!Number.isInteger(r.exitCode) || r.exitCode < 0 || r.exitCode > 255)) ||
      s.dispatched !== s.runs.reduce((n, r) => n + r.dispatched, 0) ||
      s.handbacks !== s.runs.reduce((n, r) => n + r.handbacks, 0) ||
      s.commands.some(c => !keysAre(c, ['batch','line','command','args','currentDirectory']) || typeof c.batch !== 'string' || !Number.isSafeInteger(c.line) || c.line < 1 ||
        typeof c.command !== 'string' || typeof c.args !== 'string' || typeof c.currentDirectory !== 'string')) throw Error('invalid batch continuation');
  const d = diskFor(s);
  if (new Set(s.directories).size !== s.directories.length || s.directories.some(n => typeof n !== 'string' ||
      (n && d.resolvePath('\\' + n, true) !== n))) throw Error('invalid batch directories');
  for (const [key, rec] of s.files) if (typeof key !== 'string' || d.fileKey('\\' + key) !== key ||
      !rec || !(rec.data instanceof Uint8Array) || !Number.isInteger(rec.len) || rec.len < 0 || rec.len > rec.data.length) throw Error('invalid batch file tree');
  if (s.activeName && !s.files.has(s.activeName)) throw Error('missing active executable');
  if (!s.completed && (!s.frames.length || !s.activeName)) throw Error('missing active batch command');
  if (s.completed && (s.frames.length || s.activeName)) throw Error('invalid completed batch');
}
async function createBatchMachineRunner(options) {
  unchanged();
  const recipe = recipeFor(options);
  // The batch parser consumes captured files; each external command initializes
  // the real DOS services, device state and canonical native module.
  let state = { frames: [], files: new Map(), directories: [''], currentDirectory: recipe.currentDirectory.toLowerCase(),
    dispatched: 0, handbacks: 0, count: 0, commands: [], runs: [], completed: false, activeName: '', activeArgs: '', childIndex: 0, childRecipe: null };
  // Normalize through the same path resolver as DOS services, reject aliases.
  const d = diskFor(state);
  for (const name of recipe.directories) {
    if (typeof name !== 'string' || !name || d.fileKey('\\' + name) !== name.toLowerCase()) throw Error('invalid batch directory');
    for (let key = name.toLowerCase(); key; key = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '')
      if (!state.directories.includes(key)) state.directories.push(key);
  }
  for (const e of recipe.files) {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || !(e[1] instanceof Uint8Array)) throw Error('invalid batch file');
    const key = d.fileKey('\\' + e[0]);
    if (!key || key !== e[0].toLowerCase() || state.files.has(key)) throw Error('invalid or duplicate batch path');
    state.files.set(key, { data: Uint8Array.from(e[1]), len: e[1].length });
    for (let dir = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : ''; dir; dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '')
      if (!state.directories.includes(dir)) state.directories.push(dir);
  }
  if (!state.directories.includes(state.currentDirectory) || state.directories.some(dir => state.files.has(dir)) ||
      !Number.isSafeInteger(recipe.budget) || recipe.budget <= 0) throw Error('invalid batch tree or budget');
  if (d.fileKey('\\' + recipe.entry) !== recipe.entry.toLowerCase()) throw Error('invalid batch entry path');
  state.frames.push(frame(d, '\\' + recipe.entry));
  let child = null, active = false, failed = false;
  const children = new Map(); // Preserve each external command's connected roots on rollback.
  async function nextCommand() {
    const disk = diskFor(state);
    while (state.frames.length) {
      const f = state.frames[state.frames.length - 1], all = lines(f);
      if (f.next === all.length) { state.frames.pop(); continue; }
      if (++state.count > 256) throw Error('launcher command limit exceeded');
      const line = ++f.next, text = all[line - 1].trim().replace(/^@/, '');
      if (!text || /^rem(?:\s|$)/i.test(text) || /^echo\s+off$/i.test(text)) continue;
      const fail = () => { throw Error(`unsupported launcher batch ${f.name}:${line}: ${text}`); };
      if (/[\x00-\x1f%&|<>^!":]/.test(text)) fail();
      const [, command, args = ''] = /^(\S+)(?:\s+(.*))?$/.exec(text);
      state.commands.push({ batch: f.name, line, command, args, currentDirectory: disk.currentDirectory });
      if (/^cd$/i.test(command)) {
        const dir = disk.resolvePath(args, true);
        if (!args || dir === null || !disk.isDirectory(dir)) fail();
        disk.currentDirectory = state.currentDirectory = dir;
      } else if (/^call$/i.test(command)) {
        if (!/^[^\s]+\.bat$/i.test(args)) fail();
        if (state.frames.length >= 9) throw Error('launcher CALL depth exceeded');
        state.frames.push(frame(disk, args));
      } else {
        if (!/\.(exe|com)$/i.test(command)) fail();
        const executable = disk.fileKey(command), image = disk.readWholeFile(command);
        if (!executable || !image) throw Error('launcher executable not found: ' + command);
        state.activeName = executable; state.activeArgs = args;
        state.childIndex = state.count;
        state.childRecipe = { image: Uint8Array.from(image), name: executable.replace(/\//g, '\\'), args,
          files: [...state.files].map(([k, r]) => [k, r.data.subarray(0, r.len)]), directories: state.directories.filter(Boolean),
          currentDirectory: state.currentDirectory, machineOptions: recipe.machineOptions, sessionOptions: recipe.sessionOptions,
          budget: Math.max(1, recipe.budget - state.dispatched) };
        child = await createMachineRunner(state.childRecipe);
        return;
      }
    }
    state.completed = true; state.activeName = '';
  }
  const initialDirectories = clone(state.directories);
  await nextCommand();
  if (!child) throw Error('launcher batch ran no executable');
  function idle(checkSources = false) { if (checkSources) unchanged(); if (active || failed) throw Error('batch runner active or failed'); }
  const runner = {
    get executable() { return state.activeName; },
    get vm() { return child.vm; }, get machine() { return child.machine; }, get session() { return child.session; },
    get dispatched() { return state.dispatched + (state.completed ? 0 : child.session.dispatched); },
    get handbacks() { return state.handbacks + (state.completed ? 0 : child.session.handbacks); },
    get done() { return state.completed || (runner.dispatched >= recipe.budget && (child.machine.exited || !child.session.owesEnd(child.session.endAt))) || (child.session.done && !child.machine.exited); },
    get progress() { return clone({ ...state, files: undefined }); },
    async step() {
      idle(); if (runner.done) return 'done'; active = true;
      try {
        if (child.machine.exited) {
          state.runs.push({ executable: state.activeName, args: state.activeArgs, dispatched: child.session.dispatched,
            handbacks: child.session.handbacks, exited: true, exitCode: child.machine.exitCode });
          state.dispatched += child.session.dispatched; state.handbacks += child.session.handbacks;
          state.currentDirectory = child.machine.currentDirectory; state.files = child.machine.tempFiles;
          await nextCommand();
          if (state.completed) return 'done';
        }
        const why = child.step(); children.set(state.childIndex, child); return why;
      } catch (e) { failed = true; throw e; }
      finally { active = false; }
    },
    capture() {
      idle(true); validateState(state, recipe);
      const body = v8.serialize({ sources: loaded, recipe, state, child: child.capture() });
      return v8.serialize({ schema, sha256: hash(body), body });
    },
    async restore(bytes) {
      idle(true); const record = read(bytes);
      if (!isDeepStrictEqual(record.recipe, recipe)) throw Error('batch fixture/options identity mismatch');
      validateState(record.state, recipe);
      if (!isDeepStrictEqual(record.state.directories, initialDirectories)) throw Error('batch directory identity mismatch');
      // Validate and stage the complete child before committing existing connected roots.
      const ss = record.state;
      const launch = ss.childRecipe;
      const name = ss.completed ? ss.runs.at(-1)?.executable : ss.activeName;
      const args = ss.completed ? ss.runs.at(-1)?.args : ss.activeArgs;
      if (!launch || launch.name !== name?.replace(/\//g, '\\') || launch.args !== args ||
          !isDeepStrictEqual(launch.machineOptions, recipe.machineOptions) ||
          !isDeepStrictEqual(launch.sessionOptions, recipe.sessionOptions) ||
          !isDeepStrictEqual(launch.directories, ss.directories.filter(Boolean)) ||
          launch.budget !== Math.max(1, recipe.budget - ss.dispatched + (ss.completed ? ss.runs.at(-1).dispatched : 0)) ||
          !ss.completed && (!isDeepStrictEqual(launch.files, [...ss.files].map(([k,r]) => [k,r.data.subarray(0,r.len)])) ||
            !isDeepStrictEqual(launch.image, ss.files.get(name)?.data.subarray(0,ss.files.get(name)?.len)))) {
        throw Error('batch child fixture/options mismatch');
      }
      // Validate child schema and the independent launch recipe before fresh
      // reconstruction. No current root, file or progress is written here.
      const ce = v8.deserialize(record.child);
      if (ce?.schema !== 'toyvm-dos-machine-v1' || !(ce.body instanceof Uint8Array) || hash(ce.body) !== ce.sha256) throw Error('corrupt batch child checkpoint');
      const cr = v8.deserialize(ce.body).recipe;
      if (!isDeepStrictEqual(cr, { ...launch, inputs: [] })) throw Error('batch child fixture/options mismatch');
      const recovered = await resumeMachineRunner(record.child);
      if (!ss.directories.includes(recovered.machine.currentDirectory) ||
          recovered.session.endAt !== launch.budget ||
          recovered.session.dispatched < 0 ||
          ss.completed && (!recovered.machine.exited ||
            ss.runs.at(-1).dispatched !== recovered.session.dispatched ||
            ss.runs.at(-1).handbacks !== recovered.session.handbacks ||
            ss.runs.at(-1).exitCode !== recovered.machine.exitCode ||
            !isDeepStrictEqual(ss.files, recovered.machine.tempFiles))) throw Error('batch child continuation mismatch');
      const existing = children.get(ss.childIndex);
      if (existing) existing.restore(record.child); // Root identity and imported closures survive.
      child = existing || recovered;
      children.set(ss.childIndex, child);
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, ss);
      return runner;
    },
  };
  return runner;
}
async function resumeBatchMachineRunner(bytes) {
  unchanged(); const record = read(bytes);
  validateState(record.state, record.recipe);
  const runner = await createBatchMachineRunner(record.recipe);
  return runner.restore(bytes);
}
module.exports = { createBatchMachineRunner, resumeBatchMachineRunner };
