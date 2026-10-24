# Lumnica on-device skin-concern model

A small image model that runs **in the user's browser** (ONNX Runtime Web) and detects visible
skin concerns on a face photo: `acne`, `comedones` (blackheads/whiteheads), `dark_spots`,
`pores`, `redness`, `wrinkles`, or `clear`. The photo never leaves the device.

Status: **beta**. It is behind a switch (`/?engine=local`); the live app still uses the server
analysis by default. See "Results" for why.

## How it works

```
selfie ──► MediaPipe Face Landmarker (478 points)
       ──► 7 skin regions cut out: forehead, both cheeks, nose, chin, both outer eye corners
       ──► skip regions that are off-image, tiny, or < 60% skin pixels (beard, hair, glasses)
       ──► EfficientNet-B0 classifies each region (6 views per region, averaged)
       ──► per concern: highest probability over the regions where that concern can appear
       ──► report concerns above their own threshold; none => "clear"
```

| File | What it is |
|---|---|
| `train_skin_models.py` | Training script (runs as a Kaggle GPU job; `kernel-metadata.json`) |
| `tune_aggregation.py` | Picks the per-concern thresholds (optionally from scores recorded in the browser) |
| `evaluate_real_world.py` | Runs the app pipeline on photos / the hand-labelled real-world set |
| `fetch_eval_images.py` | Downloads the real-world test photos (Wikimedia Commons) |
| `fetch_clear_portraits.py` | Downloads real-skin "clear" training portraits (Openverse) |
| `../public/skin-model.js` | The same pipeline in the browser |
| `../public/models/` | Shipped model (`concerns/model.int8.onnx`, `labels.json`) + face landmarker |

`labels.json` is the contract between training and the app: classes, region geometry, which
regions count for which concern, thresholds, and the face/skin rules. The browser reads all of
these from it, so they cannot drift apart.

## Results (honest numbers)

Three different test sets, from easiest to hardest:

* **Patches** — held-out dataset skin patches. Easy: same kind of images as training.
* **Dataset faces** — held-out full faces from the datasets, all regions combined like the app.
* **Real photos** — 62 hand-labelled, openly licensed photos (Wikimedia Commons + Openverse),
  never used for training or tuning, checked by perceptual hash against all training images.
  45 are usable by the pipeline (frontal, big enough face). Scored in a headless browser running
  the actual web app. **This is the number that matters.**

| Version | Change | Patches | Dataset faces | Real photos (browser, 45 faces) |
|---|---|---|---|---|
| v1 | whole images, 6 classes, no "clear" | 88.9% | – | "wrinkles 93%" on a clear 20-year-old |
| v2 | face-region patches, "clear" class | 87.2% | 76% (28% clear flagged) | 40% top-1 (on the first 25-face set) |
| **v3 (shipped)** | real-skin portraits, fixed regions, per-concern thresholds, 6-view averaging; pores/blackheads not reported | 88.3% | 86% (10% clear flagged) | **53% top-1, 3/21 clear flagged, 11/24 concerns found, 50% precision** |
| v4 | + JPEG/resampling augmentation, 112 portraits | 85.6% | 81% | 56% top-1, 6/21 clear flagged, 41% precision |
| B2 | v4 data, EfficientNet-B2 (8.2 MB) | 87.7% | 81% (6% clear flagged) | 40% top-1, 9/21 clear flagged, 24% precision |
| v4+B2 | averaged | – | 86% (5% clear flagged) | 49% top-1, 9/21 clear flagged |

**Shipped: v3 without pores/blackheads.** Same top-1 as v3 with all concerns, fewer clear faces
flagged, precision up from 41% to 50%. With 45 real faces, differences of a few points are noise.

**Key finding:** past v3, dataset validation stopped predicting real-photo performance — the
bigger model and the validation-best combination were *worse* on real photos. Further progress
needs real, labelled selfies both to tune on and to test on.

Lessons that shaped each version:

1. **High test accuracy ≠ works on real photos.** v1 scored 88.9% but had learned "a full face
   means wrinkles" (most full-face training images were in the wrinkles class).
