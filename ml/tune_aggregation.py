"""
Tune how per-region predictions are combined into a face-level answer, without retraining.

Two ideas tested against the global max-over-all-regions rule:
  * region-aware: a concern only counts from the regions it was trained on (REGIONS_FOR);
  * per-concern thresholds: tuned on the DATASET validation faces with a cap on false alarms
    for clear faces. The real-world photos (ml/eval) are only used for the final check.

Usage:
  python ml/tune_aggregation.py MODEL_DIR [--write]
      region scores computed here in Python
  python ml/tune_aggregation.py MODEL_DIR --browser VAL.json REAL.json [--write]
      region scores recorded from the web app itself (headless browser), so the thresholds fit the
      pipeline users actually run. --write stores the result in labels.json.
"""

import csv
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

ML = Path(__file__).parent
os.environ.setdefault('LANDMARKER_PATH', str(ML / 'data' / 'face_landmarker.task'))
sys.path.insert(0, str(ML))
import train_skin_models as T  # noqa: E402

MAX_FALSE_ALARM = 0.15
GRID = np.round(np.arange(0.4, 0.99, 0.025), 3)


def local_path(kaggle_path):
    """/kaggle/input/datasets/<owner>/<slug>/... or /kaggle/input/<slug>/... -> ml/data/<slug>/..."""
    if '/datasets/' in kaggle_path:
        _, slug, rest = kaggle_path.split('/datasets/', 1)[1].split('/', 2)
    else:
        slug, rest = kaggle_path.split('/kaggle/input/', 1)[1].split('/', 1)
    return ML / 'data' / slug / rest


def face_region_probs(session, tf, path):
    """Per-region probabilities exactly as the web app computes them (sRGB, 6-view averaging)."""
    img = T.load_rgb(path)
    lm = T.detect_landmarks(img)
    if lm is None or np.linalg.norm(lm[234] - lm[454]) < T.MIN_FACE_FRACTION * max(img.size):
        return None
    patches = T.cut_patches(img, lm, list(T.REGIONS))
    if not patches:
        return None
    return T.predict_patches(session, patches)


def aggregate(region_probs, classes, thresholds, region_aware):
    best = {}
    for c_i, c in enumerate(classes):
        if c == 'clear':
            continue
        allowed = T.REGIONS_FOR[c] if region_aware else region_probs.keys()
        vals = [p[c_i] for r, p in region_probs.items() if r in allowed]
        best[c] = max(vals) if vals else 0.0
    hits = {c: v for c, v in best.items() if v >= thresholds[c]}
    return (max(hits, key=hits.get) if hits else 'clear'), hits


def score(faces, classes, thresholds, region_aware, drop=()):
    """Truth may list several concerns ('wrinkles|dark_spots'). top1: the top answer is one of
    them; recall: per true concern, was it reported; precision: per reported concern, was it true.
    `drop`: concerns the app would not report at all (e.g. ones invisible at selfie resolution)."""
    hit = fa = n_clear = found = n_conc = reported = correct = 0
    th = {c: (1.01 if c in drop else t) for c, t in thresholds.items()}
    for truth, rp in faces:
        truth_set = set(truth.split('|')) - set(drop)
        if not truth_set:
            truth_set = {'clear'}
        top, hits = aggregate(rp, classes, th, region_aware)
        hit += top in truth_set
        reported += len(hits)
        correct += len(set(hits) & truth_set)
        if truth_set == {'clear'}:
            n_clear += 1
            fa += top != 'clear'
        else:
            n_conc += len(truth_set)
            found += len(set(hits) & truth_set)
    return {'top1': hit / len(faces), 'false_alarm': fa / max(n_clear, 1), 'recall': found / max(n_conc, 1),
            'precision': correct / max(reported, 1), 'n': len(faces), 'fa_str': f'{fa}/{n_clear}',
            'found_str': f'{found}/{n_conc}'}


