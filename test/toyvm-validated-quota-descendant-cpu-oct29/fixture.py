import os
child = os.fork()
if child == 0:
    value = 1
    while True:
        value = (value * 1664525 + 1013904223) & 0xffffffff
else:
    os.waitpid(child, 0)