2. **The "clear" examples matter most.** v2's clear class came from stock/advert photos with
   airbrushed skin, so ordinary skin texture looked like a problem. v3 adds hand-reviewed real
   portraits.
3. **Measure the pipeline users run.** Browser and Python differed by up to 0.27 in probability
   for the same photo (colour profiles, resampling, and a model that flipped class on a 3-pixel
   shift). Fixes: sRGB conversion, 6-view averaging, and tuning thresholds on scores recorded in
   a headless browser.
4. **Full int8 quantization broke EfficientNet** (88.7% → 27%). Weight-only int8 keeps accuracy
   and still shrinks the model 16 MB → 4.3 MB.
5. **More training tricks stopped paying off at v3/v4.** The limit is data: real, consented,
   labelled selfies (see the photo-collection plan) would help far more than another run.
6. **The skin-type (oily/dry/normal) model was dropped**: 24% on held-out photos, i.e. chance.
   Those public images do not show oiliness in a learnable way. Oiliness is estimated from shine.

Accuracy by skin tone (ITA° buckets) is reported in `metrics.json`; no bucket is systematically
worse on dataset faces, but the real-world set is too small to check this properly.

## Collecting real data (the path to production accuracy)

```
user photo → analysis (OpenRouter → NVIDIA → on-device) → user confirms/corrects concerns
  → opt-in share (18+, consent, EXIF stripped, deletion code) → storage (R2/B2/S3)
  → python ml/export_contributions.py [--upload]   # sync (honours deletions) + class folders
  → Kaggle training (source "lumnica-contributions", private dataset) → compare on ml/eval
```

Each shared photo carries three labels: the **user's confirmed concerns** (training label), the
server AI's answer (**teacher**) and our on-device model's scores (**student**), so you can see
exactly where our model disagrees and distil the teacher into it. Add the dataset to
`kernel-metadata.json` `dataset_sources` after the first `--upload`.

Never mix `ml/eval` (test) images into contributions; keep the test set fixed.

## Limits

* The real-world test set is small (45 usable faces; only 9 acne, 1 redness): expect roughly ±14 points of uncertainty.
* Pores and blackheads are hard to see at normal selfie resolution.
* Freckles are not a class (they are closest to `dark_spots`).
* Tone, undertone and oiliness are pixel measurements, not trained models; lighting shifts them.
* Wellness guidance, not a medical diagnosis.

## Data and licences

* Concern classes: Kaggle datasets `ahmedismaiil/skin-issues-version-2-dataset-balanced` and
  `shijo96john/facial-skin-acne-pigmentation-pores-wrinkles`. Files whose names show they come
  from ACNE04 (academic-only) or stock-photo sites are removed by the training script, but the
  provenance of the rest is not documented by the uploaders. **Before a commercial launch,
  retrain on licensed or self-collected, consented data.** `manifest.csv` (in each training
  output) lists every file used.
* "Clear" portraits: Openverse (CC0 / public-domain mark / CC BY only), hand-reviewed; attribution
  in `clear_portraits/sources.csv`; uploaded as the private Kaggle dataset
  `hackhackwithus/lumnica-clear-portraits`.
* Real-world test photos: Wikimedia Commons; licences in `eval/sources.csv`. Test only.
* Base models: EfficientNet-B0 ImageNet weights (timm, Apache 2.0), MediaPipe Face Landmarker
  (Apache 2.0).

## Re-running

```bash
# environment (Python 3.12 via uv)
uv venv --python 3.12 ml/.venv && uv pip install --python ml/.venv/bin/python \
  kaggle torch torchvision timm scikit-learn scikit-image matplotlib onnx onnxruntime "mediapipe<1"

# train on Kaggle (GPU), then download the outputs
ml/.venv/bin/kaggle kernels push -p ml
ml/.venv/bin/kaggle kernels output hackhackwithus/lumnica-skin-models -p ml/output_vN

# tune thresholds and check on real photos
python ml/tune_aggregation.py ml/output_vN/concerns --write
python ml/evaluate_real_world.py ml/output_vN/concerns --eval

# ship
cp ml/output_vN/concerns/{labels.json,model.int8.onnx} public/models/concerns/
```

Try it: start the server and open `http://localhost:5001/?engine=local`, then upload a photo.
