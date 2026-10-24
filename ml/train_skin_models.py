"""
Lumnica skin-concern model, v3: training script (runs on a Kaggle GPU kernel).

v3 changes after testing v2 on real photos (40% on 25 hand-labelled Wikimedia faces, 6/10 clear
faces flagged): "clear" now comes from real, unretouched portraits instead of airbrushed stock
photos; eye-corner patches moved onto the crow's-feet area (v2 landed on temples/hair); cheek
patches moved above the beard line; skin check raised to 60%; decision threshold capped at a
15% false-alarm rate on clear faces.

Fine-tunes an ImageNet-pretrained EfficientNet-B0 to classify SKIN PATCHES into:
    acne / clear / comedones / dark_spots / pores / redness / wrinkles

Why patches (the v1 lesson): v1 was trained on whole images and scored 88.7% on the
dataset, but on a real selfie of a clear-skinned 20-year-old it said "wrinkles 93%".
Most full-face training photos were in the wrinkles class, so it learned "face = wrinkles",
and it had no way to say "nothing here". v2 therefore:
  * cuts full-face photos into skin patches with MediaPipe face landmarks, keeping only
    the regions where that concern shows (e.g. wrinkles: forehead + eye corners) — the web
    app cuts the same regions out of a selfie, so training and real use see the same thing;
  * adds a "clear" class from forehead/cheek patches of faces labelled "normal skin";
  * randomly blurs/downscales training images, so "low-res face patch vs sharp close-up"
    cannot become a new shortcut;
  * reports face-level accuracy: all regions of a held-out face are classified and combined
    the way the app does it, with the decision threshold tuned on validation faces.

Outputs in /kaggle/working/concerns/:
  model.onnx / model.int8.onnx   input 1x3x224x224 RGB in [0,1], output probabilities
  labels.json                    classes, face-region spec, threshold (read by the web app)
  metrics.json                   patch-level + face-level test reports, per skin tone
  confusion_matrix*.png, manifest.csv (every source image and its split)

Kept from v1: the provenance filter (ACNE04 / stock-photo filenames dropped), grouping of
Roboflow copies so one photo never lands in both train and test, class-weighted loss,
weight-only int8 export (full int8 quantization destroyed accuracy: 88.7% -> 27%).

Local smoke test:  SMOKE=1 DATA_ROOT=ml/data OUT_ROOT=/tmp/out python ml/train_skin_models.py
"""

import csv
import importlib.util
import io
import json
import os
import random
import re
import subprocess
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from multiprocessing import Pool
from pathlib import Path

# Kaggle images ship torch/torchvision/sklearn; install whatever else is missing.
_missing = [pkg for mod, pkg in [('timm', 'timm'), ('onnx', 'onnx'), ('onnxruntime', 'onnxruntime'),
                                 ('onnxscript', 'onnxscript'), ('skimage', 'scikit-image'),
                                 ('mediapipe', 'mediapipe==0.10.35')]  # version tested locally
            if importlib.util.find_spec(mod) is None]
if _missing:
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', *_missing], check=True)

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageFile, ImageOps
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

ImageFile.LOAD_TRUNCATED_IMAGES = True

SMOKE = os.environ.get('SMOKE') == '1'
DATA_ROOT = Path(os.environ.get('DATA_ROOT', '/kaggle/input'))
OUT_ROOT = Path(os.environ.get('OUT_ROOT', '/kaggle/working'))
PATCH_ROOT = Path(os.environ.get('PATCH_ROOT', '/tmp/patches'))  # outside /kaggle/working: not downloaded
LANDMARKER_PATH = Path(os.environ.get('LANDMARKER_PATH', '/tmp/face_landmarker.task'))
LANDMARKER_URL = ('https://storage.googleapis.com/mediapipe-models/face_landmarker/'
                  'face_landmarker/float16/1/face_landmarker.task')

SEED = 42
IMG_SIZE = 224
BATCH_SIZE = 8 if SMOKE else 64
EPOCHS = 1 if SMOKE else 20
LR = 3e-4
WEIGHT_DECAY = 1e-4
LABEL_SMOOTHING = 0.1
BACKBONE = os.environ.get('BACKBONE', 'efficientnet_b0.ra_in1k')  # B0: 4.3 MB int8, ~45 ms/patch in the browser
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
NUM_WORKERS = 0 if SMOKE else 4

EXCLUDE = re.compile(r'levle|istock|getty|shutterstock|depositphotos|adobestock|dailymail|alamy|dreamstime|123rf', re.I)
IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp'}

