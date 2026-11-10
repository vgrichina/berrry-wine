"""Prepare a reviewed Q3 request without dispatching input.

Absolute screen points do not position the game's UI cursor in relative mode.
This caller check precedes the existing numbered sender. Runtime ownership,
freshness, bounded delivery and balanced release remain enforced by that sender.
"""
import argparse
import json
from pathlib import Path


def request(observation, command, review):
    assert observation['status'] == 'ready', 'personally reviewed ready image required'
    assert isinstance(review, str) and review.strip(), 'personal full-image review text required'
    capture = observation['capture']
    assert command.get('reviewRef') == capture['label'], 'review must name the observed image'
    if command['action'] in ('click', 'doubleclick', 'drag'):
        observer = observation.get('inputObservation') or {}
        assert observer.get('active') is True, 'active captured input mode required for a point command'
        mode = (observer.get('state') or {}).get('mode')
        if 'relativeCounts' in command:
            assert command['action'] == 'click' and mode == 'locked', \
                'explicit relative click requires captured canvas Pointer Lock'
        else:
            assert mode == 'absolute', \
                'absolute point unavailable in relative/unknown mode; use a reviewed ordinary key or explicit relative counts after Pointer Lock'
    return dict(command=dict(command), review=review)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('observation', type=Path)
    parser.add_argument('command', type=Path)
    parser.add_argument('review', type=Path)
    args = parser.parse_args()
    print(json.dumps(request(json.loads(args.observation.read_bytes()),
                             json.loads(args.command.read_bytes()), args.review.read_text())))
