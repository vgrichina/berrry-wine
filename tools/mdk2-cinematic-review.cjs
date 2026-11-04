'use strict';
const assert = require('node:assert/strict');

// Human classification of original post-cancel pixels permits observation only.
// Native input, identity, receipts and finite-budget admission belong to the
// caller; this function neither infers playable readiness nor submits input.
function cinematicReview(review, action) {
  assert.equal(action, 'observe-post-cancel', 'cinematic observation only');
  const expected = {
    screen: 'postcancel-cinematic', originalScene: 'level1-intro-a-cinematic',
    selection: 'none', transitioning: false, tutorialVisible: false,
    unsupportedSceneVisible: false, comicPanelsVisible: false,
    loadingVisible: false, cinematicVisible: true, playableReadiness: false,
  };
  for (const [field, value] of Object.entries(expected))
    assert.equal(review[field], value, 'cinematic review: ' + field);
}

module.exports = {cinematicReview};
