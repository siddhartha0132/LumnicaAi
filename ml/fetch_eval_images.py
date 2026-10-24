"""
Download a real-world evaluation set from Wikimedia Commons (openly licensed images).

These images are used ONLY to test the model, never to train it. Each image's licence,
author and source page are recorded in ml/eval/sources.csv.

Category labels are only a starting point: every image is then reviewed by eye and its
label confirmed, changed or dropped in ml/eval/labels.csv (see evaluate_real_world.py).

Usage: python ml/fetch_eval_images.py
"""

import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent / 'eval'
IMAGES = OUT / 'images'
UA = {'User-Agent': 'LumnicaEvalBot/0.1 (skin model evaluation)'}
MAX_PER_GROUP = 40

# Commons category -> provisional label
CATEGORIES = {
    'acne': ['Acne', 'Acne vulgaris', 'People with acne', 'Cystic acne'],
    'redness': ['Rosacea', 'Rosacea cymbiformis'],
    'dark_spots': ['Melasma', 'Hyperpigmentation'],
    'freckles': ['Female people with freckles', 'Male people with freckles'],
    'comedones': ['Blackheads'],
    'wrinkles': ['Wrinkles (skin)'],
    'clear': ['Close-up photographs of human faces', 'Close-up portraits'],
}
ALLOWED_LICENCE = re.compile(r'^(cc0|cc[- ]by(-sa)?[- ]?[\d.]*|public domain|pd)', re.I)


def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json'})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def category_files(category):
    params = {'action': 'query', 'generator': 'categorymembers', 'gcmtitle': f'Category:{category}',
              'gcmtype': 'file', 'gcmlimit': 100, 'prop': 'imageinfo',
              'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 960}  # a standard thumbnail size
    pages = api(params).get('query', {}).get('pages', {})
    for page in pages.values():
        info = (page.get('imageinfo') or [{}])[0]
        meta = info.get('extmetadata', {})
        yield {
            'title': page['title'],
            'mime': info.get('mime', ''),
            'width': info.get('width', 0),
            'url': info.get('thumburl') or info.get('url'),
            'page': info.get('descriptionurl', ''),
            'licence': meta.get('LicenseShortName', {}).get('value', ''),
            'author': re.sub('<[^>]+>', '', meta.get('Artist', {}).get('value', ''))[:120],
        }


def download(url, dest, tries=4):
    """Polite download: Wikimedia rate-limits bursts (HTTP 429), so back off and retry."""
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                dest.write_bytes(r.read())
            return
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == tries - 1:
                raise
            time.sleep(10 * (attempt + 1))


def main():
    IMAGES.mkdir(parents=True, exist_ok=True)
    previous = {}
    if (OUT / 'sources.csv').exists():
        previous = {r['title']: r for r in csv.DictReader(open(OUT / 'sources.csv'))}
    rows, seen = [], set()
    for label, categories in CATEGORIES.items():
        kept = 0
        for category in categories:
            for f in category_files(category):
                if kept >= MAX_PER_GROUP or f['title'] in seen:
                    continue
                if f['mime'] not in ('image/jpeg', 'image/png') or f['width'] < 300:
                    continue
                if not ALLOWED_LICENCE.search(f['licence']):
                    continue
                seen.add(f['title'])
                old = previous.get(f['title'])
                if old and (IMAGES / old['file']).exists():
                    name = old['file']  # already downloaded on an earlier run
                else:
                    name = f'{label}_{hashlib.md5(f["title"].encode()).hexdigest()[:8]}.jpg'
                    try:
                        download(f['url'], IMAGES / name)
                    except Exception as err:
                        print('skip', f['title'], err)
                        continue
                    time.sleep(1.0)
                rows.append({'file': name, 'category_label': label, 'commons_category': category, **f})
                kept += 1
        print(f'{label}: {kept} images')

    with open(OUT / 'sources.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['file', 'category_label', 'commons_category', 'title', 'licence',
                                           'author', 'page', 'url', 'mime', 'width'])
        w.writeheader()
        w.writerows(rows)
    print(f'{len(rows)} images -> {IMAGES}')


if __name__ == '__main__':
    main()
