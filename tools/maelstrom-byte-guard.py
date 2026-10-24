#!/usr/bin/env python3
"""Shared declared/actual byte guard used by acquisition and local rejection probes."""
import sys

def guard(size, limit):
    if not 0 <= size <= limit:
        raise ValueError('metadata/stream byte guard rejected: %d > %d' % (size, limit))

if __name__ == '__main__':
    try: guard(int(sys.argv[1]), int(sys.argv[2]))
    except ValueError as e:
        print(str(e), file=sys.stderr)
        sys.exit(42)
