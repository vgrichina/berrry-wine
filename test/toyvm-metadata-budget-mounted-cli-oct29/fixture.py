import pathlib,sys
p=pathlib.Path(sys.argv[1])
assert p.is_absolute()
with p.open("wb") as f: f.write(b"x" * int(sys.argv[2]))
p.unlink()
print("TINY_FIXTURE_COMPLETED")
