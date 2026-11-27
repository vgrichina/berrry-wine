// tl;dr: per arm64 disassembly file: instruction count, stack-slot refs
// ([sp..]/[x29..] loads+stores), direct calls (bl), indirect branches (br/blr),
// and the header byte size. Usage: node count.js FILE...
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const t = fs.readFileSync(f, 'utf8'); const hdr = (t.match(/: (\d+) bytes of (\w+) code/) || []);
  const ins = t.split('\n').filter(l => /^\s+[0-9a-f]+:\s+[0-9a-f]{8}\s/.test(l)).map(l => l.split('\t').slice(1).join(' ').trim());
  const stack = ins.filter(i => /\[(sp|x29)(,|\])/.test(i) && /^(ldr|str|ldp|stp|ldur|stur)/.test(i)).length;
  const bl = ins.filter(i => /^bl\s/.test(i)).length, ind = ins.filter(i => /^(br|blr)\s/.test(i)).length;
  console.log(`${f.split('/').pop().padEnd(26)} bytes=${hdr[1]} insns=${ins.length} stack=${stack} bl=${bl} br/blr=${ind}`);
}
