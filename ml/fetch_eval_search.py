"""
Grow the real-world TEST set with openly licensed photos found through Openverse (test only,
never training). Wikimedia Commons was tried first but throttles this machine's downloads.

Why: with 28 usable faces the real-world accuracy has roughly ±15 points of noise, so model
changes could not be told apart. Target: ~150 usable faces.

Each candidate must be a colour photo with a face big enough for the app pipeline, and must not
duplicate (perceptual hash) any training image, training portrait, or existing test image.
Provisional labels come from the search term; every image is then labelled by eye in
ml/eval/labels.csv (multiple concerns allowed, separated by '|').

Usage: python ml/fetch_eval_search.py   (appends to ml/eval/sources.csv as it goes)
"""

import csv
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ML = Path(__file__).parent
os.environ.setdefault('LANDMARKER_PATH', str(ML / 'data' / 'face_landmarker.task'))
sys.path.insert(0, str(ML))
import train_skin_models as T  # noqa: E402

EVAL = ML / 'eval'
IMAGES = EVAL / 'images'
UA = {'User-Agent': 'LumnicaEvalBot/0.1 (skin model evaluation)'}
GAP = 3.5  # seconds between Openverse API calls (20/min, 200/day allowed anonymously)
PER_LABEL = 110  # downloads attempted per provisional label (image proxy allows ~1000/day)
OPENVERSE = 'https://api.openverse.org/v1/images/'
FIELDS = ['file', 'category_label', 'commons_category', 'title', 'licence', 'author', 'page', 'url', 'mime', 'width']

SEARCHES = {
    'acne': ['acne face', 'teenager acne', 'acne vulgaris face', 'pimples face', 'acne cheek'],
    'redness': ['rosacea', 'rosacea face', 'facial redness', 'sunburned face', 'flushed cheeks'],
    'dark_spots': ['melasma', 'freckles face', 'freckled woman', 'age spots face', 'hyperpigmentation face'],
    'wrinkles': ['wrinkled face', 'elderly woman portrait', 'old man portrait', 'grandmother portrait',
                 'elderly man face'],
    'clear': ['young woman portrait', 'young man portrait', 'teenager portrait', 'student portrait',
              'Indian woman portrait', 'Indian man portrait', 'girl portrait', 'boy portrait'],
}


def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == 2:
                raise
            time.sleep(60 * (attempt + 1))


def search(query, pages=3):
    """Openverse results; any CC licence is fine for a test-only image (no NC/ND)."""
    for page in range(1, pages + 1):
        params = urllib.parse.urlencode({'q': query, 'license': 'by,by-sa,cc0,pdm', 'category': 'photograph',
                                         'page_size': 20, 'page': page})
        try:
            res = json.loads(fetch(f'{OPENVERSE}?{params}'))
        except Exception as err:
            print(f'  search {query!r} page {page} failed: {err}', flush=True)
            return
        finally:
            time.sleep(GAP)
        for it in res.get('results', []):
            yield {'title': it.get('title') or it['id'], 'mime': 'image/jpeg', 'width': it.get('width') or 0,
                   'url': f"{OPENVERSE}{it['id']}/thumb/?full_size=true", 'page': it.get('foreign_landing_url', ''),
                   'licence': f"{it.get('license', '')} {it.get('license_version') or ''}".strip(),
                   'author': (it.get('creator') or '')[:120]}
        if page >= res.get('page_count', 0):
            return


def training_hashes():
    cache = ML / 'data' / 'train_dhash.json'
    if cache.exists():
        return set(json.loads(cache.read_text()))
    paths = [p for p in (ML / 'data').rglob('*') if p.suffix.lower() in T.IMAGE_EXT]
    paths += list((ML / 'clear_portraits').rglob('*.jpg'))
    hashes = sorted({T.dhash(str(p)) for p in paths})
    cache.write_text(json.dumps(hashes))
    return set(hashes)


def near_duplicate(h, known_arr):
    if known_arr is None or not len(known_arr):
        return False
    bits = np.array([c == '1' for c in h])
    return bool(((known_arr != bits).sum(1) <= 5).any())


def main():
    T._init_landmarker()
    known = training_hashes() | {T.dhash(str(p)) for p in IMAGES.glob('*.jpg')}
    known_arr = np.array([[c == '1' for c in h] for h in known])
    previous = list(csv.DictReader(open(EVAL / 'sources.csv')))
    seen_titles = {r['title'] for r in previous} | {r['page'] for r in previous}
    rows = []
    out = open(EVAL / 'sources.csv', 'a', newline='')  # append each kept image immediately
    writer = csv.DictWriter(out, fieldnames=FIELDS, extrasaction='ignore')
    for label, queries in SEARCHES.items():
        kept = tried = 0
        for q in queries:
            if tried >= PER_LABEL:
                break
            for f in list(search(q)):
                if tried >= PER_LABEL or f['page'] in seen_titles:
                    continue
                seen_titles.add(f['page'])
                if f['width'] and f['width'] < 500:
                    continue
                tried += 1
                try:
                    data = fetch(f['url'])
                except Exception:
                    continue
                try:
                    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
                except Exception:
                    continue
                hsv = np.asarray(img.convert('HSV').resize((64, 64)), dtype=np.float32)
                if hsv[..., 1].mean() < 25:
                    continue
                lm = T.detect_landmarks(img)
                if lm is None or np.linalg.norm(lm[234] - lm[454]) < T.MIN_FACE_FRACTION * max(img.size):
                    continue
                name = f'ev2_{label}_{hashlib.md5(f["page"].encode()).hexdigest()[:8]}.jpg'
                img.save(IMAGES / name, quality=92)
                h = T.dhash(str(IMAGES / name))
                if near_duplicate(h, known_arr):
                    (IMAGES / name).unlink()
                    continue
                known_arr = np.vstack([known_arr, [c == '1' for c in h]])
                row = {'file': name, 'category_label': label, 'commons_category': f'openverse: {q}', **f}
                writer.writerow(row)
                out.flush()
                rows.append(row)
                kept += 1
        print(f'{label}: kept {kept} of {tried} downloaded', flush=True)

    out.close()
    print(f'{len(rows)} new test images')


if __name__ == '__main__':
    main()
