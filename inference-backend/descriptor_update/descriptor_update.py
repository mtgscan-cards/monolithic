import os
import json
import gc
import numpy as np
import psycopg2
import psycopg2.extras
import h5py
import faiss
import tempfile
import requests
import cv2
from dotenv import load_dotenv
from tqdm import tqdm
from concurrent.futures import ProcessPoolExecutor
from .workers.feature_worker import process_record

# ==============================================================================
#                           ─── CONFIGURATION ───
# ==============================================================================

load_dotenv('.env')  # Assumes you're running from backend root
DB_USER = os.getenv("POSTGRES_USER", "mtguser")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "mtgpass")
DB_NAME = os.getenv("POSTGRES_DB", "mtgdb")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

STAGING_DIR = "resources/staging"
RUN_DIR = "resources/run"
os.makedirs(STAGING_DIR, exist_ok=True)

H5_FEATURES_FILE = os.path.join(STAGING_DIR, 'candidate_features.h5')
FAISS_INDEX_FILE = os.path.join(STAGING_DIR, 'faiss_ivf.index')
ID_MAP_FILE = os.path.join(STAGING_DIR, 'id_map.json')

# ==============================================================================
#                           ─── UTILITY FUNCTIONS ───
# ==============================================================================

def load_card_records():
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )
    query = """
        SELECT id AS scryfall_id,
               COALESCE(image_uris->>'png', image_uris->>'large') AS image_url,
               0 AS face_index
        FROM cards
        WHERE layout::text NOT IN ('art_series', 'scheme', 'plane', 'phenomenon')
        AND games @> '["paper"]'
        AND lang = 'en'
        AND digital = false
        AND (promo IS NULL OR promo = false)
        AND image_uris IS NOT NULL
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query)
        return cur.fetchall()

def extract_features(image):
    sift = cv2.SIFT_create(nfeatures=250)
    clahe = cv2.createCLAHE(2.0, (8, 8))
    resized = cv2.resize(image, (256, 256))
    lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
    L, A, B = cv2.split(lab)
    L = clahe.apply(L)
    lab = cv2.merge((L, A, B))
    image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    kp, des = sift.detectAndCompute(gray, None)
    if des is not None:
        des /= (des.sum(axis=1, keepdims=True) + 1e-7)
        des = np.sqrt(des).astype(np.float32)
    return kp, des

def run_inference_check():
    index = faiss.read_index(FAISS_INDEX_FILE)
    with open(ID_MAP_FILE, 'r') as f:
        id_map = json.load(f)

    url = "https://cards.scryfall.io/large/front/3/3/3394cefd-a3c6-4917-8f46-234e441ecfb6.jpg"
    expected_id = "3394cefd-a3c6-4917-8f46-234e441ecfb6"
    resp = requests.get(url)
    img = cv2.imdecode(np.frombuffer(resp.content, np.uint8), cv2.IMREAD_COLOR)
    kp, des = extract_features(img)
    if des is None:
        print("❌ No descriptors found")
        return False
    _, I = index.search(des, 3)
    preds = [id_map[i] for i in I.flatten() if i < len(id_map)]
    result = expected_id in preds
    print(f"{'✅' if result else '❌'} Inference check: Expected={expected_id} Found={preds[:5]}")
    return result

# ==============================================================================
#                    ─── MAIN PIPELINE ENTRYPOINT ───
# ==============================================================================

def run_descriptor_update_pipeline():
    card_records = load_card_records()

    if os.path.exists(H5_FEATURES_FILE):
        with h5py.File(H5_FEATURES_FILE, 'a') as hf:
            processed_ids = set(hf.keys())
    else:
        with h5py.File(H5_FEATURES_FILE, 'w'):
            pass
        processed_ids = set()

    new_records = [r for r in card_records if r['scryfall_id'] not in processed_ids]
    print(f"Total: {len(card_records)} | New to extract: {len(new_records)}")

    descriptor_files = []
    batch_descriptors = []
    id_map = []
    descriptor_count = 0
    MAX_WORKERS = 4
    FAISS_BATCH_SIZE = 5000

    with tempfile.TemporaryDirectory() as temp_dir:
        with h5py.File(H5_FEATURES_FILE, 'a') as hf, ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
            for result in tqdm(executor.map(process_record, new_records), total=len(new_records)):
                if not result:
                    continue
                scryfall_id = result["scryfall_id"]
                image_url = result["image_url"]
                keypoints = result["keypoints"]
                descriptors = np.array(result["descriptors"], dtype=np.float16)

                card_grp = hf.create_group(scryfall_id) if scryfall_id not in hf else hf[scryfall_id]
                feat_grp = card_grp.create_group(f"feature_{len(card_grp)}")
                feat_grp.create_dataset("descriptors", data=descriptors, compression="gzip")
                feat_grp.create_dataset("keypoints", data=[json.dumps(keypoints)],
                                        dtype=h5py.string_dtype(encoding="utf-8"),
                                        compression="gzip")
                feat_grp.attrs["image_url"] = image_url

                batch_descriptors.extend(descriptors.astype(np.float32))
                id_map.extend([scryfall_id] * len(descriptors))
                descriptor_count += len(descriptors)

                if descriptor_count >= FAISS_BATCH_SIZE:
                    path = os.path.join(temp_dir, f"desc_{len(descriptor_files)}.npy")
                    np.save(path, np.vstack(batch_descriptors))
                    descriptor_files.append(path)
                    batch_descriptors.clear()
                    descriptor_count = 0
                    gc.collect()

            if batch_descriptors:
                path = os.path.join(temp_dir, f"desc_{len(descriptor_files)}.npy")
                np.save(path, np.vstack(batch_descriptors))
                descriptor_files.append(path)

        if descriptor_files:
            mmap_refs = [np.load(f, mmap_mode='r') for f in descriptor_files]
            new_descriptors = np.vstack(mmap_refs)
            dim = new_descriptors.shape[1]
            quantizer = faiss.IndexFlatL2(dim)
            index = faiss.IndexIVFPQ(quantizer, dim, 100, 8, 8)
            index.train(new_descriptors[:10000])
            index.nprobe = 10
            index.add(new_descriptors)
            faiss.write_index(index, FAISS_INDEX_FILE)
            with open(ID_MAP_FILE, 'w') as f:
                json.dump(id_map, f)
            print(f"✅ FAISS index written with {index.ntotal} descriptors.")

    if run_inference_check():
        for fname in ["candidate_features.h5", "faiss_ivf.index", "id_map.json"]:
            src = os.path.join(STAGING_DIR, fname)
            dst = os.path.join(RUN_DIR, fname)
            if os.path.exists(dst):
                os.remove(dst)
            os.replace(src, dst)
        print("✅ Staging model promoted to production.")
    else:
        print("❌ Inference failed. Staging model discarded.")

# Optional CLI trigger
if __name__ == "__main__":
    run_descriptor_update_pipeline()