# Folder name (lower-cased) -> class, per Kaggle dataset (matched by a slug fragment in the path).
SOURCES = [
    ('skin-issues', {  # ahmedismaiil/skin-issues-version-2-dataset-balanced
        'acne': 'acne', 'blackheades': 'comedones', 'dark spots': 'dark_spots',
        'pores': 'pores', 'wrinkles': 'wrinkles'}),
    ('facial-skin-acne', {  # shijo96john/facial-skin-acne-pigmentation-pores-wrinkles
        'inflammatory acne': 'acne', 'non inflammatory acne black heads': 'comedones',
        'non inflammatory acne white heads': 'comedones', 'dark spots': 'dark_spots',
        'pigmentation': 'dark_spots', 'pores': 'pores', 'redness': 'redness', 'wrinkles': 'wrinkles'}),
    # "clear", face patches only, from two sources:
    #  * real, unretouched portraits (CC0 / PDM / CC BY, hand-reviewed; ml/fetch_clear_portraits.py)
    #    — always used and oversampled, because v2 learned "clear = airbrushed" without them;
    #  * the "normal skin" photos of the skin-type datasets (mostly stock/advert shots) — only
    #    to fill the rest of the "clear" quota.
    ('lumnica-clear-portraits', {'images': 'clear'}),
    ('facial-skin-analysis', {'normal': 'clear'}),  # killa92
    ('oily-dry', {'normal': 'clear'}),  # shakyadissanayake
    # Opt-in user selfies, labelled with the concerns the user confirmed
    # (ml/export_contributions.py builds these folders; private Kaggle dataset).
    ('lumnica-contributions', {c: c for c in
                               ('acne', 'clear', 'comedones', 'dark_spots', 'pores', 'redness', 'wrinkles')}),
]
# Real, unretouched photos: always used in full and oversampled (see the "clear" quota below).
REAL_SOURCES = {'lumnica-clear-portraits', 'lumnica-contributions'}
REAL_PORTRAIT_OVERSAMPLE = 3

# Face regions, defined on MediaPipe's 478-point face mesh. Sizes are fractions of face width
# (distance between landmarks 234 and 454). "push" moves the centre away from the point between
# the eyes (landmark 168) — used to land on the outer eye corners (crow's feet).
# This exact spec is written to labels.json, and the web app crops selfies with it.
REGIONS = {
    'forehead':      {'center': [151], 'size': 0.30},
    'right_cheek':   {'center': [50], 'size': 0.22},    # subject's right = image left; upper cheek, above beard line
    'left_cheek':    {'center': [280], 'size': 0.22},
    'nose':          {'center': [4], 'size': 0.18},
    'chin':          {'center': [199], 'size': 0.20},
    'right_eye_out': {'center': [33], 'push': 0.25, 'size': 0.13},
    'left_eye_out':  {'center': [263], 'push': 0.25, 'size': 0.13},
}
# Where each concern actually shows on a face. Training patches from full faces are cut only
# from these regions, so a patch labelled "wrinkles" really is a forehead or eye corner.
REGIONS_FOR = {
    'acne': ['forehead', 'right_cheek', 'left_cheek', 'chin'],
    'comedones': ['nose', 'chin', 'forehead'],
    'dark_spots': ['forehead', 'right_cheek', 'left_cheek'],
    'pores': ['nose', 'right_cheek', 'left_cheek'],
    'redness': ['right_cheek', 'left_cheek', 'nose'],
    'wrinkles': ['forehead', 'right_eye_out', 'left_eye_out'],
    'clear': ['forehead', 'right_cheek', 'left_cheek'],
}
MIN_FACE_FRACTION = 0.15  # face must be at least this wide (vs. the image's longer side) to cut regions
MIN_PATCH_PX = 40         # regions smaller than this carry too little detail
MIN_SKIN_FRACTION = 0.6   # skip patches that are mostly beard, hair, glasses or background (v2 used 0.35: beard got through)
MAX_CLEAR_TRAIN_RATIO = 1.0  # cap "clear" train patches at the median concern-class count x this
MAX_CLEAR_FALSE_ALARM = 0.15  # threshold choice: flag at most this share of clear validation faces

# Individual Typology Angle buckets (Chardon et al.), used for a rough skin-tone fairness check.
ITA_BUCKETS = [(55, 'very_light'), (41, 'light'), (28, 'intermediate'), (10, 'tan'), (-30, 'brown'), (-999, 'dark')]


