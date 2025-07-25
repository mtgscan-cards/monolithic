import cv2
import numpy as np
import time
import json
from collections import Counter
import concurrent.futures
import logging
from utils.resource_manager import load_resources

logger = logging.getLogger(__name__)

# Pre-initialize expensive objects
global_sift = cv2.SIFT_create(nfeatures=250)
global_CLAHE = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

def extract_features_sift(roi_image, max_features=250):
    debug_timings = {}
    overall_start = time.perf_counter()

    start = time.perf_counter()
    resized = cv2.resize(roi_image, (256, 256))
    debug_timings['resize'] = time.perf_counter() - start

    start = time.perf_counter()
    lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
    debug_timings['to_lab'] = time.perf_counter() - start

    start = time.perf_counter()
    L, A, B = cv2.split(lab)
    L_clahe = global_CLAHE.apply(L)
    debug_timings['clahe'] = time.perf_counter() - start

    start = time.perf_counter()
    lab_clahe = cv2.merge((L_clahe, A, B))
    enhanced_color = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2BGR)
    gray = cv2.cvtColor(enhanced_color, cv2.COLOR_BGR2GRAY)
    debug_timings['color_processing'] = time.perf_counter() - start

    start = time.perf_counter()
    keypoints, descriptors = global_sift.detectAndCompute(gray, None)
    debug_timings['sift_detection'] = time.perf_counter() - start

    if descriptors is not None and len(keypoints) > max_features:
        start = time.perf_counter()
        sorted_kp_des = sorted(zip(keypoints, descriptors), key=lambda x: -x[0].response)
        keypoints, descriptors = zip(*sorted_kp_des[:max_features])
        keypoints, descriptors = list(keypoints), np.array(descriptors)
        debug_timings['feature_limit'] = time.perf_counter() - start

    if descriptors is not None:
        start = time.perf_counter()
        eps = 1e-7
        descriptors = descriptors / (descriptors.sum(axis=1, keepdims=True) + eps)
        descriptors = np.sqrt(descriptors).astype('float32')
        debug_timings['normalization'] = time.perf_counter() - start

    total_time = time.perf_counter() - overall_start
    logger.info("SIFT extraction timings:")
    for step, t in debug_timings.items():
        print(f"  {step}: {t:.3f} seconds")
    print(f"Total SIFT extraction time: {total_time:.3f} seconds")

    return keypoints, descriptors, enhanced_color

def deserialize_keypoints(kps_data):
    return [
        cv2.KeyPoint(d['pt'][0], d['pt'][1], d['size'], d['angle'],
                     d['response'], d['octave'], d['class_id'])
        for d in kps_data
    ]

def load_candidate_features_for_card(card_id, hf):
    features = []
    if card_id in hf:
        card_grp = hf[card_id]
        for feat_key in card_grp.keys():
            kp_json_arr = card_grp[feat_key]["keypoints"][()]
            kp_str = kp_json_arr[0].decode("utf-8") if isinstance(kp_json_arr[0], bytes) else kp_json_arr[0]
            kp_serialized = json.loads(kp_str)
            des = card_grp[feat_key]["descriptors"][()].astype('float32')
            features.append((kp_serialized, des))
    return features

from .model_state import model_resources, model_lock
import faiss
import h5py

def load_faiss_index_for_testing(faiss_path, h5_path, id_map_path):
    faiss_index = faiss.read_index(faiss_path)
    hf = h5py.File(h5_path, 'r')
    with open(id_map_path, 'r') as f:
        id_map = json.load(f)

    with model_lock:
        if model_resources["hdf5_file"]:
            try:
                model_resources["hdf5_file"].close()
            except Exception as e:
                logger.warning(f"Warning: Failed to close existing HDF5: {e}")

        model_resources["faiss_index"] = faiss_index
        model_resources["hdf5_file"] = hf
        model_resources["id_map"] = id_map

    logger.info(f"✅ Loaded FAISS index (ntotal={faiss_index.ntotal}), "
                f"HDF5 with {len(hf.keys())} groups, "
                f"ID map with {len(id_map)} entries from staging for testing.")

