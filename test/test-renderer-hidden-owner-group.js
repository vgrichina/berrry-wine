#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const {Win98Renderer} = require('../lib/renderer');
const renderer = Object.create(Win98Renderer.prototype);
renderer._nextZ = 30;
const win = (hwnd, ownerHwnd, visible, zOrder, isChild=false) => ({hwnd,ownerHwnd,visible,zOrder,isChild});
renderer.windows = {
  1: win(1,0,true,22),
  2: win(2,1,false,16),
  3: win(3,2,true,17),
  4: win(4,2,true,20),
  5: win(5,0,true,25),
  6: win(6,2,true,26,true),
};
renderer._raiseWindowGroup(renderer.windows[1]);
assert(renderer.windows[3].zOrder > renderer.windows[1].zOrder,
  'visible dialog must stay above owner through hidden intermediate owner');
assert(renderer.windows[4].zOrder > renderer.windows[3].zOrder,
  'existing sibling dialog order must survive owner-group raise');
assert.equal(renderer.windows[2].zOrder,16,'hidden owner is traversed without raising it');
assert.equal(renderer.windows[5].zOrder,25,'unrelated top-level unchanged');
assert.equal(renderer.windows[6].zOrder,26,'child-window stacking unchanged');
assert.equal(renderer.windows[2].visible,false,'raise must not show hidden owner');
// Activating the descendant follows its ownership chain and keeps both dialogs.
renderer._raiseWindowGroup(renderer.windows[4]);
assert(renderer.windows[3].zOrder > renderer.windows[1].zOrder);
assert(renderer.windows[4].zOrder > renderer.windows[3].zOrder);
// Multiple hidden owner levels, with an owner cycle, still terminate.
renderer.windows = {1:win(1,2,true,1),2:win(2,1,false,2),3:win(3,2,false,3),4:win(4,3,true,4)};
renderer._raiseWindowGroup(renderer.windows[1]);
assert(renderer.windows[4].zOrder > renderer.windows[1].zOrder);
assert.equal(renderer.windows[2].visible,false);
assert.equal(renderer.windows[3].visible,false);
console.log('PASS renderer owner groups cross hidden owners, preserve sibling/child order and terminate cycles');
