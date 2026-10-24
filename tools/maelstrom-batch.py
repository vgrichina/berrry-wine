#!/usr/bin/env python3
"""Run acquisition steps in order, propagating the first failure unchanged."""
import json, subprocess, sys

def batch(steps):
    for step in steps:
        result = subprocess.run(step, timeout=60)
        if result.returncode:
            return result.returncode
    return 0

if __name__ == '__main__':
    sys.exit(batch(json.load(open(sys.argv[1]))))
