"""
Run the concern model on real photos exactly the way the web app does:
face landmarks -> region patches -> ONNX model per patch -> max per concern -> threshold.

Usage:
  python ml/evaluate_real_world.py MODEL_DIR IMAGE [IMAGE ...]     predictions for a few photos
  python ml/evaluate_real_world.py MODEL_DIR --eval                 score ml/eval/labels.csv

ml/eval/labels.csv columns: file, label ('clear' or a concern; 'skip' = unusable), notes.
Writes ml/eval/results.csv and a contact sheet ml/eval/results.jpg when --eval is used.
"""

import csv
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageOps

ML = Path(__file__).parent
os.environ.setdefault('LANDMARKER_PATH', str(ML / 'data' / 'face_landmarker.task'))
sys.path.insert(0, str(ML))
import train_skin_models as T  # noqa: E402  (same region code as training)

EVAL = ML / 'eval'


class Analyzer:
    def __init__(self, model_dir):
        model_dir = Path(model_dir)
        self.spec = json.loads((model_dir / 'labels.json').read_text())
        self.classes = self.spec['classes']
        self.session = ort.InferenceSession(str(model_dir / self.spec['model_file']), providers=['CPUExecutionProvider'])
        self.tf = T.transforms_for(train=False)
        T._init_landmarker()

    def analyze(self, path):
        img = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        lm = T.detect_landmarks(img)
        if lm is None:
            return {'face_found': False, 'reason': 'no_face'}, img, {}
        boxes, face_w = T.region_boxes(lm)
        if face_w < T.MIN_FACE_FRACTION * max(img.size):
            return {'face_found': False, 'reason': 'face_too_small'}, img, boxes
        patches = T.cut_patches(img, lm, list(self.spec['regions']))
        if not patches:
            return {'face_found': False, 'reason': 'no_usable_skin'}, img, boxes

        x = np.stack([self.tf(p).numpy() for p in patches.values()]).astype(np.float32)
        probs = self.session.run(None, {'image': x})[0]
        best = probs.max(axis=0)
        scores = dict(zip(self.classes, best.round(3).tolist()))
        concerns = sorted((c for c in self.classes if c != 'clear' and scores[c] >= self.spec['face_threshold']),
                          key=lambda c: -scores[c])
        regions = {name: self.classes[int(p.argmax())] for name, p in zip(patches, probs)}
        return {'face_found': True, 'concerns': concerns, 'top': concerns[0] if concerns else 'clear',
                'scores': scores, 'regions': regions}, img, {k: boxes[k] for k in patches}


def annotate(img, result, boxes, truth=None):
    img = img.copy()
    img.thumbnail((360, 360))
    scale = img.size[0] / max(1, img.size[0] if not boxes else img.size[0])
    d = ImageDraw.Draw(img)
    text = result.get('top', result.get('reason', '?'))
    if truth:
        mark = 'OK' if truth == text or (truth != 'clear' and truth in result.get('concerns', [])) else 'XX'
        text = f'{mark} true={truth} pred={text}'
    d.rectangle((0, 0, img.size[0], 16), fill=(0, 0, 0))
    d.text((3, 2), text[:60], fill=(255, 255, 0))
    return img


def contact_sheet(tiles, path, cols=6, size=360):
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * size, rows * size), 'white')
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * size, (i // cols) * size))
    sheet.save(path, quality=80)


def evaluate(analyzer):
    labels = [r for r in csv.DictReader(open(EVAL / 'labels.csv')) if r['label'] not in ('skip', '')]
    rows, tiles = [], []
    for r in labels:
        result, img, boxes = analyzer.analyze(EVAL / 'images' / r['file'])
        truth = r['label']
        if not result['face_found']:
            rows.append({'file': r['file'], 'truth': truth, 'pred': 'NO_FACE:' + result['reason'], 'hit': '', 'any_hit': ''})
            continue
        hit = result['top'] == truth
        any_hit = hit or (truth != 'clear' and truth in result['concerns'])
        rows.append({'file': r['file'], 'truth': truth, 'pred': result['top'], 'hit': int(hit), 'any_hit': int(any_hit),
                     'concerns': ' '.join(result['concerns']), 'scores': json.dumps(result['scores'])})
        tiles.append(annotate(img, result, boxes, truth))

    scored = [r for r in rows if r['hit'] != '']
    by = defaultdict(lambda: [0, 0, 0])
    for r in scored:
        by[r['truth']][0] += 1
        by[r['truth']][1] += r['hit']
        by[r['truth']][2] += r['any_hit']
    print(f'{len(labels)} labelled, {len(scored)} with a usable face, {len(rows) - len(scored)} no face')
    print(f'top-1 accuracy {sum(r["hit"] for r in scored) / len(scored):.1%} | '
          f'concern listed {sum(r["any_hit"] for r in scored) / len(scored):.1%}')
    for label, (n, hit, any_hit) in sorted(by.items()):
        print(f'  {label:11s} n={n:3d} top-1 {hit / n:.0%}  listed {any_hit / n:.0%}')
    clear = [r for r in scored if r['truth'] == 'clear']
    if clear:
        print(f'  clear faces flagged with a concern: {sum(1 - r["hit"] for r in clear)}/{len(clear)} '
              f'{Counter(r["pred"] for r in clear if not r["hit"])}')

    with open(EVAL / 'results.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['file', 'truth', 'pred', 'hit', 'any_hit', 'concerns', 'scores'])
        w.writeheader()
        w.writerows(rows)
    contact_sheet(tiles, EVAL / 'results.jpg')


if __name__ == '__main__':
    analyzer = Analyzer(sys.argv[1])
    if sys.argv[2:] == ['--eval']:
        evaluate(analyzer)
    else:
        for p in sys.argv[2:]:
            result, _, _ = analyzer.analyze(p)
            print(Path(p).name, json.dumps(result))
