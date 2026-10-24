"""
Build the "clear skin" TRAINING source from openly licensed portraits (v3), found through
Openverse (api.openverse.org; mostly Flickr photos). Wikimedia Commons was the first choice but
rate-limits bulk downloads.

Why: in v2 the "clear" class came from stock/advert photos with airbrushed skin, so the
model learned "clear = retouched" and flagged normal real-skin texture as acne or redness.
Ordinary portraits show real, untouched skin. Only their cheek patches are used as "clear"
(the training script does the cropping), because cheeks rarely carry the concerns we model
apart from acne/redness, which are a small minority in general portraits.

Licences: CC0, public-domain mark and CC BY only (no share-alike / non-commercial / no-derivatives).
Attribution for every image is kept in ml/clear_portraits/sources.csv, which ships with the dataset.

Images are kept only if MediaPipe finds a face that is large enough and at least one cheek
patch passes the skin check, and the photo is in colour. Anything that also appears in the
real-world evaluation set (ml/eval) is dropped so evaluation stays honest.

Usage: python ml/fetch_clear_portraits.py
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

OUT = ML / 'clear_portraits'
IMAGES = OUT / 'images'
UA = {'User-Agent': 'LumnicaDataBot/0.1 (skin model research)'}
MAX_DOWNLOADS = 950  # Openverse's anonymous image-proxy allowance is about 1000
QUERIES = [
    'indian woman portrait', 'indian man portrait', 'indian girl', 'indian boy', 'india portrait', 'india face',
    'india smile', 'kerala portrait', 'tamil portrait', 'punjabi portrait', 'bengali woman', 'mumbai portrait',
    'delhi portrait', 'rajasthan portrait', 'pakistan portrait', 'bangladesh portrait', 'sri lanka portrait',
    'nepal portrait', 'headshot', 'selfie', 'portrait smile', 'face close up', 'student portrait',
    'young woman portrait', 'young man portrait', 'teenager portrait', 'woman face', 'man face',
    'africa portrait', 'brazil portrait', 'indonesia portrait', 'philippines portrait', 'mexico portrait',
    'china portrait', 'japan portrait', 'vietnam portrait',
]
# Round 2 (run with --round2): new queries, weighted to South Asian faces. Openverse allows
# 200 API calls and ~1000 proxied images per day, so each round fits in one day.
QUERIES_ROUND2 = [
    'young indian woman', 'young indian man', 'indian teenager', 'college student india', 'indian student portrait',
    'south asian woman', 'south asian man', 'desi portrait', 'sikh portrait', 'tamil woman', 'malayali portrait',
    'gujarati portrait', 'kashmir portrait', 'goa portrait', 'assam portrait', 'hyderabad portrait',
    'chennai portrait', 'kolkata portrait', 'bangalore portrait', 'pune portrait', 'indian farmer portrait',
    'sri lankan woman', 'nepali girl', 'bangladeshi woman', 'pakistani man', 'professional headshot',
    'portrait photography natural light', 'close up face portrait', 'smiling face', 'woman portrait outdoor',
    'man portrait outdoor', 'teen portrait', 'african woman portrait', 'latina portrait', 'filipino portrait',
    'thai portrait',
]


def licence_ok(name):
    n = name.strip().lower().replace('pdm', 'public domain')
    if {'sa', 'nc', 'nd'} & set(T.re.split(r'[^a-z0-9]+', n)):  # share-alike, non-commercial, no-derivatives
        return False
    return n.startswith(('cc0', 'cc by', 'cc-by', 'public domain', 'pd'))


OPENVERSE = 'https://api.openverse.org/v1/images/'
REQUEST_GAP = 3.5  # seconds between API calls: Openverse allows 20/min and 200/day anonymously


def fetch(url, tries=3):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == tries - 1:
                raise
            time.sleep(60 * (attempt + 1))


def search(query, pages=4):
    for page in range(1, pages + 1):
        params = urllib.parse.urlencode({'q': query, 'license': 'by,cc0,pdm', 'category': 'photograph',
                                         'page_size': 20, 'page': page})
        try:
            res = json.loads(fetch(f'{OPENVERSE}?{params}'))
        except Exception as err:  # one bad page (timeout, 5xx) should not end the whole run
            print(f'  search {query!r} page {page} failed: {err}', flush=True)
            time.sleep(REQUEST_GAP)
            return
        time.sleep(REQUEST_GAP)
        for it in res.get('results', []):
            licence = f"{it.get('license', '')} {it.get('license_version') or ''}".strip()
            yield {
                'title': it.get('title') or it['id'], 'id': it['id'], 'mime': 'image/jpeg',
                'width': it.get('width') or 0, 'page': it.get('foreign_landing_url', ''),
                # Openverse's own image proxy: Flickr refuses scripted downloads (403)
                'url': f"{OPENVERSE}{it['id']}/thumb/?full_size=true", 'original_url': it['url'],
                'licence': 'cc ' + licence if it.get('license') == 'by' else licence,
                'author': (it.get('creator') or '')[:120], 'source': it.get('source', ''),
            }
        if page >= res.get('page_count', 0):
            return


def usable(img):
    """Colour photo with a big-enough face and at least one cheek patch of real skin."""
    hsv = np.asarray(img.convert('HSV').resize((64, 64)), dtype=np.float32)
    if hsv[..., 1].mean() < 25:  # black-and-white or sepia
        return False
    lm = T.detect_landmarks(img)
    if lm is None or np.linalg.norm(lm[234] - lm[454]) < T.MIN_FACE_FRACTION * max(img.size):
        return False
    return bool(T.cut_patches(img, lm, ['right_cheek', 'left_cheek']))


def main():
    from concurrent.futures import ThreadPoolExecutor

    IMAGES.mkdir(parents=True, exist_ok=True)
    T._init_landmarker()
    eval_hashes = {T.dhash(str(p)) for p in (ML / 'eval' / 'images').glob('*.jpg')}
    round2 = '--round2' in sys.argv
    previous = list(csv.DictReader(open(OUT / 'sources.csv'))) if round2 and (OUT / 'sources.csv').exists() else []
    known_hashes = eval_hashes | {T.dhash(str(p)) for d in ('images', 'rejected') for p in (OUT / d).glob('*.jpg')}

    # 1. Collect candidates (API calls are paced inside search()).
    candidates = []
    seen = {r['id'] for r in previous} | {r.get('original_url', '') for r in previous}
    for query in (QUERIES_ROUND2 if round2 else QUERIES):
        n = 0
        for f in search(query):
            if f['id'] in seen or f['original_url'] in seen:
                continue
            seen.update((f['id'], f['original_url']))
            if (f['width'] and f['width'] < 400) or not licence_ok(f['licence']):
                continue
            candidates.append({**f, 'query': query})
            n += 1
        print(f'{query!r}: {n} candidates (total {len(candidates)})', flush=True)
    candidates = candidates[:MAX_DOWNLOADS]
    (OUT / f'candidates{"_round2" if round2 else ""}.json').write_text(json.dumps(candidates))

    # 2. Download a few at a time, 3. keep usable colour faces.
    def get(f):
        try:
            return f, fetch(f['url'])
        except Exception:
            return f, None

    rows, checked = [], 0
    with ThreadPoolExecutor(4) as pool:
        for f, data in pool.map(get, candidates):
            if data is None:
                continue
            checked += 1
            try:
                img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
            except Exception:
                continue
            if not usable(img):
                continue
            name = f'portrait_{hashlib.md5(f["id"].encode()).hexdigest()[:10]}.jpg'
            if (IMAGES / name).exists():
                continue
            img.save(IMAGES / name, quality=92)
            h = T.dhash(str(IMAGES / name))
            if h in known_hashes:  # in the evaluation set, or a copy of a portrait we already have
                (IMAGES / name).unlink()
                continue
            known_hashes.add(h)
            f['review'] = 'pending' if round2 else ''
            rows.append({'file': name, **f})
            if checked % 50 == 0:
                print(f'downloaded {checked}, kept {len(rows)}', flush=True)

    fields = ['file', 'query', 'id', 'title', 'licence', 'author', 'source', 'page', 'original_url', 'url', 'mime',
              'width', 'review']
    with open(OUT / 'sources.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(previous + rows)
    print(f'{len(rows)} portraits kept out of {checked} downloaded -> {IMAGES}')


if __name__ == '__main__':
    main()
