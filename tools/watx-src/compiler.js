// ═══════════════════════════════════════════════════════════════
// WATX COMPILER — Pipeline Orchestrator
// Compiles WATX → Real WebAssembly Binary
// ═══════════════════════════════════════════════════════════════
//
// DESIGN: Zero implicit coercion.
// All type conversions must be explicit in WATX source.
// The compiler never inserts i32.trunc_f32_s or f32.convert_i32_s
// on behalf of the programmer. If types don't match, the Wasm
// validator will reject the binary — which is correct behavior.
//
// Modules:
//   compiler-parser.js   — Stage 1: tokenize, parseSexpr, ParseError
//   compiler-stages.js   — Stages 2-4: resolveIncludes, expandMacros, checkTypes
//   compiler-codegen.js  — Stages 5-6: lowerIR, generateWasm, disassembleWasm
//   compiler.js (this)   — Pipeline glue: compile(), formatSexpr(), formatLowered()
//

function parseStreamingDescriptor(descriptor, parseContext = null) {
  const forms = parseSource(
    descriptor.source, descriptor.filename, parseContext,
    descriptor.start, descriptor.end);
  if (forms.length !== 1) throw new Error(`Expected one top-level form in ${descriptor.filename}`);
  return forms[0];
}

function watxFunctionHeader(form) {
  const header = [form[0], 'func'];
  let i = 2;
  if (typeof form[i] === 'string' && form[i].startsWith('$')) header.push(form[i++]);
  for (; i < form.length; i++) {
    const part = form[i];
    const head = Array.isArray(part) ? watxValue(part[1]) : null;
    if (head === 'param' || head === 'result' || head === 'effects' || head === 'export') header.push(part);
  }
  return header;
}

function watxFunctionBody(form) {
  const body = [];
  let i = 2;
  if (typeof form[i] === 'string' && form[i].startsWith('$')) i++;
  for (; i < form.length; i++) {
    const part = form[i];
    const head = Array.isArray(part) ? watxValue(part[1]) : null;
    if (head !== 'param' && head !== 'result' && head !== 'effects' && head !== 'export') body.push(part);
  }
  return body;
}

function watxIndirectTypeForms(form) {
  const found = [];
  const pending = [form];
  while (pending.length) {
    const expr = pending.pop();
    if (!Array.isArray(expr)) continue;
    const head = watxValue(expr[1]);
    if ((head === 'call_indirect' || head === 'return_call_indirect') && Array.isArray(expr[2])) {
      found.push(expr[2]);
    }
    for (let i = expr.length - 1; i >= 1; i--) if (Array.isArray(expr[i])) pending.push(expr[i]);
  }
  return found;
}

// Resolve include order and retain only source ranges. Pass 1 parses function
// headers and nested type annotations only; pass 2 reparses one complete body
// at a time when it is emitted.
// A caller-owned build scope retains successful lexical ranges only. Exact
// text keys distinguish transformed sources; errors are rescanned with their
// current filename. ASTs, locations and semantic state are never shared.
function createFrontendReuse() {
  const byText = new Map();
  let scans = 0, hits = 0, codeUnits = 0;
  return Object.freeze({
    index(source, filename) {
      if (byText.has(source)) { hits++; return byText.get(source); }
      scans++;
      codeUnits += source.length;
      const ranges = Object.freeze(scanWatxTopLevelForms(source, filename).map(range =>
        Object.freeze({ ...range, head: watxTopLevelHead(source, range.start, range.end) })));
      byText.set(source, ranges);
      return ranges;
    },
    stats() { return Object.freeze({ scans, hits, codeUnits, entries: byText.size }); },
  });
}

