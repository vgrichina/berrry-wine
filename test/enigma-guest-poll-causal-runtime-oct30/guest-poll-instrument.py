"""Exact-base opt-in observer; no guest or renderer mutations."""
import pathlib,hashlib,json,sys
def instrument(s):
 assert hashlib.sha256(s.encode()).hexdigest()=='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e'
 marker='  // Default hwnd routing: keyboard messages'
 addition='''  // Task-owned bounded observer of the actual import, armed through control.
  const guestPollTrace = { enabled: hasFlag('trace-input-poll'), armed: false, entries: 0, emitted: 0 };
  const guestPollState = () => ({ batch: tickState.batch, pending: inputEvent,
    crossThreadDepth: crossThreadMsgs.length, buttonQueueDepth: inputQueue ? inputQueue.length : 0,
    rendererDepth: renderer && renderer.inputQueue ? renderer.inputQueue.length : 0,
    rendererHead: renderer && renderer.inputQueue ? renderer.inputQueue[0] || null : null,
    choice: inputEvent ? 'pending' : crossThreadMsgs.length ? 'cross-thread' : inputQueue && inputQueue.length ? 'button-queue' : renderer ? 'renderer' : 'none' });
  if (guestPollTrace.enabled) {
    const actualCheckInput = h.check_input;
    h.check_input = () => {
      guestPollTrace.entries++;
      const observe = guestPollTrace.armed && guestPollTrace.emitted < 128;
      if (observe) logs.push('[guest-poll] ' + JSON.stringify({ phase: 'entry', entry: guestPollTrace.entries, ...guestPollState() }));
      const result = actualCheckInput();
      if (observe) { guestPollTrace.emitted++; logs.push('[guest-poll] ' + JSON.stringify({ phase: 'return', entry: guestPollTrace.entries, result, event: lastInputEvent, ...guestPollState() })); }
      return result;
    };
  }
'''
 assert s.count(marker)==1;s=s.replace(marker,addition+marker)
 marker="    if (cmd.action === 'message-boundary') {"
 addition="""    if (cmd.action === 'guest-poll') {
      if (!guestPollTrace.enabled) throw new Error('requires --trace-input-poll');
      if (typeof cmd.on === 'boolean') guestPollTrace.armed = cmd.on;
      return { ...guestPollTrace, ...guestPollState() };
    }
"""
 assert s.count(marker)==1;return s.replace(marker,addition+marker)
if __name__=='__main__':
 p=pathlib.Path(sys.argv[1]);s=instrument(p.read_text());p.write_text(s)
 print(json.dumps(dict(base='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e',instrumented=hashlib.sha256(s.encode()).hexdigest())))
