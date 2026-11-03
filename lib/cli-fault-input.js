'use strict';

// Host-only teardown of input owned by the CLI. The optional button queue is
// null until --buttons is used; preserve that sentinel used by startup input.
// Never synthesize guest key-up calls while a native fault is retained.
function releaseFaultInput(state) {
  const { renderer, inputQueue, scheduledInput, crossThreadMsgs } = state;
  if (renderer) {
    renderer._asyncKeys = Object.create(null);
    renderer._physicalKeys = Object.create(null);
    renderer._asyncPressedKeys = Object.create(null);
    renderer._modifierOwners = Object.create(null);
    renderer._modifierPhysicalMap = renderer._physicalKeys;
    renderer._mouseButtonsMask = 0;
    renderer._activeInputEvent = null;
    if (renderer.inputQueue) renderer.inputQueue.length = 0;
    for (const ref of renderer._diKeyboardClients || []) {
      for (const buffer of ref.deref()?.values() || []) {
        buffer.events.fill(undefined);
        buffer.head = buffer.length = 0;
        buffer.overflow = false;
      }
    }
  }
  if (inputQueue) inputQueue.length = 0;
  scheduledInput.length = 0;
  crossThreadMsgs.length = 0;
  state.inputEvent = null;
  return { keyboardDown: Object.keys(renderer?._physicalKeys || {}),
    asyncDown: Object.keys(renderer?._asyncKeys || {}),
    mouseButtons: renderer?._mouseButtonsMask || 0,
    pendingInput: (inputQueue?.length || 0) + (renderer?.inputQueue?.length || 0)
      + scheduledInput.length + crossThreadMsgs.length };
}

module.exports = { releaseFaultInput };
