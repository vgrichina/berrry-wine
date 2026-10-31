Current 2026-10-31T04:52Z — coordinator 01a19022-1426-76b3-ae98-6265fb15fd66.

Owner seven-topic triage reviewed: four commits pushed — CRT remove431e1922b, Uplink dialog overlay9e0860421, Win16 invalid handlesbedaaaa7f, ToyVM selectors/real-mode D68ac26542. Focused regressions and full build passed before each. Three topics already present/superseded. CRT jumps remain blocked by invocation ownership/dual-dispatch prerequisite; remaining work recorded in TODOS. Baseline ToyVM IP-width failure unchanged; stencil harness missing puppeteer. Run20261031T0443Z-land-seven-topics.

Two gameplay workers now run: Deus Ex Training browser and UT2004 DM-Rankin browser. UT waits for Deus Ex runtime release; all game runtimes hold /tmp/wine-browser.lock. Heavy benchmarks use separate boats.

UT2004 CLI movement/look/fire2342e9288, ReVolt WebGL driving59a615fc5 and DeusEx CLI movement849d6a527 remain accepted. Forsaken50bb30050 confirms stale pixels inside known-source GPU target, without established cause/repair. Full GL/D3D27 coverage open. Disk4.6GB, minimum2GB. Laptop fonts/HeroesII protected; no public deployment. No owner input needed.
