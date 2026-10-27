import pathlib,json
h=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27');paths=['serial/checkpoint.json','serial/paused.json','serial/decision-done.json','serial/first-failure.json','serial/done.json','guest/terminal.json','guest/supervision.json','guest/spawn-or-wait-exception.json'];print(json.dumps({p:(h/p).read_text()[-3500:] for p in paths if (h/p).exists()}))
