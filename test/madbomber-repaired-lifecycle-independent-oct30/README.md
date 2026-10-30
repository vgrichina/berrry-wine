Scoped independent acceptance of repair 87943e00f951c70d0f8aefe12a76d3670709921a.

Run from the pinned repository root, through the assigned resource supervisor:

    python3 ../ops.py independent-controls node --max-old-space-size=192 test/madbomber-repaired-lifecycle-independent-oct30/accept.js

The test verifies all 26 pins, independently checks helper extraction and storage, and exercises seven adversarial controls in memory. It writes no staged inputs. See report.json for evidence and limits. This does not qualify full VM execution, browsers, audio output or gameplay.
