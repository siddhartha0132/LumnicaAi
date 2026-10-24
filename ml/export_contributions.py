"""
Turn opt-in user contributions into training data.

Reads the same storage the app writes to (.env: CONTRIB_S3_* for R2/B2/S3, or CONTRIB_LOCAL_DIR)
and builds ml/data/lumnica-contributions/:

  raw/<id>.jpg, raw/<id>.json      mirror of what users shared (photo + record)
  <class>/<id>.jpg                 one folder per model class, from the concerns the USER confirmed
  manifest.csv                     id, classes, teacher (server AI) answer, student (our model) top

Labels: the user's confirmed concerns are the label (they saw the photo and corrected the AI).
Concerns the model has no class for (dryness, oiliness, dullness, dark circles) are ignored; a
photo with none of the model's concerns is "clear".

Deletions are honoured: anything a user deleted from storage is removed here too. Run this
before every training run, and do not keep other copies of the photos.

Usage:
  python ml/export_contributions.py            sync + build folders
  python ml/export_contributions.py --upload   also create/update the private Kaggle dataset
                                               hackhackwithus/lumnica-contributions
"""

import csv
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'ml' / 'data' / 'lumnica-contributions'
RAW = OUT / 'raw'
KAGGLE_ID = 'hackhackwithus/lumnica-contributions'

# Text the app shows/stores -> model class.
CONCERN_TO_CLASS = {
    'acne': 'acne',
    'blackheads and whiteheads': 'comedones',
    'dark spots': 'dark_spots',
    'enlarged pores': 'pores',
    'redness and sensitivity': 'redness',
    'fine lines and wrinkles': 'wrinkles',
}
CLASSES = sorted(set(CONCERN_TO_CLASS.values()) | {'clear'})


class Store:
    """Read-only view of contribution storage (S3-compatible bucket or local folder)."""

    def __init__(self, env):
        if all(env.get(k) for k in ('CONTRIB_S3_BUCKET', 'CONTRIB_S3_ENDPOINT', 'CONTRIB_S3_ACCESS_KEY_ID',
                                    'CONTRIB_S3_SECRET_ACCESS_KEY')):
            import boto3
            self.bucket = env['CONTRIB_S3_BUCKET']
            self.s3 = boto3.client('s3', endpoint_url=env['CONTRIB_S3_ENDPOINT'],
                                   aws_access_key_id=env['CONTRIB_S3_ACCESS_KEY_ID'],
                                   aws_secret_access_key=env['CONTRIB_S3_SECRET_ACCESS_KEY'],
                                   region_name=env.get('CONTRIB_S3_REGION') or 'auto')
            self.local = None
        elif env.get('CONTRIB_LOCAL_DIR'):
            self.local = (ROOT / env['CONTRIB_LOCAL_DIR']).resolve()
            self.s3 = None
        else:
            raise SystemExit('No contribution storage configured (set CONTRIB_S3_* or CONTRIB_LOCAL_DIR in .env)')

    def ids(self):
        if self.local:
            base = self.local / 'contributions'
            return sorted(p.name for p in base.iterdir() if (p / 'record.json').exists()) if base.exists() else []
        ids, token = set(), None
        while True:
            kw = {'Bucket': self.bucket, 'Prefix': 'contributions/'}
            if token:
                kw['ContinuationToken'] = token
            res = self.s3.list_objects_v2(**kw)
            for obj in res.get('Contents', []):
                parts = obj['Key'].split('/')
                if len(parts) == 3 and parts[2] == 'record.json':
                    ids.add(parts[1])
            if not res.get('IsTruncated'):
                return sorted(ids)
            token = res['NextContinuationToken']

    def read(self, key):
        if self.local:
            return (self.local / key).read_bytes()
        return self.s3.get_object(Bucket=self.bucket, Key=key)['Body'].read()


def classes_for(record):
    confirmed = record.get('confirmedConcerns') or []
    found = sorted({CONCERN_TO_CLASS[c] for c in confirmed if c in CONCERN_TO_CLASS})
    return found or ['clear']


def main():
    env = {**dotenv_values(ROOT / '.env'), **os.environ}
    store = Store(env)
    RAW.mkdir(parents=True, exist_ok=True)

    remote = set(store.ids())
    local = {p.stem for p in RAW.glob('*.json')}
    for gone in local - remote:  # user deleted it: delete our copy too
        for f in RAW.glob(f'{gone}.*'):
            f.unlink()
    for new in sorted(remote - local):
        (RAW / f'{new}.jpg').write_bytes(store.read(f'contributions/{new}/photo.jpg'))
        (RAW / f'{new}.json').write_bytes(store.read(f'contributions/{new}/record.json'))
    print(f'storage: {len(remote)} contributions | downloaded {len(remote - local)} | removed {len(local - remote)}')

    # Rebuild the class folders from scratch so deleted or relabelled photos never linger.
    for c in CLASSES:
        shutil.rmtree(OUT / c, ignore_errors=True)
        (OUT / c).mkdir(parents=True)
    rows, skipped = [], 0
    for rec_path in sorted(RAW.glob('*.json')):
        record = json.loads(rec_path.read_text())
        if not record.get('userConfirmed'):  # only photos whose concerns a person checked
            skipped += 1
            continue
        cid = record['id']
        labels = classes_for(record)
        for c in labels:
            os.link(RAW / f'{cid}.jpg', OUT / c / f'{cid}.jpg')
        student = record.get('studentScores') or {}
        rows.append({'id': cid, 'classes': '|'.join(labels), 'teacher_engine': record.get('engine'),
                     'teacher_concerns': '|'.join(record.get('modelConcerns') or []),
                     'student_top': max(student, key=student.get) if student else '',
                     'created': record.get('createdAt'), 'consent_version': record.get('consentVersion')})
    with open(OUT / 'manifest.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['id', 'classes', 'teacher_engine', 'teacher_concerns', 'student_top',
                                           'created', 'consent_version'])
        w.writeheader()
        w.writerows(rows)
    counts = {c: len(list((OUT / c).glob('*.jpg'))) for c in CLASSES}
    print(f'training folders: {counts} | skipped (not confirmed): {skipped}')

    if '--upload' in sys.argv:
        meta = {'title': 'Lumnica Contributions', 'id': KAGGLE_ID, 'licenses': [{'name': 'other'}],
                'description': 'Opt-in user photos for training the Lumnica skin model. Private; do not share.'}
        stage = OUT.parent / '_kaggle_contributions'
        shutil.rmtree(stage, ignore_errors=True)
        shutil.copytree(OUT, stage, ignore=shutil.ignore_patterns('raw'))
        (stage / 'dataset-metadata.json').write_text(json.dumps(meta, indent=2))
        kaggle = str(ROOT / 'ml' / '.venv' / 'bin' / 'kaggle')
        exists = subprocess.run([kaggle, 'datasets', 'status', KAGGLE_ID], capture_output=True, text=True).returncode == 0
        cmd = ([kaggle, 'datasets', 'version', '-p', str(stage), '-m', f'{len(rows)} contributions', '--dir-mode', 'zip']
               if exists else [kaggle, 'datasets', 'create', '-p', str(stage), '--dir-mode', 'zip'])
        subprocess.run(cmd, check=True)
        shutil.rmtree(stage)


if __name__ == '__main__':
    main()