// Offsets of every `if-const`/`cond-const` spelling in a source text, found
// once per text, so pass 1 can ask cheaply whether one function's range holds
// a compile-time conditional (which then decides its header and its indirect
// call types) without parsing the function.
const WATX_CFG_SPELLINGS = ['if-const', 'cond-const'];
function watxCfgOffsets(cache, text) {
  let offsets = cache.get(text);
  if (offsets) return offsets;
  offsets = [];
  for (const word of WATX_CFG_SPELLINGS) {
    for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + word.length)) offsets.push(i);
  }
  offsets.sort((a, b) => a - b);
  cache.set(text, offsets);
  return offsets;
}
function watxRangeHasOffset(offsets, start, end) {
  let lo = 0, hi = offsets.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (offsets[mid] < start) lo = mid + 1; else hi = mid; }
  return lo < offsets.length && offsets[lo] < end;
}

function prepareStreamingModule(source, vfs, frontendReuse, env) {
  if (!env) env = createWatxCompileEnv({});
  env.fileFixed = true;
  const descriptors = [];
  const included = new Set();
  let headerContext = createParseContext();
  // Function bodies are reparsed one at a time. Keep their small, heavily
  // repeated symbol vocabulary (`local.get`, `$x`, `i32.const`, ...) but not
  // number or string literals: this lowers nursery churn without retaining
  // every distinct literal until the module is done.
  const bodyContext = createParseContext({ internValues: false, internSymbols: true, reuseLists: true });

  function indexSource(text, filename) {
    const ranges = frontendReuse ? frontendReuse.index(text, filename)
      : scanWatxTopLevelForms(text, filename);
    for (const range of ranges) {
      const head = range.head ?? watxTopLevelHead(text, range.start, range.end);
      const descriptor = { source: text, filename, start: range.start, end: range.end, head };
      if (head !== 'include') {
        descriptors.push(descriptor);
        continue;
      }
      const includeForm = parseStreamingDescriptor(descriptor);
      const path = (watxValue(includeForm[2]) || '').replace(/"/g, '');
      if (included.has(path)) continue;
      if (!vfs.has(path)) {
        const e = new Error(`Missing include '${path}' referenced from ${filename}`);
        e.line = watxNodeLine(includeForm);
        e.col = watxNodeCol(includeForm);
        e.file = filename;
        throw e;
      }
      included.add(path);
      indexSource(vfs.get(path), path);
    }
  }

  indexSource(source, '<main>');

  // WATX macros have module scope today, including forward uses. They are tiny
  // compared with function bodies, so retaining their templates is deliberate.
  const macroForms = [];
  for (const descriptor of descriptors) {
    if (descriptor.head === 'defmacro') macroForms.push(parseStreamingDescriptor(descriptor, headerContext));
  }
  const macroInfo = new Map();
  function producesHeaderClause(node) {
    if (!Array.isArray(node)) return false;
    const head = watxValue(node[1]);
    if (head === 'param' || head === 'result' || head === 'effects' || head === 'export') return true;
    if (head === 'begin' || head === 'then' || head === 'else') return node.slice(2).some(producesHeaderClause);
    // Either arm of a conditional may supply the clause.
    if (head === 'if-const') return node.slice(3).some(producesHeaderClause);
    if (head === 'cond-const') return node.slice(2).some(c => Array.isArray(c) && c.slice(2).some(producesHeaderClause));
    return false;
  }
  function containsCfg(node) {
    const pending = [node];
    while (pending.length) {
      const n = pending.pop();
      if (!Array.isArray(n)) continue;
      const head = watxValue(n[1]);
      if (head === 'if-const' || head === 'cond-const') return true;
      for (let i = 1; i < n.length; i++) if (Array.isArray(n[i])) pending.push(n[i]);
    }
    return false;
  }
  for (const form of macroForms) {
    const signature = form[2];
    const name = Array.isArray(signature) ? watxValue(signature[1]) : '';
    const producesHeader = form.slice(3).some(producesHeaderClause);
    if (name) macroInfo.set(name, {
      form, typeForms: watxIndirectTypeForms(form), dependencies: [], producesHeader, cfg: containsCfg(form),
    });
  }
  for (const info of macroInfo.values()) {
    const pending = [info.form];
    const dependencies = new Set();
    while (pending.length) {
      const node = pending.pop();
      if (!Array.isArray(node)) continue;
      const head = watxValue(node[1]);
      if (macroInfo.has(head) && head !== watxValue(info.form[2]?.[1])) dependencies.add(head);
      for (let i = 1; i < node.length; i++) if (Array.isArray(node[i])) pending.push(node[i]);
    }
    info.dependencies = [...dependencies];
  }
  const indirectTypeMacros = new Set(
    [...macroInfo].filter(([, info]) => info.typeForms.length).map(([name]) => name));
  const headerMacros = new Set(
    [...macroInfo].filter(([, info]) => info.producesHeader).map(([name]) => name));
  let addedIndirectDependency = true;
  let addedHeaderDependency = true;
  while (addedIndirectDependency || addedHeaderDependency) {
    addedIndirectDependency = false;
    addedHeaderDependency = false;
    for (const [name, info] of macroInfo) {
      if (!indirectTypeMacros.has(name) && info.dependencies.some(dependency => indirectTypeMacros.has(dependency))) {
        indirectTypeMacros.add(name);
        addedIndirectDependency = true;
      }
      if (!headerMacros.has(name) && info.dependencies.some(dependency => headerMacros.has(dependency))) {
        headerMacros.add(name);
        addedHeaderDependency = true;
      }
    }
  }

  // A macro whose indirect-call types may sit inside a compile-time
  // conditional: its type forms cannot be read off the template, because the
  // arm the build does not choose must not contribute any. A function that
  // uses one (or spells a conditional itself) is expanded in pass 1 instead.
  const cfgMacros = new Set([...macroInfo].filter(([, info]) => info.cfg).map(([name]) => name));
  let addedCfgDependency = cfgMacros.size > 0;
  while (addedCfgDependency) {
    addedCfgDependency = false;
    for (const [name, info] of macroInfo) {
      if (!cfgMacros.has(name) && info.dependencies.some(dependency => cfgMacros.has(dependency))) {
        cfgMacros.add(name);
        addedCfgDependency = true;
      }
    }
  }
  const routedMacros = new Set([...cfgMacros].filter(name => indirectTypeMacros.has(name)));
  const cfgOffsets = new Map();
  function needsPassOneExpansion(descriptor) {
    if (watxRangeHasOffset(watxCfgOffsets(cfgOffsets, descriptor.source), descriptor.start, descriptor.end)) return true;
    if (!routedMacros.size) return false;
    for (const head of scanWatxListHeads(descriptor.source, descriptor.start, descriptor.end)) {
      if (routedMacros.has(head)) return true;
    }
    return false;
  }

  function usedMacroTypeForms(descriptor) {
    if (!indirectTypeMacros.size) return [];
    const used = new Set();
    const pending = scanWatxListHeads(
      descriptor.source, descriptor.start, descriptor.end).filter(head => indirectTypeMacros.has(head));
    while (pending.length) {
      const name = pending.pop();
      if (used.has(name)) continue;
      used.add(name);
      pending.push(...macroInfo.get(name).dependencies);
    }
    return [...used].flatMap(name => macroInfo.get(name).typeForms);
  }

  const forms = [];
  const streamByHeader = new Map();
  for (const descriptor of descriptors) {
    if (descriptor.head === 'defmacro') continue;
    // Compile-time names visible to this form: everything declared before it
    // in include order. Pass 2 re-expands the form with exactly this view.
    env.file = descriptor.filename;
    const cfgSeq = env.seq;
    if (descriptor.head === 'func' && !needsPassOneExpansion(descriptor)) {
      const header = scanWatxFunctionHeader(
        descriptor.source, descriptor.filename, descriptor.start, descriptor.end,
        headerContext, macroForms, headerMacros, env);
      const streamInfo = {
        descriptor,
        functionOrdinal: 0,
        cfgSeq,
        indirectTypeForms: [
          ...scanWatxTypeForms(
            descriptor.source, descriptor.filename, descriptor.start, descriptor.end, headerContext),
          ...usedMacroTypeForms(descriptor),
        ],
      };
      forms.push(header);
      streamByHeader.set(header, streamInfo);
      continue;
    }
    const raw = parseStreamingDescriptor(descriptor, headerContext);
    const expandedForms = expandMacros([...macroForms, raw], env);
    let functionOrdinal = 0;
    for (const form of expandedForms) {
      if (!Array.isArray(form) || watxValue(form[1]) !== 'func') {
        forms.push(form);
        continue;
      }
      const header = watxFunctionHeader(form);
      const streamInfo = {
        descriptor,
        functionOrdinal: functionOrdinal++,
        cfgSeq,
        indirectTypeForms: watxIndirectTypeForms(form),
      };
      forms.push(header);
      streamByHeader.set(header, streamInfo);
    }
  }

  // Re-expand one streamed function exactly as pass 1 saw it: same text, same
  // macros, the compile-time declarations visible at its position.
  function expandStreamedFunction(streamInfo, context) {
    const raw = parseStreamingDescriptor(streamInfo.descriptor, context);
    const saved = { phase: env.phase, limit: env.limit, file: env.file };
    env.phase = 'body';
    env.limit = streamInfo.cfgSeq;
    env.file = streamInfo.descriptor.filename;
    let expandedForms;
    try {
      expandedForms = expandMacros([...macroForms, raw], env);
    } finally {
      env.phase = saved.phase; env.limit = saved.limit; env.file = saved.file;
    }
    const functions = expandedForms.filter(form => Array.isArray(form) && watxValue(form[1]) === 'func');
    return functions[streamInfo.functionOrdinal];
  }

  // The expanded body of a pass-1 header, for export-wrap's (pure) inference.
  // Parsed without the body arena: nothing here may be recycled.
  function headerBody(header) {
    const streamInfo = streamByHeader.get(header);
    if (!streamInfo) return null;
    const form = expandStreamedFunction(streamInfo, null);
    return form ? watxFunctionBody(form) : null;
  }

  function bindFunctionDeclarations(checkResult) {
    for (const fd of checkResult.functionDecls || []) {
      const streamInfo = streamByHeader.get(fd.form);
      if (!streamInfo) continue;
      fd.streamInfo = streamInfo;
      fd.indirectTypeForms = streamInfo.indirectTypeForms;
      fd.form = null;
    }
    streamByHeader.clear();
    headerContext = null;
  }

  function loadFunctionBody(fd) {
    const streamInfo = fd.streamInfo;
    if (!streamInfo) return fd.body;
    // The body is discarded immediately after emission. Reuse its dense list
    // storage for the next function and do not retain a module-wide atom pool.
    const form = expandStreamedFunction(streamInfo, bodyContext);
    if (!form) throw new Error(`Streaming pass mismatch while loading ${fd.name}`);
    return {
      body: watxFunctionBody(form),
      release() { recycleWatxTree(form, bodyContext); },
    };
  }

  return { forms, bindFunctionDeclarations, loadFunctionBody, headerBody };
}

// --- Full Compiler Pipeline ---
//
// The pipeline is a generator so one implementation serves both contracts:
// compile() drains it synchronously, while compileAsync() awaits only at the
// explicit stage/function boundaries it yields. Individual parser/checker and
// expression-emitter helpers stay synchronous and allocation-light.
function* compileSteps(source, vfs = new Map(), options = {}) {
  const stages = [];
  let currentStage = 'PARSE';
  const production = options.mode === 'production';
  const debugArtifacts = options.debugArtifacts ?? !production;
  const logFunctions = options.logFunctions ?? !production;
  const logSummary = options.logSummary ?? !production;
  const collectWarnings = options.collectWarnings ?? !production;
  const streaming = production && !debugArtifacts && options.streaming !== false;
  
  try {
    let expanded;
    let streamingModule = null;
    // Compile-time options, targets and constants (defoption/if-const/...).
    const cfgEnv = createWatxCompileEnv(options);
    if (streaming) {
      currentStage = 'PARSE';
      streamingModule = prepareStreamingModule(source, vfs, options.frontendReuse, cfgEnv);
      stages.push({ name: 'PARSE', success: true });
      stages.push({ name: 'INCLUDE', success: true });
      stages.push({ name: 'EXPAND', success: true });
      expanded = streamingModule.forms;
    } else {
      const parseContext = createParseContext();
      // Stage 1: Parse
      currentStage = 'PARSE';
      const ast = parseSource(source, '<main>', parseContext);
      stages.push({ name: 'PARSE', success: true });

      // Stage 2: Include
      currentStage = 'INCLUDE';
      const included = resolveIncludes(ast, vfs, new Set(), '<main>', parseContext);
      stages.push({ name: 'INCLUDE', success: true });

      // Stage 3: Expand
      currentStage = 'EXPAND';
      expanded = expandMacros(included, cfgEnv);
      stages.push({ name: 'EXPAND', success: true });
    }
    // Every define must name a declared option: a typo on the command line is
    // an error, not a build that silently used the default.
    for (const name of cfgEnv.defines.keys()) {
      const d = cfgEnv.decls.get(name);
      if (!d) throw new Error(`define ${name}: no (defoption ${name} ...) in this program`);
      if (d.kind !== 'option') throw new Error(`define ${name}: '${name}' is a defconst, not a defoption`);
    }
    // Export wrappers, once every module-level form (and so every export) is known.
    const wrapped = applyWatxExportWraps(expanded,
      streamingModule ? streamingModule.headerBody : (form) => watxFunctionBody(form));
    expanded = wrapped.forms;
    yield { stage: 'EXPAND' };
    
    // Stage 4: Check
    currentStage = 'CHECK';
    const checkResult = checkTypes(expanded, { collectWarnings, requiredOnly: production });
    if (streamingModule) {
      streamingModule.bindFunctionDeclarations(checkResult);
      expanded = expanded.filter(form => !Array.isArray(form) || watxValue(form[1]) !== 'func');
    }
    // Hard type errors (checkResult.errors) FAIL the build — they are the
    // high-confidence, false-positive-free subset (e.g. call arg-count
    // mismatch). Approximate findings remain warnings and do not block.
    if (checkResult.errors && checkResult.errors.length > 0) {
      const first = checkResult.errors[0];
      const e = new Error(
        `${first.msg}` +
        (checkResult.errors.length > 1 ? ` (+${checkResult.errors.length - 1} more type error(s))` : ''));
      e.line = first.line || 0;
      e.col = first.col || 0;
      throw e;
    }
    stages.push(collectWarnings
      ? { name: 'CHECK', success: true, warnings: checkResult.warnings }
      : { name: 'CHECK', success: true });
    yield { stage: 'CHECK' };
    
    // Stage 5: Lower
    currentStage = 'LOWER';
    const lowered = lowerIR(expanded, checkResult, { layoutsOnly: !debugArtifacts });
    stages.push({ name: 'LOWER', success: true });
    yield { stage: 'LOWER' };
    
    // Stage 6: Emit WASM Binary
    currentStage = 'EMIT';
    const emitOptions = streamingModule
      ? { ...options, loadFunctionBody: streamingModule.loadFunctionBody }
      : options;
    const wasmResult = yield* generateWasmSteps(expanded, lowered, checkResult, emitOptions);
    stages.push({ name: 'EMIT', success: true });
    
    const wasmText = debugArtifacts ? disassembleWasm(wasmResult) : undefined;
    
    // Log compilation summary for debugging
    const builtinCount = wasmResult.runtimeBuiltins ? 3 : 0;
    const firstUser = wasmResult.importDecls.length + builtinCount;
    if (logSummary) {
      console.log(`[WATX] Compiled successfully: ${wasmResult.binary.length} bytes, ${wasmResult.importDecls.length} imports, ${wasmResult.funcDecls.length} user funcs`);
      console.log(`[WATX] Function index map: imports[0..${wasmResult.importDecls.length - 1}] builtins=${builtinCount} user[${firstUser}..${firstUser + wasmResult.funcDecls.length - 1}]`);
    }
    if (logFunctions) {
      console.log(`[WATX] User functions:`, wasmResult.funcDecls.map((name, i) => `  [${firstUser + i}] ${name}`).join('\n'));
    }
    
    const result = {
      success: true,
      wasmBinary: wasmResult.binary,
      importMeta: wasmResult.importDecls,
      stages,
      diagnostics: checkResult.warnings.map(w => ({ type: 'warning', ...w })),
      // The region layout (docs/watx-region-safety-design.md §4.1/§8): what the
      // allocator produced, and whether a shake permuted it. A caller that
      // writes an artifact prints this; a caller that does not, ignores it.
      regions: wasmResult.regions || null,
    };
    // Opt-in pass-1 facts: every declaration this compile resolved, as plain
    // JSON-able data. A consumer that needs only declarations (layout offsets,
    // the region map, the export surface) can read these instead of parsing
    // and expanding the whole closure again. Never changes wasmBinary.
    if (options.facts) result.facts = watxCompileFacts(lowered, wasmResult.facts, cfgEnv, wrapped.report);
    if (debugArtifacts) {
      result.wasmText = wasmText;
      result.expanded = formatSexpr(expanded);
      result.lowered = formatLowered(lowered);
    }
    return result;
  } catch (e) {
    console.error(`[WATX] Compilation failed at stage ${currentStage}:`, e.message);
    stages.push({ name: currentStage, success: false, error: e.message });
    return {
      success: false,
      error: e.message,
      errorLine: e.line || 0,
      errorCol: e.col || 0,
      stages,
      diagnostics: [{ type: 'error', msg: e.message, line: e.line || 0, col: e.col || 0 }],
    };
  }
}

// The lowered declaration records (lowerIR) in their own shape, minus the
// derived lookup maps: a layout's fieldByName is its fields by name, and an
// enum's members Map becomes an object in declaration order.
function watxCfgFactValue(v) {
  if (!v) return null;
  if (v.t === 'int') {
    if (v.w !== 'i64' && v.v >= BigInt(Number.MIN_SAFE_INTEGER) && v.v <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(v.v);
    return String(v.v);
  }
  return v.v;
}

// What the compile-time layer decided: every option with its value and where
// that value came from, every constant, the targets, and per file the options
// and targets its forms read -- the exact inputs a per-file cache must key on.
function watxCompileTimeFacts(env) {
  const options = [], constants = [];
  for (const d of env.decls.values()) {
    if (d.kind === 'option') {
      const row = { name: d.name, type: d.type.t === 'int' ? d.type.w : d.type.t,
        default: watxCfgFactValue(d.defaultValue), value: watxCfgFactValue(d.value),
        source: d.defined ? 'define' : 'default', doc: d.doc, file: d.file, line: d.line };
      if (d.type.t === 'enum') row.members = d.type.members.slice();
      options.push(row);
    } else {
      constants.push({ name: d.name, value: watxCfgFactValue(d.value), reads: [...d.deps].sort(), file: d.file, line: d.line });
    }
  }
  const reads = {};
  for (const file of [...env.reads.keys()].sort()) reads[file] = [...env.reads.get(file)].sort();
  return { options, constants, targets: Object.fromEntries(env.targets), reads };
}

function watxCompileFacts(lowered, moduleFacts, cfgEnv, wrapReport) {
  const declarations = [];
  for (const rec of lowered) {
    if (!rec || typeof rec.type !== 'string' || !rec.type.endsWith('-lowered')) continue;
    if (rec.type === 'layout-lowered') {
      const { fieldByName, ...rest } = rec;
      declarations.push(rest);
    } else if (rec.type === 'enum-lowered') {
      declarations.push({ ...rec, members: Object.fromEntries(rec.members) });
    } else {
      declarations.push(rec);
    }
  }
  const facts = { declarations, ...(moduleFacts || {}) };
  if (cfgEnv) facts.compileTime = watxCompileTimeFacts(cfgEnv);
  if (wrapReport) {
    // Each function export with the wrappers applied to it (outermost first)
    // and the function that finally runs.
    const byName = new Map(wrapReport.exports.map(row => [row.name, row]));
    for (const exp of facts.exports || []) {
      const row = exp.kind === 'func' ? byName.get(exp.name) : null;
      if (!row) continue;
      exp.wrappers = row.wrappers.slice();
      exp.implementation = row.target;
      if (row.pure !== null) exp.pure = row.pure;
    }
    facts.exportWraps = wrapReport.declarations;
  }
  return facts;
}

function compile(source, vfs = new Map(), options = {}) {
  const steps = compileSteps(source, vfs, options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

function defaultCompileYield() {
  // scheduler.yield() is purpose-built for this in browsers that implement
  // it. setImmediate() is the Node equivalent: unlike a resolved Promise it
  // lets timers and I/O run before compilation resumes. setTimeout is the
  // portable browser fallback.
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
    return scheduler.yield();
  }
  if (typeof setImmediate === 'function') {
    return new Promise(resolve => setImmediate(resolve));
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function compileAsync(source, vfs = new Map(), options = {}) {
  const steps = compileSteps(source, vfs, options);
  const yieldControl = options.yieldControl || defaultCompileYield;
  const interval = Math.max(0, options.yieldIntervalMs ?? 8);
  const signal = options.signal || null;
  const aborted = () => {
    if (!signal || !signal.aborted) return;
    const error = new Error('WATX compilation aborted');
    error.name = 'AbortError';
    throw error;
  };

  // An async API should never perform its first potentially expensive stage in
  // the caller's current turn. This also gives an already-aborted signal a
  // deterministic no-work path.
  aborted();
  await yieldControl({ stage: 'START', completed: 0, total: 0 });
  let deadline = Date.now() + interval;

  for (;;) {
    aborted();
    const step = steps.next();
    if (step.done) return step.value;
    if (interval === 0 || Date.now() >= deadline) {
      await yieldControl(step.value || { stage: 'UNKNOWN' });
      deadline = Date.now() + interval;
    }
  }
}

function formatSexpr(forms, indent = 0) {
  const pad = '  '.repeat(indent);
  let out = '';
  for (const form of forms) {
    if (Array.isArray(form)) {
      const values = form.slice(1);
      if (values.length <= 4 && !values.some(f => Array.isArray(f))) {
        out += pad + '(' + values.map(f => watxValue(f) ?? String(f)).join(' ') + ')\n';
      } else {
        out += pad + '(' + (watxValue(form[1]) ?? '') + '\n';
        for (let i = 2; i < form.length; i++) {
          if (Array.isArray(form[i])) {
            out += formatSexpr([form[i]], indent + 1);
          } else {
            out += '  '.repeat(indent + 1) + (watxValue(form[i]) ?? String(form[i])) + '\n';
          }
        }
        out += pad + ')\n';
      }
    } else if (form?.type === 'layout-lowered') {
      out += pad + `; layout ${form.name} (${form.totalSize} bytes)\n`;
      for (const f of form.fields) {
        out += pad + `;   ${f.name}: ${f.type} @ offset ${f.offset}\n`;
      }
    } else {
      out += pad + (watxValue(form) ?? String(form)) + '\n';
    }
  }
  return out;
}

function formatLowered(forms) {
  let out = ';; === Lowered IR ===\n\n';
  for (const form of forms) {
    if (form?.type === 'layout-lowered') {
      out += `;; Layout: ${form.name} (total: ${form.totalSize} bytes)\n`;
      for (const f of form.fields) {
        out += `;;   .${f.name} : ${f.type} @ offset ${f.offset} (${f.size} bytes)\n`;
      }
      out += '\n';
    }
  }
  out += formatSexpr(forms.filter(f => !f?.type?.startsWith('layout')));
  return out;
}