def seed_everything(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def log(msg):
    print(f'[{time.strftime("%H:%M:%S")}] {msg}', flush=True)


# ---------------------------------------------------------------- source images

def collect():
    items, excluded = [], Counter()
    for path in DATA_ROOT.rglob('*'):
        if path.suffix.lower() not in IMAGE_EXT:
            continue
        rel = str(path.relative_to(DATA_ROOT)).lower()
        for hint, folders in SOURCES:
            if hint in rel:
                label = folders.get(path.parent.name.lower())
                break
        else:
            continue
        if label is None:
            continue
        if EXCLUDE.search(path.name):
            excluded[label] += 1
            continue
        items.append({'path': str(path), 'label': label, 'source': hint})
    log(f'{len(items)} source images {dict(Counter(i["label"] for i in items))}; '
        f'excluded by provenance filter: {dict(excluded)}')
    return items, excluded


def original_name(filename):
    """'07Acne081101-Copy_jpg.rf.<hash>.jpg' -> '07acne081101'. Roboflow copies share this."""
    stem = re.split(r'[._](jpe?g|png|webp)?\.?rf\.', filename, flags=re.I)[0]
    # Windows-style duplicates: 'x1-Copy' / 'x - Copy' / 'x (2)'. Over-grouping is harmless;
    # it can only move more copies onto the same side of the split.
    stem = re.sub(r'1?(-copy|_copy|\s*-\s*copy|\s*\(\d+\))+$', '', stem, flags=re.I)
    stem = re.sub(r'^(rotated_|flipped_)', '', stem, flags=re.I)
    return stem.lower()


def dhash(path, size=8):
    """Perceptual difference hash: identical-looking images get identical hashes."""
    with Image.open(path) as im:
        g = im.convert('L').resize((size + 1, size), Image.BILINEAR)
    px = np.asarray(g, dtype=np.int16)
    return ''.join('1' if b else '0' for b in (px[:, 1:] > px[:, :-1]).flatten())


def assign_groups(items):
    """Union-find over 'same label + original filename' and 'same perceptual hash'.

    Filenames alone are not enough: generic names like '26_PNG' appear in several classes
    for unrelated photos. Copies of one photo always share a label, so the name key is
    scoped by label; identical-looking images across labels are still caught by the hash.
    """
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    first_by_key = {}
    for i, it in enumerate(items):
        try:
            h = dhash(it['path'])
        except Exception:
            h = f'unreadable-{i}'
        for key in (('name', it['label'], original_name(Path(it['path']).name)), ('hash', h)):
            if key in first_by_key:
                a, b = find(first_by_key[key]), find(i)
                if a != b:
                    parent[b] = a
            else:
                first_by_key[key] = i
    for i, it in enumerate(items):
        it['group'] = find(i)
    return items


def group_split(items, val_frac=0.15, test_frac=0.15):
    """Split by group, stratified by each group's majority label."""
    groups = defaultdict(list)
    for it in items:
        groups[it['group']].append(it)
    by_label = defaultdict(list)
    for gid, members in groups.items():
        by_label[Counter(m['label'] for m in members).most_common(1)[0][0]].append(gid)

    rng = random.Random(SEED)
    split_of = {}
    for label, gids in sorted(by_label.items()):
        rng.shuffle(gids)
        n_test = max(1, round(len(gids) * test_frac))
        n_val = max(1, round(len(gids) * val_frac))
        for k, gid in enumerate(gids):
            split_of[gid] = 'test' if k < n_test else 'val' if k < n_test + n_val else 'train'

    # A group whose images carry different labels is ambiguous; keep it out of val/test.
    for gid, members in groups.items():
        if len({m['label'] for m in members}) > 1:
            split_of[gid] = 'train'
    for it in items:
        it['split'] = split_of[it['group']]
    return items


# ---------------------------------------------------------------- image loading & prediction helpers

def load_rgb(path):
    """Open an image as sRGB, applying EXIF rotation and any embedded colour profile.

    Browsers colour-manage photos to sRGB before the web app sees the pixels; PIL ignores ICC
    profiles unless asked. Without this, the same photo gave different predictions in Python
    and in the browser.
    """
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        icc = im.info.get('icc_profile')
        im = im.convert('RGB')
        if icc:
            try:
                from PIL import ImageCms
                im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(icc)),
                                               ImageCms.createProfile('sRGB'), outputMode='RGB')
            except Exception:
                pass
        return im


def tta_views(patch):
    """Six views of a patch: the four corners and centre of the 255px resize, plus the mirrored
    centre. Averaging over them steadies predictions (a 3px crop shift could flip the top class).
    public/skin-model.js builds exactly the same six views."""
    big = patch.resize((int(IMG_SIZE * 1.14),) * 2, Image.BILINEAR)
    tl, tr, bl, br, center = transforms.FiveCrop(IMG_SIZE)(big)
    views = [tl, tr, bl, br, center, ImageOps.mirror(center)]
    return np.stack([np.asarray(v, dtype=np.float32).transpose(2, 0, 1) / 255.0 for v in views])


def predict_patches(session, patches):
    """ONNX probabilities per patch, averaged over tta_views. patches: dict name -> PIL image."""
    names = list(patches)
    x = np.concatenate([tta_views(patches[n]) for n in names]).astype(np.float32)
    probs = session.run(None, {'image': x})[0].reshape(len(names), 6, -1).mean(axis=1)
    return dict(zip(names, probs))


# ---------------------------------------------------------------- face regions -> patches

_landmarker = None


def _init_landmarker():
    global _landmarker
    from mediapipe.tasks.python import BaseOptions, vision
    _landmarker = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(LANDMARKER_PATH), delegate=BaseOptions.Delegate.CPU),
        running_mode=vision.RunningMode.IMAGE, num_faces=1,
        min_face_detection_confidence=0.5, min_face_presence_confidence=0.5))


def detect_landmarks(img):
    """478 landmarks in pixel coordinates of `img`, or None."""
    import mediapipe as mp
    small = img.copy()
    small.thumbnail((1024, 1024))
    result = _landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(small)))
    if not result.face_landmarks:
        return None
    w, h = img.size
    return np.array([[p.x * w, p.y * h] for p in result.face_landmarks[0]], dtype=np.float32)


