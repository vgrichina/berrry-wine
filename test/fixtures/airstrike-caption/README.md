# Airstrike caption fixtures

These six byte-exact historical inputs close the offline caption and Console
obscuration tests. `manifest.json` records original byte counts and SHA-256 pins.
The JavaScript files are historical source text for static assertions; tests do
not execute JavaScript or replace it with the current renderer. The PNG is the
original lossless retained image. JSON path fields remain historical metadata;
tests resolve all fixture reads relative to this directory.

`reproduce.py` is unchanged, including its original vulnerability assertions.
The caption test copies it and the pinned renderer into a cleaned temporary
directory beside a temporary `repo` symlink. Its final vulnerability assertion
intentionally exits 1 after recording PASS with zero Controller CLI commands
and zero Bridge inputs for the height-8 window.

Run with Python's standard library only:

```
python3 -B test/test-airstrike-caption-interior.py
python3 -B test/test-airstrike-console-obscuration.py
```

All generated protocol, review and image outputs belong to automatically cleaned
temporary directories. No predecessor evidence, guest binaries, startup logs,
Node packages or external test data are required.
