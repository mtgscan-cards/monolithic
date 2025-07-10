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
import shutil
import logging
import threading
from datetime import datetime, timezone

from .workers.feature_worker import process_record

logger = logging.getLogger(__name__)
load_dotenv('.env')

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
METADATA_FILE = os.path.join(STAGING_DIR, 'descriptor_update_metadata.json')

def write_metadata(metadata):
    try:
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        logger.info(f"📝 Metadata written to {METADATA_FILE}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to write metadata: {e}")

def load_card_records():
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )
    query = '''
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
    '''
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query)
        return cur.fetchall()

def ensure_staging_files_present():
    for fname in ["candidate_features.h5", "faiss_ivf.index", "id_map.json"]:
        staging_file = os.path.join(STAGING_DIR, fname)
        run_file = os.path.join(RUN_DIR, fname)
        if not os.path.exists(staging_file):
            if os.path.exists(run_file):
                shutil.copy2(run_file, staging_file)
                logger.info(f"✅ Copied {run_file} → {staging_file} (pre-populating staging)")
            else:
                logger.warning(f"⚠️ {run_file} missing; staging file {staging_file} will be created from scratch if required")

def open_h5_file_safely(file_path, backup_path, mode='a'):
    try:
        return h5py.File(file_path, mode)
    except OSError as e:
        logger.warning(f"⚠️ HDF5 open failed with {e}. Restoring from backup.")
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted corrupted HDF5: {file_path}")
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, file_path)
            logger.info(f"Restored HDF5 from backup: {backup_path}")
            return h5py.File(file_path, mode)
        else:
            logger.error(f"❌ No backup available for HDF5: {file_path}")
            raise RuntimeError("HDF5 file unrecoverable.")