def region_boxes(lm):
    """Square crop boxes (x0, y0, x1, y1) for every region in REGIONS."""
    face_w = float(np.linalg.norm(lm[234] - lm[454]))
    boxes = {}
    for name, spec in REGIONS.items():
        c = lm[spec['center']].mean(axis=0)
        if 'push' in spec:
            c = c + (c - lm[168]) * spec['push']
        half = spec['size'] * face_w / 2
        boxes[name] = (c[0] - half, c[1] - half, c[0] + half, c[1] + half)
    return boxes, face_w


def skin_fraction(patch):
    ycc = np.asarray(patch.convert('YCbCr').resize((64, 64)), dtype=np.float32)
    cb, cr = ycc[..., 1], ycc[..., 2]
    return float(((cr > 133) & (cr < 173) & (cb > 77) & (cb < 127)).mean())


def cut_patches(img, lm, region_names):
    """Crop the named regions; drop ones that are off-image, too small or not mostly skin."""
    boxes, _ = region_boxes(lm)
    w, h = img.size
    out = {}
    for name in region_names:
        x0, y0, x1, y1 = boxes[name]
        side = x1 - x0
        inside = (min(x1, w) - max(x0, 0)) * (min(y1, h) - max(y0, 0)) / max(side * side, 1)
        if side < MIN_PATCH_PX or inside < 0.8:
            continue
        patch = img.crop(tuple(int(round(v)) for v in (x0, y0, x1, y1)))
        if skin_fraction(patch) >= MIN_SKIN_FRACTION:
            out[name] = patch
    return out


def extract_one(job):
    """Worker: one source image -> list of patch records (written to PATCH_ROOT)."""
    idx, it = job
    try:
        img = load_rgb(it['path'])
    except Exception:
        return []
    lm = detect_landmarks(img)
    records = []
    face_ok = lm is not None and np.linalg.norm(lm[234] - lm[454]) >= MIN_FACE_FRACTION * max(img.size)

    if face_ok:
        # Train: only the regions where this concern shows. Val/test: every region too, for the
        # face-level evaluation that mimics the app.
        wanted = set(REGIONS_FOR[it['label']])
        all_regions = it['split'] != 'train'
        patches = cut_patches(img, lm, list(REGIONS) if all_regions else sorted(wanted))
        for name, patch in patches.items():
            out = PATCH_ROOT / it['split'] / f'{idx}_{name}.jpg'
            patch.save(out, quality=95)
            records.append({**it, 'patch': str(out), 'region': name, 'kind': 'face_region',
                            'train_patch': name in wanted})
    elif it['label'] != 'clear':
        # No usable face: the image is already a close-up of skin.
        out = PATCH_ROOT / it['split'] / f'{idx}_closeup.jpg'
        img.save(out, quality=95)
        records.append({**it, 'patch': str(out), 'region': 'closeup', 'kind': 'closeup', 'train_patch': True})
    return records


def build_patches(items):
    if not LANDMARKER_PATH.exists():
        urllib.request.urlretrieve(LANDMARKER_URL, LANDMARKER_PATH)
    for split in ('train', 'val', 'test'):
        (PATCH_ROOT / split).mkdir(parents=True, exist_ok=True)
    jobs = list(enumerate(items))
    if SMOKE:
        _init_landmarker()
        results = [extract_one(j) for j in jobs]
    else:
        with Pool(os.cpu_count() or 4, initializer=_init_landmarker) as pool:
            results = pool.map(extract_one, jobs, chunksize=32)
    patches = [r for rs in results for r in rs]
    faces = sum(1 for rs in results if rs and rs[0]['kind'] == 'face_region')
    log(f'{len(patches)} patches from {len(items)} images ({faces} full faces cut into regions)')
    return patches


# ---------------------------------------------------------------- datasets & model

RESAMPLERS = [Image.NEAREST, Image.BILINEAR, Image.BICUBIC, Image.LANCZOS, Image.BOX]


class Downscale:
    """Randomly shrink then re-enlarge with random filters: removes 'blurry face patch vs sharp
    close-up' as a cue, and makes the model indifferent to how the browser/library resamples."""

    def __init__(self, low=40, high=160):
        self.low, self.high = low, high

    def __call__(self, img):
        side = random.randint(self.low, self.high)
        if min(img.size) <= side:
            return img
        return img.resize((side, side), random.choice(RESAMPLERS)).resize(img.size, random.choice(RESAMPLERS))


class JpegRecompress:
    """Re-encode at a random JPEG quality, as phone cameras and uploads do."""

    def __init__(self, low=35, high=95):
        self.low, self.high = low, high

    def __call__(self, img):
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=random.randint(self.low, self.high))
        buf.seek(0)
        return Image.open(buf).convert('RGB')


def transforms_for(train):
    if train:
        return transforms.Compose([
            transforms.RandomResizedCrop(IMG_SIZE, scale=(0.35, 1.0), ratio=(0.8, 1.25)),
            transforms.RandomApply([Downscale()], p=0.5),
            transforms.RandomApply([JpegRecompress()], p=0.4),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            # Mild colour jitter only: hue/saturation carry real signal for redness and pigmentation.
            transforms.ColorJitter(brightness=0.25, contrast=0.2, saturation=0.1, hue=0.02),
            transforms.ToTensor(),
        ])
    return transforms.Compose([
        transforms.Resize(int(IMG_SIZE * 1.14)),
        transforms.CenterCrop(IMG_SIZE),
        transforms.ToTensor(),
    ])