def find_closest_card_ransac(roi_image, k=3, min_candidate_matches=1, MIN_INLIER_THRESHOLD=8, max_candidates=10):
    # Safely reload model if marked
    reload_needed = False
    with model_lock:
        if model_resources.get("reload_needed", False):
            reload_needed = True

    if reload_needed:
        logger.info("♻️ Reloading model resources before inference.")
        load_resources()

    with model_lock:
        faiss_index = model_resources["faiss_index"]
        hf = model_resources["hdf5_file"]
        id_map = model_resources["id_map"]

    overall_start = time.perf_counter()
    debug_info = {}

    sift_start = time.perf_counter()
    keypoints, descriptors, processed_img = extract_features_sift(roi_image, max_features=250)
    debug_info['sift_time'] = time.perf_counter() - sift_start
    debug_info['num_keypoints'] = len(keypoints) if keypoints else 0

    if descriptors is None or len(keypoints) == 0:
        debug_info['error'] = "No descriptors found."
        return None, "Unknown", keypoints, processed_img, debug_info

    start = time.perf_counter()
    distances, indices = faiss_index.search(descriptors, k)
    debug_info['faiss_search_time'] = time.perf_counter() - start

    flat_indices = indices.flatten()
    candidate_ids = [id_map[i] for i in flat_indices if i < len(id_map)]
    candidate_counts = Counter(candidate_ids)
    debug_info['faiss_candidate_counts'] = dict(candidate_counts)

    best_inliers = 0
    best_candidate = None
    candidate_debug = {}

    sorted_candidates = sorted(candidate_counts.items(), key=lambda x: -x[1])
    top_candidate_ids = [cand for cand, cnt in sorted_candidates[:max_candidates]]

    def process_candidate(candidate_id):
        local_bf = cv2.BFMatcher()
        cand_debug = {}
        cand_start = time.perf_counter()

        candidate_sets = load_candidate_features_for_card(candidate_id, hf)
        cand_debug['load_time'] = time.perf_counter() - cand_start

        total_inliers = 0
        bf_time_total = 0.0
        ransac_time_total = 0.0

        for kp_serialized, candidate_des in candidate_sets:
            candidate_kp = deserialize_keypoints(kp_serialized)
            bf_start = time.perf_counter()
            matches = local_bf.knnMatch(descriptors, candidate_des, k=2)
            bf_time_total += time.perf_counter() - bf_start

            good_matches = [m for m, n in matches if m.distance < 0.75 * n.distance]
            if len(good_matches) >= 4:
                ransac_start = time.perf_counter()
                src_pts = np.float32([keypoints[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([candidate_kp[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
                ransac_time_total += time.perf_counter() - ransac_start
                if mask is not None:
                    total_inliers += int(mask.sum())

        cand_debug['bf_time_total'] = bf_time_total
        cand_debug['ransac_time_total'] = ransac_time_total
        cand_debug['total_inliers'] = total_inliers
        cand_debug['iteration_time'] = time.perf_counter() - cand_start
        return candidate_id, total_inliers, cand_debug

    if len(top_candidate_ids) > 1:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = {
                executor.submit(process_candidate, cand_id): cand_id
                for cand_id in top_candidate_ids
                if candidate_counts[cand_id] >= min_candidate_matches
            }
            for future in concurrent.futures.as_completed(futures):
                cand_id, total_inliers, cand_debug = future.result()
                candidate_debug[cand_id] = cand_debug
                if total_inliers > best_inliers:
                    best_inliers = total_inliers
                    best_candidate = cand_id
    else:
        for cand_id in top_candidate_ids:
            if candidate_counts[cand_id] < min_candidate_matches:
                continue
            cand_id, total_inliers, cand_debug = process_candidate(cand_id)
            candidate_debug[cand_id] = cand_debug
            if total_inliers > best_inliers:
                best_inliers = total_inliers
                best_candidate = cand_id

    debug_info['best_inliers'] = best_inliers
    debug_info['candidate_debug'] = candidate_debug

    sort_start = time.perf_counter()
    sorted_candidates = sorted(candidate_debug.items(), key=lambda x: -x[1]['total_inliers'])
    debug_info['candidate_sort_time'] = time.perf_counter() - sort_start

    print(f"Candidate sorting took: {debug_info['candidate_sort_time']:.3f} seconds")
    logger.info("Top candidate inlier counts:")
    for idx, (cand, dbg) in enumerate(reversed(sorted_candidates[:3]), start=1):
        print(f"  {idx}. Candidate {cand} - {dbg['total_inliers']} inliers")

    if best_inliers < MIN_INLIER_THRESHOLD:
        best_candidate = None

    debug_info['overall_time'] = time.perf_counter() - overall_start
    return best_candidate, None, keypoints, processed_img, debug_info
