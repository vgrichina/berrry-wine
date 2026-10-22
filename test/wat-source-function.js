'use strict';

// Extract verbatim function text for small source fixtures. Mask strings and
// nested comments before balancing, so neither can end a function early.
function sourceFunction(source, name) {
  let masked = '', block = 0, string = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (string) {
      masked += ' ';
      if (c === '\\') { masked += ' '; i++; }
      else if (c === '"') string = false;
    } else if (block) {
      masked += ' ';
      if (c === '(' && n === ';') { block++; masked += ' '; i++; }
      else if (c === ';' && n === ')') { block--; masked += ' '; i++; }
    } else if (c === ';' && n === ';') {
      const end = source.indexOf('\n', i);
      const size = (end < 0 ? source.length : end) - i;
      masked += ' '.repeat(size); i += size - 1;
    } else if (c === '(' && n === ';') { block++; masked += '  '; i++; }
    else if (c === '"') { string = true; masked += ' '; }
    else masked += c;
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp('\\(func \\$' + escaped + '(?=[\\s(])').exec(masked);
  if (!match) throw new Error('Missing function ' + name);
  const start = match.index;
  let depth = 0;
  for (let i = start; i < masked.length; i++) {
    if (masked[i] === '(') depth++;
    if (masked[i] === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unbalanced function ' + name);
}

module.exports = { sourceFunction };