class PatchList(Dataset):
    def __init__(self, records, classes, tf):
        self.records, self.tf = records, tf
        self.index = {c: i for i, c in enumerate(classes)}

    def __len__(self):
        return len(self.records)

    def __getitem__(self, i):
        r = self.records[i]
        with Image.open(r['patch']) as im:
            img = im.convert('RGB')
        return self.tf(img), self.index[r['label']]


class WithNormalisation(nn.Module):
    """Model that takes RGB in [0,1] and returns probabilities: simplest possible browser contract."""

    def __init__(self, net):
        super().__init__()
        self.net = net
        self.register_buffer('mean', torch.tensor(MEAN).view(1, 3, 1, 1))
        self.register_buffer('std', torch.tensor(STD).view(1, 3, 1, 1))

    def forward(self, x):
        return torch.softmax(self.net((x - self.mean) / self.std), dim=1)


def build_model(num_classes):
    import timm
    return timm.create_model(BACKBONE, pretrained=True, num_classes=num_classes)


# ---------------------------------------------------------------- training & evaluation

def run_epoch(model, loader, criterion, optimizer=None, scaler=None, scheduler=None):
    train = optimizer is not None
    model.train(train)
    mean = torch.tensor(MEAN, device=DEVICE).view(1, 3, 1, 1)
    std = torch.tensor(STD, device=DEVICE).view(1, 3, 1, 1)
    total, loss_sum, probs, trues = 0, 0.0, [], []
    for x, y in loader:
        x, y = x.to(DEVICE, non_blocking=True), y.to(DEVICE, non_blocking=True)
        with torch.set_grad_enabled(train), torch.autocast(device_type='cuda', enabled=DEVICE == 'cuda'):
            logits = model((x - mean) / std)
            loss = criterion(logits, y)
        if train:
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
        total += y.size(0)
        loss_sum += loss.item() * y.size(0)
        probs.append(torch.softmax(logits.float(), 1).detach().cpu())
        trues.append(y.cpu())
    probs = torch.cat(probs).numpy()
    y_true = torch.cat(trues).numpy()
    return loss_sum / total, probs, y_true


def macro_f1(y_true, y_pred, labels):
    from sklearn.metrics import f1_score
    return float(f1_score(y_true, y_pred, labels=labels, average='macro', zero_division=0))


def ita_bucket(path):
    """Rough skin-tone bucket from the image's skin-coloured pixels (CIELAB ITA angle)."""
    from skimage.color import rgb2lab
    with Image.open(path) as im:
        img = im.convert('RGB').resize((128, 128))
    rgb = np.asarray(img, dtype=np.float32) / 255.0
    ycc = np.asarray(img.convert('YCbCr'), dtype=np.float32)
    mask = (ycc[..., 2] > 133) & (ycc[..., 2] < 173) & (ycc[..., 1] > 77) & (ycc[..., 1] < 127)
    if mask.sum() < 200:
        return 'unknown'
    lab = rgb2lab(rgb[mask].reshape(-1, 1, 3)).reshape(-1, 3)
    ita = np.degrees(np.arctan2(np.median(lab[:, 0]) - 50, np.median(lab[:, 2])))
    return next(name for threshold, name in ITA_BUCKETS if ita > threshold)


def report(y_true, y_pred, classes, tone_paths=None):
    from sklearn.metrics import classification_report, confusion_matrix
    labels = list(range(len(classes)))
    rep = classification_report(y_true, y_pred, labels=labels, target_names=classes,
                                output_dict=True, zero_division=0)
    out = {
        'n': int(len(y_true)),
        'accuracy': round(float((y_true == y_pred).mean()), 4) if len(y_true) else None,
        'macro_f1': round(macro_f1(y_true, y_pred, labels), 4),
        'per_class': {c: {k: round(v, 4) for k, v in rep[c].items()} for c in classes},
        'confusion_matrix': confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }
    if tone_paths is not None:
        by_tone = defaultdict(lambda: [0, 0])
        for path, t, p in zip(tone_paths, y_true, y_pred):
            b = ita_bucket(path)
            by_tone[b][0] += 1
            by_tone[b][1] += int(t == p)
        out['accuracy_by_skin_tone'] = {k: {'n': v[0], 'accuracy': round(v[1] / v[0], 4)}
                                        for k, v in sorted(by_tone.items())}
    return out


def face_level(records, probs, classes, threshold):
    """Combine every region of a face the way the app does: each concern's score is its highest
    probability over the regions; if no concern reaches `threshold` the face is 'clear'."""
    clear = classes.index('clear')
    concern_idx = [i for i in range(len(classes)) if i != clear]
    by_face = defaultdict(list)
    for r, p in zip(records, probs):
        by_face[r['path']].append(p)
    y_true, y_pred, paths = [], [], []
    index = {c: i for i, c in enumerate(classes)}
    label_of = {r['path']: r['label'] for r in records}
    for path, ps in by_face.items():
        best = np.max(np.stack(ps), axis=0)
        top = max(concern_idx, key=lambda i: best[i])
        y_pred.append(top if best[top] >= threshold else clear)
        y_true.append(index[label_of[path]])
        paths.append(path)
    return np.array(y_true), np.array(y_pred), paths


