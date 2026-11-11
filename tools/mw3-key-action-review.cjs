'use strict';
const assert = require('node:assert/strict');

// Enter has two shipped meanings. A cockpit command must explicitly identify
// its purpose and the personally reviewed cockpit cues. The ordinary identity,
// screenshot hash, deadline and input admission checks still run afterwards.
function validate(review, command, pilot) {
  assert(command.action === 'key' && ['a', 'Enter'].includes(command.key));
  if (command.cockpitAction !== undefined) {
    assert(command.key === 'Enter' && command.cockpitAction === 'cycle-weapon' &&
      command.pilotDialog !== true, 'explicit cockpit weapon-cycle command required');
    assert(review.scene === 'cockpit' && review.fullImageReviewed === true,
      'actual full cockpit review required');
    assert(review.cockpitControls?.includes('weapons') && review.cockpitControls?.includes('speed') &&
      typeof review.selectedWeapon === 'string' && review.selectedWeapon.trim().length > 0 &&
      review.selectedWeapon.length <= 80, 'reviewed cockpit weapon selection and speed controls required');
    return;
  }
  return pilot(review, command);
}

function install(source) {
  const old = "if(c.action==='key'&&['a','Enter'].includes(c.key)&&(!process.env.LOCAL_PRODUCTION_FIXTURE||c.pilotDialog))require('../20261110-mw3-complete-fixture-closure-combat-2135/target.cjs').pilot(review,c);";
  assert.equal(source.split(old).length, 2, 'exact ordinary pilot key guard required');
  return source.replace(old,
    "if(c.action==='key'&&['a','Enter'].includes(c.key)&&(!process.env.LOCAL_PRODUCTION_FIXTURE||c.pilotDialog||c.cockpitAction!==undefined))require(root+'/tools/mw3-key-action-review.cjs').validate(review,c,require('../20261110-mw3-complete-fixture-closure-combat-2135/target.cjs').pilot);");
}

module.exports = {validate, install};
