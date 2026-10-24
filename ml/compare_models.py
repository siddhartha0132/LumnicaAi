"""
Compare candidate models / combinations on scores recorded in the browser.

Each candidate is tuned (per-concern thresholds, region-aware) on validation faces only, then
scored on the real-world photos. Combinations average the two models' per-region probabilities
and are tuned on validation images that BOTH models held out (in one model's val split and the
other's, hence trained on by neither).

Usage:
  python ml/compare_models.py --model NAME VAL.json REAL.json [--model ...] [--pair A,B ...]
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from tune_aggregation import score, tune_per_class  # noqa: E402

CLASSES = ['acne', 'clear', 'comedones', 'dark_spots', 'pores', 'redness', 'wrinkles']
DROP_SMALL = ('comedones', 'pores')  # hard to see at selfie resolution


def load(path):
    out = {}
    for r in json.loads(Path(path).read_text()):
        if not r.get('regions'):
            continue
        regions = {k: np.array(v['probs'] if isinstance(v, dict) else v, dtype=np.float32)
                   for k, v in r['regions'].items()}
        out[r.get('path') or r.get('file')] = (r['label'], regions)
    return out


def combine(a, b):
    keys = a.keys() & b.keys()
    faces = {}
    for k in keys:
        ra, rb = a[k][1], b[k][1]
        common = ra.keys() & rb.keys()
        if common:
            faces[k] = (a[k][0], {r: (ra[r] + rb[r]) / 2 for r in common})
    return faces


def evaluate(name, val, real, rows):
    for drop in ((), DROP_SMALL):
        th = tune_per_class(list(val.values()), CLASSES, True, drop)
        v = score(list(val.values()), CLASSES, th, True, drop)
        r = score(list(real.values()), CLASSES, th, True, drop)
        label = name + (' (no pores/blackheads)' if drop else '')
        rows.append((label, v, r, th))
        print(f'{label:40s} VAL n={v["n"]:4d} top1 {v["top1"]:.0%} FA {v["false_alarm"]:.0%} | '
              f'REAL n={r["n"]} top1 {r["top1"]:.0%} clear flagged {r["fa_str"]} '
              f'recall {r["found_str"]} precision {r["precision"]:.0%}', flush=True)


def main():
    args = sys.argv[1:]
    models, pairs = {}, []
    i = 0
    while i < len(args):
        if args[i] == '--model':
            models[args[i + 1]] = (load(args[i + 2]), load(args[i + 3]))
            i += 4
        elif args[i] == '--pair':
            pairs.append(args[i + 1].split(','))
            i += 2
        else:
            raise SystemExit(f'unknown argument {args[i]}')

    rows = []
    for name, (val, real) in models.items():
        evaluate(name, val, real, rows)
    for a, b in pairs:
        val = combine(models[a][0], models[b][0])
        real = combine(models[a][1], models[b][1])
        evaluate(f'{a}+{b}', val, real, rows)
    best = max(rows, key=lambda t: (t[1]['top1'] if t[1]['false_alarm'] <= 0.15 else -1))
    print(f'\nbest on VALIDATION (the selection rule): {best[0]}  thresholds {best[3]}')


if __name__ == '__main__':
    main()