def save_confusion_png(cm, classes, path, title):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    cm = np.asarray(cm)
    norm = cm / np.maximum(cm.sum(1, keepdims=True), 1)
    fig, ax = plt.subplots(figsize=(1.2 * len(classes) + 2, 1.2 * len(classes) + 1.5))
    ax.imshow(norm, cmap='Blues', vmin=0, vmax=1)
    ax.set_xticks(range(len(classes)), classes, rotation=45, ha='right')
    ax.set_yticks(range(len(classes)), classes)
    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(j, i, f'{cm[i, j]}\n{norm[i, j]:.0%}', ha='center', va='center',
                    color='white' if norm[i, j] > 0.5 else 'black', fontsize=8)
    ax.set_xlabel('Predicted')
    ax.set_ylabel('True')
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


# ---------------------------------------------------------------- export

def quantize_weights_int8(src, dst, min_elements=1024):
    """Weight-only int8: Conv/Gemm weights become per-output-channel int8 + DequantizeLinear.

    Activations stay float32. Full static quantization (weights + activations) wrecked this
    EfficientNet: test accuracy fell from 88.7% to 27-71% depending on calibration, because its
    SiLU and squeeze-excite activations have wide, spiky ranges. Weights alone quantize cleanly
    and give the same ~3x size reduction, which is what matters for a browser download.
    """
    import onnx
    from onnx import helper, numpy_helper

    model = onnx.load(str(src))
    graph = model.graph
    inits = {i.name: i for i in graph.initializer}
    uses = Counter(name for node in graph.node for name in node.input)

    dq_nodes, replaced = [], set()
    for node in graph.node:
        if node.op_type not in ('Conv', 'Gemm') or len(node.input) < 2:
            continue
        name = node.input[1]
        if name not in inits or uses[name] != 1:
            continue
        w = numpy_helper.to_array(inits[name]).astype(np.float32)
        if w.size < min_elements:
            continue
        axis = 0
        if node.op_type == 'Gemm':
            trans_b = next((a.i for a in node.attribute if a.name == 'transB'), 0)
            axis = 0 if trans_b else 1
        reduce_axes = tuple(i for i in range(w.ndim) if i != axis)
        scale = np.abs(w).max(axis=reduce_axes) / 127.0
        scale[scale == 0] = 1.0
        shape = [1] * w.ndim
        shape[axis] = -1
        q = np.clip(np.round(w / scale.reshape(shape)), -127, 127).astype(np.int8)

        graph.initializer.extend([
            numpy_helper.from_array(q, f'{name}_q'),
            numpy_helper.from_array(scale.astype(np.float32), f'{name}_scale'),
            numpy_helper.from_array(np.zeros_like(scale, dtype=np.int8), f'{name}_zero'),
        ])
        dq_nodes.append(helper.make_node('DequantizeLinear', [f'{name}_q', f'{name}_scale', f'{name}_zero'],
                                         [f'{name}_dq'], axis=axis, name=f'{name}_dequantize'))
        node.input[1] = f'{name}_dq'
        replaced.add(name)

    kept = [i for i in graph.initializer if i.name not in replaced]
    del graph.initializer[:]
    graph.initializer.extend(kept)
    nodes = dq_nodes + list(graph.node)  # DQ nodes only read initializers, so they can go first
    del graph.node[:]
    graph.node.extend(nodes)
    onnx.checker.check_model(model)
    onnx.save(model, str(dst))


def export_onnx(model, out_dir, test_records, classes):
    import onnxruntime as ort

    wrapped = WithNormalisation(model.eval().cpu()).eval()
    fp32_path = out_dir / 'model.onnx'
    torch.onnx.export(
        wrapped, torch.rand(1, 3, IMG_SIZE, IMG_SIZE), str(fp32_path),
        input_names=['image'], output_names=['probabilities'],
        dynamic_axes={'image': {0: 'batch'}, 'probabilities': {0: 'batch'}},
        opset_version=17, dynamo=False,
    )
    int8_path = out_dir / 'model.int8.onnx'
    quantize_weights_int8(fp32_path, int8_path)

    tf = transforms_for(train=False)
    index = {c: i for i, c in enumerate(classes)}
    x = np.stack([tf(Image.open(r['patch']).convert('RGB')).numpy() for r in test_records]).astype(np.float32)
    y = np.array([index[r['label']] for r in test_records])

    def accuracy(path):
        sess = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
        pred = np.concatenate([sess.run(None, {'image': x[i:i + 64]})[0].argmax(1) for i in range(0, len(x), 64)])
        return round(float((pred == y).mean()), 4)

    result = {name: {'path': p.name, 'mb': round(p.stat().st_size / 1e6, 2), 'test_accuracy': accuracy(p)}
              for name, p in (('fp32', fp32_path), ('int8', int8_path))}
    result['shipped'] = 'int8' if result['int8']['test_accuracy'] >= result['fp32']['test_accuracy'] - 0.01 else 'fp32'
    log(f'Export: {result}')
    return result


