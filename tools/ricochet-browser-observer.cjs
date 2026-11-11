'use strict';

// Attaching a second Puppeteer client otherwise applies its 800x600 default
// viewport to existing pages. That invalidates the driver's reviewed screenshot
// coordinates even though the observer only evaluates read-only expressions.
async function connectObserver(puppeteer, browserWSEndpoint) {
  if (typeof browserWSEndpoint !== 'string' || !browserWSEndpoint.startsWith('ws://127.0.0.1:')) {
    throw new Error('expected owned loopback browser endpoint');
  }
  return puppeteer.connect({browserWSEndpoint, defaultViewport: null});
}

module.exports = {connectObserver};