def run_inference_check():
    from utils.sift_features import find_closest_card_ransac, load_faiss_index_for_testing

    staging_faiss = "resources/staging/faiss_ivf.index"
    staging_h5 = "resources/staging/candidate_features.h5"
    staging_id_map = "resources/staging/id_map.json"
    load_faiss_index_for_testing(staging_faiss, staging_h5, staging_id_map)

    url = "https://cards.scryfall.io/large/front/3/3/3394cefd-a3c6-4917-8f46-234e441ecfb6.jpg"
    expected_ids = [
        "3394cefd-a3c6-4917-8f46-234e441ecfb6",
        "710160a6-43b4-4ba7-9dcd-93e01befc66f",
        "5c575b9c-0a0b-4a24-98ad-efe604ca33a7",
    ]
    try:
        resp = requests.get(url, timeout=10)
        img = cv2.imdecode(np.frombuffer(resp.content, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            logger.error("❌ Failed to decode test image for sanity check.")
            return False
    except Exception as e:
        logger.error(f"❌ Failed to fetch test image: {e}")
        return False
    best_candidate, *_ = find_closest_card_ransac(
        img,
        k=3,
        min_candidate_matches=1,
        MIN_INLIER_THRESHOLD=8,
        max_candidates=10
    )
    if best_candidate in expected_ids:
        logger.info(f"✅ Inference sanity check PASSED: matched expected ID {best_candidate}")
        return True
    else:
        logger.error(f"❌ Inference sanity check FAILED: expected one of {expected_ids}, got {best_candidate}")
        return False

def run_descriptor_update_pipeline():
    metadata = {
        "start_time": datetime.now(timezone.utc).isoformat(),
        "status": "in_progress",
        "num_cards_total": 0,
        "num_cards_new": 0,
        "faiss_descriptors_total": 0,
        "faiss_trained": False,
        "promotion_successful": False,
        "hf_upload_successful": False,
        "error": None
    }
    write_metadata(metadata)

    try:
        ensure_staging_files_present()
        card_records = load_card_records()
        metadata["num_cards_total"] = len(card_records)
        logger.info(f"🔄 Loaded {len(card_records)} card records for descriptor update.")

        hf_backup = os.path.join(RUN_DIR, 'candidate_features.h5')
        with open_h5_file_safely(H5_FEATURES_FILE, hf_backup, mode='a') as hf:
            processed_ids = set(hf.keys())

        new_records = [r for r in card_records if r['scryfall_id'] not in processed_ids]
        metadata["num_cards_new"] = len(new_records)
        logger.info(f"🆕 {len(new_records)} new records requiring descriptor extraction.")

        MAX_WORKERS = 4
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor, open_h5_file_safely(H5_FEATURES_FILE, hf_backup, mode='a') as hf:
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

        all_descriptors = []
        id_map = []
        with h5py.File(H5_FEATURES_FILE, 'r') as hf:
            for card_id in hf.keys():
                card_grp = hf[card_id]
                for feat_key in card_grp.keys():
                    feat_grp = card_grp[feat_key]
                    descriptors = feat_grp["descriptors"][:].astype(np.float32)
                    all_descriptors.append(descriptors)
                    id_map.extend([card_id] * descriptors.shape[0])

        if not all_descriptors:
            logger.error("❌ No descriptors found; skipping FAISS rebuild.")
            metadata["status"] = "failed"
            metadata["error"] = "No descriptors found for FAISS rebuild."
            write_metadata(metadata)
            return

        all_descriptors = np.vstack(all_descriptors)
        metadata["faiss_descriptors_total"] = all_descriptors.shape[0]

        dim = all_descriptors.shape[1]
        quantizer = faiss.IndexFlatL2(dim)
        index = faiss.IndexIVFPQ(quantizer, dim, 256, 8, 8)

        if all_descriptors.shape[0] < 256:
            logger.error(f"❌ Not enough descriptors ({all_descriptors.shape[0]}) to train with nlist=256. Skipping FAISS rebuild.")
            metadata["status"] = "failed"
            metadata["error"] = "Not enough descriptors for FAISS rebuild."
            write_metadata(metadata)
            return

        index.train(all_descriptors[:10000])
        index.nprobe = 10
        index.add(all_descriptors)
        faiss.write_index(index, FAISS_INDEX_FILE)
        with open(ID_MAP_FILE, 'w') as f:
            json.dump(id_map, f)
        metadata["faiss_trained"] = True
        logger.info(f"✅ FAISS index rebuilt with {index.ntotal} descriptors.")

        if run_inference_check():
            files_to_promote = ["candidate_features.h5", "faiss_ivf.index", "id_map.json"]
            try:
                for fname in files_to_promote:
                    src = os.path.join(STAGING_DIR, fname)
                    dst = os.path.join(RUN_DIR, fname)
                    shutil.copy2(src, dst)
                    logger.info(f"✅ Atomically promoted {src} → {dst}")

                metadata["promotion_successful"] = True

                def upload_hf_background():
                    try:
                        from .upload_to_hf import upload_descriptor_bundle_to_hf
                        upload_result = upload_descriptor_bundle_to_hf()
                        metadata.update(upload_result)
                    except Exception as e:
                        logger.warning(f"⚠️ HF upload failed in background: {e}")
                        metadata["hf_upload_successful"] = False
                        metadata["error"] = str(e)
                    finally:
                        metadata["end_time"] = datetime.now(timezone.utc).isoformat()
                        metadata["status"] = "success" if metadata.get("hf_upload_successful") else "partial_success"
                        write_metadata(metadata)

                upload_thread = threading.Thread(target=upload_hf_background)
                upload_thread.start()
                upload_thread.join()

            except Exception as e:
                logger.error(f"❌ Atomic promotion failed: {e}")
                metadata["status"] = "failed"
                metadata["error"] = str(e)
        else:
            logger.error("❌ Inference validation failed. Staging model discarded. Promotion and upload skipped.")
            metadata["status"] = "failed"
            metadata["error"] = "Inference validation failed."

    except Exception as e:
        logger.exception("❌ Descriptor update pipeline encountered an error.")
        metadata["status"] = "failed"
        metadata["error"] = str(e)

    metadata["end_time"] = datetime.now(timezone.utc).isoformat()
    if metadata["status"] == "in_progress":
        metadata["status"] = "success"
    write_metadata(metadata)

if __name__ == "__main__":
    run_descriptor_update_pipeline()
