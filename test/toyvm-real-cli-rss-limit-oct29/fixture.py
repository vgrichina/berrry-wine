import time
memory = bytearray(96 * 1024 * 1024)
for offset in range(0, len(memory), 4096):
    memory[offset] = 1
time.sleep(30)
