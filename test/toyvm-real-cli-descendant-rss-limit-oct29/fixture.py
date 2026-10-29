import subprocess, sys
child = subprocess.Popen([sys.executable, "-B", "-c", "import time; allocation = bytearray(96 * 1024 * 1024); time.sleep(6)"])
child.wait()
