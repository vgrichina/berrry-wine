'use strict';
// Generate the retained KKnD host driver before allocating its original.
// The watchdog owns hardDeadlineMs; the driver leaves time for final recovery.
const fs = require('node:fs');

function generate(source, hardDeadlineMs, recoveryMs = 180000, now = Date.now()) {
  for (const [name, value] of Object.entries({hardDeadlineMs, recoveryMs, now})) {
    if (!Number.isSafeInteger(value) || value <= 0) throw Error('invalid ' + name);
  }
  const until = hardDeadlineMs - recoveryMs;
  if (until <= now) throw Error('no gameplay time before recovery');
  const old = "capture('power-on');const until=Date.now()+1800000;";
  const command = 'deadline=Date.now()+1000*(command.seconds||8);';
  if (source.split(old).length !== 2 || source.split(command).length !== 2) {
    throw Error('driver template changed; inspect deadline boundaries');
  }
  let result = source.replace(old, `capture('power-on');const until=${until};\n` +
    ` put('deadline.json',{hardDeadlineMs:${hardDeadlineMs},recoveryMs:${recoveryMs},driverUntilMs:until,startedMs:Date.now(),relativeReset:false});\n` +
    " if(Date.now()>=until)throw Error('driver deadline elapsed before original loop');");
  result = result.replace(command, 'deadline=Math.min(until,Date.now()+1000*(command.seconds||8));');
  result = result.replace("finally{put('diagnostic-history.json'", "finally{put('deadline-terminal.json',{atMs:Date.now(),driverUntilMs:until,deadlineReached:Date.now()>=until});put('diagnostic-history.json'");
  if (/1800000|Date\.now\(\)\s*\+\s*(?:30\s*\*\s*60|1800)\s*\*?\s*1000?/.test(result)) {
    throw Error('stale relative original deadline');
  }
  return result;
}

module.exports = {generate};
if (require.main === module) {
  const [input, output, deadline, reserve] = process.argv.slice(2);
  const result = generate(fs.readFileSync(input, 'utf8'), Number(deadline), reserve === undefined ? 180000 : Number(reserve));
  fs.writeFileSync(output, result, {flag: 'wx'});
}
