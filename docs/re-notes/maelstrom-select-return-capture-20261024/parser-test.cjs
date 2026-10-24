const e={},regValue=n=>n==="esp"?100:null,g2w=x=>x,dv={getUint32:x=>x===120?240:0};const fs=require("fs"),vm=require("vm"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[2])).slice(4);const getArg = (name, def) => {
  const prefix = `--${name}=`;
  const arg = args.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : def;
};
const getArgs = name => {
  const prefix = `--${name}=`;
  return args.filter(value => value.startsWith(prefix))
    .flatMap(value => value.slice(prefix.length).split(','))
    .map(value => value.trim()).filter(Boolean);
};
const hasFlag = name => args.includes(`--${name}`);

const TRACE_AT = getArg('trace-at', null); // --trace-at=0xADDR: log regs each time EIP hits addr (non-interactive)
const TRACE_AT_DUMP = getArg('trace-at-dump', null); // --trace-at-dump=0xADDR:LEN[,0xADDR:LEN,...]: hexdump these regions on each --trace-at hit
const TRACE_AT_MEM = getArg('trace-at-mem', null); // --trace-at-mem=REG+OFF:LEN[,ADDR:LEN]: log memory at each --trace-at hit
const TRACE_AT_START_BATCH = parseInt(getArg('trace-at-start-batch', '0'), 10) || 0; // delay --trace-at logging until batch N
const TRACE_AT_LIMIT = parseInt(getArg('trace-at-limit', '0'), 10) || 0; // stop logging after N --trace-at hits (0 = unlimited)
const BREAK_API = getArg('break-api', null); // --break-api=Name[,Name,...]: break on API call
// --trace-api-mem=Name:ARG:LEN[,...]: at each entry of API Name, hexdump LEN
// bytes at the guest pointer in stdcall argument ARG (0-based). For buffers
// built on the stack just before the call (colour tables, rects, structs).
const TRACE_API_MEM = (getArg('trace-api-mem', '') || '').split(',').filter(Boolean).map(spec => {
  const [name, arg, len] = spec.split(':');
  return { name, arg: parseInt(arg, 10) || 0, len: Math.min(parseInt(len, 10) || 64, 4096) };
});
const WATCH_SPEC = getArg('watch', null);    // --watch=0xADDR: break on memory change (dword)
const WATCH_BYTE = getArg('watch-byte', null);   // --watch-byte=0xADDR: byte-granularity watch
const WATCH_WORD = getArg('watch-word', null);   // --watch-word=0xADDR: 16-bit watch
const WATCH_VALUE = getArg('watch-value', null); // --watch-value=0xVAL: only break when watch becomes this value
const WATCH_LOG = hasFlag('watch-log');          // --watch-log: log each change and keep running (no debug prompt)
const WATCH_START_BATCH = parseInt(getArg('watch-start-batch', '0'), 10) || 0; // delay arming --watch until batch N
const WATCH_JS_ONLY = hasFlag('watch-js-only');  // --watch-js-only: sample in JS only; do not arm WAT watchpoint
const traceAtMem = TRACE_AT_MEM ? TRACE_AT_MEM.split(',').map(s => {
  // The length follows the LAST colon: a Win16 far expression has its own
  // (es:esi-2:64 is es:esi-2 for 64 bytes).
  const cut = s.lastIndexOf(':');
  const [expr, l] = cut > 0 && /^(\d+|s)$/i.test(s.slice(cut + 1).trim())
    ? [s.slice(0, cut), s.slice(cut + 1)] : [s, ''];
  const str = /^s$/i.test((l || '').trim());
  return { expr: (expr || '').trim(), len: str ? 0 : (parseInt(l) || 4), str };
}).filter(d => d.expr) : [];
            const parseAddrExpr = (expr) => {
              let s = String(expr || '').replace(/^\[/, '').replace(/\]$/, '').trim();
              let deref = false;
              if (s.startsWith('*')) { deref = true; s = s.slice(1).trim(); }
              const inner = parseAddrExprBase(s);
              if (inner === null || !deref) return inner;
              try { return dv.getUint32(g2w(inner), true) >>> 0; } catch (_) { return null; }
            };
            const parseAddrExprBase = (s) => {
              // Win16 far form, e.g. es:esi-2 (a VB p-code pointer): the
              // selector's base from the loader's table plus the offset.
              const far = s.match(/^(cs|ds|es|ss):(.+)$/i);
              if (far && e.win16_seg_base) {
                const sel = e[`get_sreg_${far[1].toLowerCase()}`]?.();
                const off = parseAddrExprBase(far[2].trim());
                if (sel === undefined || off === null) return null;
                return (e.win16_seg_base(sel >>> 3) + (off & 0xffff)) >>> 0;
              }
              const m = s.match(/^(e(?:ax|bx|cx|dx|sp|bp|si|di|ip))\s*([+-])?\s*(0x[0-9a-fA-F]+|\d+)?$/i);
              if (m) {
                const base = regValue(m[1]);
                if (base === null) return null;
                const off = m[3] ? parseInt(m[3]) : 0;
                return ((m[2] === '-') ? (base - off) : (base + off)) >>> 0;
              }
              const addr = parseInt(s, 16);
              return Number.isFinite(addr) ? (addr >>> 0) : null;
            };

assert.equal(getArg("trace-from"),"30000");assert.equal(TRACE_AT,"0x406378");assert.equal(TRACE_AT_LIMIT,1);assert.equal(TRACE_AT_START_BATCH,30000);assert.equal(traceAtMem[0].expr,"esp");assert.equal(parseAddrExpr("*esp+20"),240);assert.equal(parseAddrExpr("esp"),100);console.log(JSON.stringify({pass:true,traceFrom:true,traceAt:true,pointer:true}));