# ---------------------------------------------------------------- main

def main():
    seed_everything(SEED)
    out_dir = OUT_ROOT / 'concerns'
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f'device={DEVICE} torch={torch.__version__} data_root={DATA_ROOT} smoke={SMOKE}')

    items, excluded = collect()
    if SMOKE:
        rng = random.Random(SEED)
        by = defaultdict(list)
        for it in items:
            by[it['label']].append(it)
        items = [it for lst in by.values() for it in rng.sample(lst, min(len(lst), 30))]
    items = group_split(assign_groups(items))

    with open(out_dir / 'manifest.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['split', 'label', 'source', 'group', 'path'])
        w.writeheader()
        for it in items:
            w.writerow({k: it[k] for k in w.fieldnames})

    patches = build_patches(items)
    classes = sorted({p['label'] for p in patches})
    index = {c: i for i, c in enumerate(classes)}

    train = [p for p in patches if p['split'] == 'train' and p['train_patch']]
    # Patch-level val/test: the same "right region for the label" patches as training.
    val = [p for p in patches if p['split'] == 'val' and p['train_patch']]
    test = [p for p in patches if p['split'] == 'test' and p['train_patch']]
    # Face-level val/test: all regions of held-out full faces.
    val_faces = [p for p in patches if p['split'] == 'val' and p['kind'] == 'face_region']
    test_faces = [p for p in patches if p['split'] == 'test' and p['kind'] == 'face_region']

    # "clear" quota = median concern-class size. Real portraits first (oversampled), then stock
    # "normal skin" patches fill whatever is left.
    concern_counts = Counter(p['label'] for p in train if p['label'] != 'clear')
    cap = int(np.median(list(concern_counts.values())) * MAX_CLEAR_TRAIN_RATIO) if concern_counts else 0
    real = [p for p in train if p['label'] == 'clear' and p['source'] in REAL_SOURCES]
    stock = [p for p in train if p['label'] == 'clear' and p['source'] not in REAL_SOURCES]
    real = real * REAL_PORTRAIT_OVERSAMPLE
    stock = random.Random(SEED).sample(stock, max(0, min(len(stock), cap - len(real))))
    real_concerns = [p for p in train if p['label'] != 'clear' and p['source'] == 'lumnica-contributions']
    train = [p for p in train if p['label'] != 'clear'] + real_concerns * (REAL_PORTRAIT_OVERSAMPLE - 1) + real + stock
    log(f'clear train patches: {len(real)} real-portrait (x{REAL_PORTRAIT_OVERSAMPLE}) + {len(stock)} stock')

    for name, rows in (('train', train), ('val', val), ('test', test)):
        log(f'{name}: {len(rows)} patches {dict(Counter(r["label"] for r in rows))} '
            f'kinds {dict(Counter(r["kind"] for r in rows))}')
    log(f'face-level: val {len({p["path"] for p in val_faces})} faces, test {len({p["path"] for p in test_faces})} faces '
        f'{dict(Counter(p["label"] for p in {q["path"]: q for q in test_faces}.values()))}')
    if not val or not test:
        raise RuntimeError('empty val/test split; check dataset paths')

    def loader(rows, is_train):
        return DataLoader(PatchList(rows, classes, transforms_for(is_train)), batch_size=BATCH_SIZE,
                          shuffle=is_train, num_workers=NUM_WORKERS, pin_memory=DEVICE == 'cuda',
                          drop_last=is_train and len(rows) > BATCH_SIZE)

    train_loader = loader(train, True)
    counts = Counter(p['label'] for p in train)
    weights = torch.tensor([len(train) / (len(classes) * max(counts[c], 1)) for c in classes],
                           dtype=torch.float32, device=DEVICE)
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=LABEL_SMOOTHING)
    eval_criterion = nn.CrossEntropyLoss()

    model = build_model(len(classes)).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=LR, epochs=EPOCHS,
                                                    steps_per_epoch=max(len(train_loader), 1), pct_start=0.15)
    scaler = torch.amp.GradScaler(enabled=DEVICE == 'cuda')

    best_f1, best_state, history = -1.0, None, []
    labels_idx = list(range(len(classes)))
    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        tr_loss, _, _ = run_epoch(model, train_loader, criterion, optimizer, scaler, scheduler)
        va_loss, va_probs, va_true = run_epoch(model, loader(val, False), eval_criterion)
        va_f1 = macro_f1(va_true, va_probs.argmax(1), labels_idx)
        va_acc = float((va_probs.argmax(1) == va_true).mean())
        history.append({'epoch': epoch, 'train_loss': round(tr_loss, 4), 'val_loss': round(va_loss, 4),
                        'val_acc': round(va_acc, 4), 'val_macro_f1': round(va_f1, 4)})
        log(f'epoch {epoch}/{EPOCHS} train_loss={tr_loss:.3f} | val_loss={va_loss:.3f} '
            f'acc={va_acc:.3f} f1={va_f1:.3f} ({time.time() - t0:.0f}s)')
        if va_f1 > best_f1:
            best_f1 = va_f1
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    torch.save(best_state, out_dir / 'model.pt')

    # Patch level.
    _, te_probs, te_true = run_epoch(model, loader(test, False), eval_criterion)
    patch_report = report(te_true, te_probs.argmax(1), classes, tone_paths=[r['patch'] for r in test])
    for kind in ('closeup', 'face_region'):
        mask = np.array([r['kind'] == kind for r in test])
        if mask.any():
            patch_report[f'accuracy_{kind}'] = round(float((te_probs.argmax(1)[mask] == te_true[mask]).mean()), 4)
    save_confusion_png(patch_report['confusion_matrix'], classes, out_dir / 'confusion_matrix_patches.png',
                       f'Patches, test (acc {patch_report["accuracy"]:.1%}, macro F1 {patch_report["macro_f1"]:.2f})')
    log(f'PATCH TEST acc={patch_report["accuracy"]} f1={patch_report["macro_f1"]} '
        f'closeup={patch_report.get("accuracy_closeup")} face_region={patch_report.get("accuracy_face_region")}')

    # Face level: tune the "is anything there?" threshold on validation faces, then test.
    face_report, threshold = None, 0.5
    if val_faces and test_faces:
        _, vf_probs, _ = run_epoch(model, loader(val_faces, False), eval_criterion)
        # Telling someone with clear skin they have acne is worse than missing mild acne, so the
        # threshold must keep false alarms on clear faces under MAX_CLEAR_FALSE_ALARM; among those
        # thresholds, take the one with the best macro F1.
        scores, alarms = {}, {}
        clear_i = index['clear']
        for t in np.round(np.arange(0.3, 0.98, 0.025), 3):
            yt, yp, _ = face_level(val_faces, vf_probs, classes, t)
            scores[float(t)] = macro_f1(yt, yp, sorted(set(yt)))
            alarms[float(t)] = float((yp[yt == clear_i] != clear_i).mean()) if (yt == clear_i).any() else 0.0
        allowed = [t for t in scores if alarms[t] <= MAX_CLEAR_FALSE_ALARM]
        threshold = max(allowed, key=scores.get) if allowed else min(alarms, key=alarms.get)
        _, tf_probs, _ = run_epoch(model, loader(test_faces, False), eval_criterion)
        yt, yp, paths = face_level(test_faces, tf_probs, classes, threshold)
        present = sorted(set(yt) | set(yp))
        face_report = report(yt, yp, classes, tone_paths=paths)
        face_report['macro_f1_present_classes'] = round(macro_f1(yt, yp, sorted(set(yt))), 4)
        face_report['threshold'] = threshold
        face_report['val_threshold_scan'] = {t: {'macro_f1': round(scores[t], 4), 'clear_false_alarm': round(alarms[t], 4)}
                                             for t in scores}
        clear = index['clear']
        cleared = yt == clear
        face_report['clear_faces_false_alarm_rate'] = round(float((yp[cleared] != clear).mean()), 4) if cleared.any() else None
        save_confusion_png(face_report['confusion_matrix'], classes, out_dir / 'confusion_matrix_faces.png',
                           f'Whole faces, test (acc {face_report["accuracy"]:.1%}, threshold {threshold})')
        log(f'FACE TEST acc={face_report["accuracy"]} f1(present)={face_report["macro_f1_present_classes"]} '
            f'threshold={threshold} clear false-alarm={face_report["clear_faces_false_alarm_rate"]}')

    export = export_onnx(model, out_dir, test, classes)

    metrics = {
        'version': 3,
        'backbone': BACKBONE,
        'img_size': IMG_SIZE,
        'epochs': EPOCHS,
        'classes': classes,
        'excluded_by_provenance_filter': dict(excluded),
        'counts': {name: dict(Counter(r['label'] for r in rows)) for name, rows in
                   (('train', train), ('val', val), ('test', test))},
        'best_val_macro_f1': round(best_f1, 4),
        'test_patches': patch_report,
        'test_faces': face_report,
        'export': export,
        'history': history,
    }
    (out_dir / 'metrics.json').write_text(json.dumps(metrics, indent=2))
    (out_dir / 'labels.json').write_text(json.dumps({
        'version': 3,
        'classes': classes,
        'input': {'name': 'image', 'shape': [1, 3, IMG_SIZE, IMG_SIZE], 'range': '0-1 RGB, normalisation inside model',
                  'preprocess': 'resize shorter side to 255, centre-crop 224'},
        'output': {'name': 'probabilities'},
        'model_file': export[export['shipped']]['path'],
        'regions': REGIONS,
        'face_width_landmarks': [234, 454],
        'push_from_landmark': 168,
        'min_patch_px': MIN_PATCH_PX,
        'min_skin_fraction': MIN_SKIN_FRACTION,
        'min_face_fraction': MIN_FACE_FRACTION,
        'face_threshold': threshold,
        'aggregation': 'per concern, max probability over regions; below face_threshold => clear',
        'test_patch_accuracy': patch_report['accuracy'],
        'test_face_accuracy': face_report['accuracy'] if face_report else None,
    }, indent=2))
    log(f'done -> {out_dir}')


if __name__ == '__main__':
    main()
