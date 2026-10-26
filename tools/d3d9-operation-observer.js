'use strict';

// Test-only instrumentation of the exact loaded CommonJS script, including
// lexical constructor aliases. Never reconstruct it from the on-disk baseline:
// source-injected controls must exercise their actual loaded operations.
const Module = require('node:module');
const inspector = require('node:inspector');
const {pathToFileURL} = require('node:url');

function parser() {
  const m = new Module(__filename);
  // Node ships this parser; fail closed if the installed Node lacks it.
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw Error('Node bundled JavaScript parser unavailable');
  m._compile(source, __filename + '.acorn');
  return m.exports;
}

function loadedSource(filename) {
  const session = new inspector.Session(), scripts = [];
  session.connect();
  session.on('Debugger.scriptParsed', ({params}) => {
    if (params.url === pathToFileURL(filename).href) scripts.push(params.scriptId);
  });
  try {
    let failure, source;
    session.post('Debugger.enable', {}, error => { failure = error; });
    if (failure || !scripts.length) throw failure || Error('loaded renderer script unavailable');
    session.post('Debugger.getScriptSource', {scriptId:scripts.at(-1)}, (error, result) => {
      failure = error; source = result?.scriptSource;
    });
    if (failure || typeof source !== 'string') throw failure || Error('renderer source unavailable');
    return source;
  } finally { session.disconnect(); }
}

function instrument(source) {
  if (source.includes('__renderOperationObserver')) throw Error('observer binding collision');
  const ast = parser().parse(source, {ecmaVersion:'latest', sourceType:'script'});
  function render(node, parent, key) {
    const children = [];
    for (const [name, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') children.push([child,name]);
      } else if (value && typeof value.type === 'string') children.push([value,name]);
    }
    const part = child => render(child, node, Object.keys(node).find(k=>node[k]===child));
    if (node.type === 'ChainExpression' && node.expression.type === 'MemberExpression' &&
        node.expression.computed && node.expression.optional) {
      return '__renderOperationObserver.readOptional(' + render(node.expression.object,node.expression,'object')+
        ',()=>(' + render(node.expression.property,node.expression,'property')+'))';
    }
    if (node.type === 'NewExpression') {
      return '__renderOperationObserver.construct(' + part(node.callee) + ',[' +
        node.arguments.map(part).join(',') + '])';
    }
    // Leave lvalues and method receivers intact. Ordinary computed reads are
    // evaluated exactly once, in their original object/key order.
    const receiver = parent && ((parent.type === 'CallExpression' && key === 'callee') ||
      (parent.type === 'AssignmentExpression' && key === 'left') ||
      parent.type === 'UpdateExpression' || parent.type === 'UnaryExpression' && parent.operator === 'delete');
    if (node.type === 'MemberExpression' && node.computed && node.optional) {
      throw Error('nonterminal optional computed access is outside the observer grammar');
    }
    if (node.type === 'MemberExpression' && node.computed && !node.optional && !receiver) {
      return '__renderOperationObserver.read(' + part(node.object) + ',' + part(node.property) + ')';
    }
    children.sort((a,b)=>a[0].start-b[0].start);
    let result='', offset=node.start;
    for (const [child,name] of children) {
      if (child.start < offset) continue; // shorthand properties share a node
      result += source.slice(offset,child.start)+render(child,node,name); offset=child.end;
    }
    return result+source.slice(offset,node.end);
  }
  return render(ast);
}

function create(filename) {
  let active = null;
  const observer = {
    readOptional(object, key) {
      return object == null ? undefined : observer.read(object,key());
    },
    read(object, key) {
      if (active && active.isSource(object)) {
        // Convert once with native ToPropertyKey (including symbol and object
        // keys); reuse the converted key for the actual indexed access.
        const property = Reflect.ownKeys({[key]:0})[0];
        if (typeof property === 'string' && /^(0|[1-9][0-9]*)$/.test(property)) active.counts.indexedSourceReads++;
        return object[property];
      }
      return object[key];
    },
    construct(target, args) {
      const result = Reflect.construct(target,args);
      if (active) active.allocation(result,args);
      return result;
    },
  };
  const source = loadedSource(filename), transformed = instrument(source);
  const m = new Module(filename, module);
  m.filename=filename; m.paths=Module._nodeModulePaths(require('node:path').dirname(filename));
  m.__renderOperationObserver=observer;
  const body = parser().parse(transformed,{ecmaVersion:'latest',sourceType:'script'}).body;
  const insertion = body.find(node=>!node.directive)?.start ?? transformed.length;
  // Keep any original directive prologue, especially 'use strict', effective.
  m._compile(transformed.slice(0,insertion)+
    'const __renderOperationObserver=module.__renderOperationObserver;\n'+
    transformed.slice(insertion), filename+'.observed');
  return {exports:m.exports, enter(scope) {
    if (active) throw Error('nested measurement');
    active=scope; return () => {active=null;};
  }};
}
module.exports = {create, instrument};