def tune_per_class(faces, classes, region_aware, drop=()):
    """Greedy coordinate search: raise/lower one concern's threshold at a time."""
    concerns = [c for c in classes if c != 'clear' and c not in drop]
    th = {c: (1.01 if c in drop else 0.9) for c in classes if c != 'clear'}
    for _ in range(3):
        for c in concerns:
            best_t, best_obj = th[c], -1
            for t in GRID:
                cand = {**th, c: float(t)}
                s = score(faces, classes, cand, region_aware, drop)
                obj = s['top1'] if s['false_alarm'] <= MAX_FALSE_ALARM else -1 + s['top1']
                if obj > best_obj:
                    best_t, best_obj = float(t), obj
            th[c] = best_t
    return th


def load_browser_faces(path, classes):
    """JSON rows {label, regions: {region: [prob per class]}} -> [(label, {region: np.array})]."""
    as_probs = lambda v: np.array(v['probs'] if isinstance(v, dict) else v, dtype=np.float32)
    return [(r['label'], {k: as_probs(v) for k, v in r['regions'].items()})
            for r in json.loads(Path(path).read_text()) if r.get('regions')]


def main():
    model_dir = Path(sys.argv[1])
    spec = json.loads((model_dir / 'labels.json').read_text())
    classes = spec['classes']
    if '--browser' in sys.argv:
        i = sys.argv.index('--browser')
        val_faces = load_browser_faces(sys.argv[i + 1], classes)
        real = load_browser_faces(sys.argv[i + 2], classes)
        report(spec, classes, val_faces, real, model_dir, source='browser')
        return

    session = ort.InferenceSession(str(model_dir / spec['model_file']), providers=['CPUExecutionProvider'])
    tf = T.transforms_for(train=False)
    T._init_landmarker()

    val_faces = []
    for r in csv.DictReader(open(model_dir / 'manifest.csv')):
        if r['split'] != 'val':
            continue
        p = local_path(r['path'])
        if not p.exists():
            continue
        rp = face_region_probs(session, tf, p)
        if rp:
            val_faces.append((r['label'], rp))
    real = []
    for r in csv.DictReader(open(ML / 'eval' / 'labels.csv')):
        if r['label'] in ('skip', ''):
            continue
        rp = face_region_probs(session, tf, ML / 'eval' / 'images' / r['file'])
        if rp:
            real.append((r['label'], rp))
    report(spec, classes, val_faces, real, model_dir, source='python')


def report(spec, classes, val_faces, real, model_dir, source):
    print(f'[{source}] dataset val faces: {len(val_faces)} | real-world faces: {len(real)}')
    results = {}
    for region_aware in (False, True):
        tag = 'region-aware' if region_aware else 'all-regions'
        g = spec['face_threshold']
        glob_th = {c: g for c in classes if c != 'clear'}
        per_th = tune_per_class(val_faces, classes, region_aware)
        for name, th in ((f'{tag} global {g}', glob_th), (f'{tag} per-concern', per_th)):
            v, rw = score(val_faces, classes, th, region_aware), score(real, classes, th, region_aware)
            results[name] = {'thresholds': th, 'val': v, 'real': rw}
            print(f'{name:32s} VAL top1 {v["top1"]:.0%} FA {v["false_alarm"]:.0%} recall {v["recall"]:.0%} | '
                  f'REAL top1 {rw["top1"]:.0%} clear flagged {rw["fa_str"]} found {rw["found_str"]}')
        print(f'  per-concern thresholds ({tag}): {per_th}')

    if '--write' in sys.argv:
        best = results['region-aware per-concern']
        spec['concern_thresholds'] = best['thresholds']
        spec['regions_for'] = T.REGIONS_FOR
        spec['aggregation'] = ('per concern: max probability over the regions in regions_for[concern]; '
                               'reported if >= concern_thresholds[concern]; none reported => clear')
        spec['tuning'] = {'scores_from': source, 'val': best['val'], 'real_world': best['real'],
                          'max_false_alarm': MAX_FALSE_ALARM}
        (model_dir / 'labels.json').write_text(json.dumps(spec, indent=2))
        print('wrote', model_dir / 'labels.json')


if __name__ == '__main__':
    main()
