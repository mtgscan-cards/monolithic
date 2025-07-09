import cv2
import numpy as np
import requests
import logging

logger = logging.getLogger(__name__)

def serialize_keypoints(keypoints):
    return [{
        'pt': kp.pt,
        'size': kp.size,
        'angle': kp.angle,
        'response': kp.response,
        'octave': kp.octave,
        'class_id': kp.class_id
    } for kp in keypoints]

def extract_features_from_url(image_url):
    try:
        response = requests.get(image_url, timeout=10)
        if response.status_code != 200:
            logger.warning(f"⚠️ Failed to fetch image from {image_url} (status code: {response.status_code})")
            return None, None

        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            logger.warning(f"⚠️ Failed to decode image from {image_url}")
            return None, None

        resized = cv2.resize(image, (256, 256))
        lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        L_clahe = clahe.apply(L)
        lab_clahe = cv2.merge((L_clahe, A, B))
        gray = cv2.cvtColor(cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2BGR), cv2.COLOR_BGR2GRAY)

        sift = cv2.SIFT_create(nfeatures=100)
        keypoints, descriptors = sift.detectAndCompute(gray, None)
        if descriptors is None or len(keypoints) == 0:
            logger.warning(f"⚠️ No descriptors found in {image_url}")
            return None, None

        if len(keypoints) > 100:
            sorted_kp_des = sorted(zip(keypoints, descriptors), key=lambda x: -x[0].response)
            keypoints, descriptors = zip(*sorted_kp_des[:100])
            descriptors = np.array(descriptors)

        eps = 1e-7
        descriptors = descriptors / (descriptors.sum(axis=1, keepdims=True) + eps)
        descriptors = np.sqrt(descriptors).astype(np.float16)

        logger.info(f"✅ Extracted {len(keypoints)} keypoints from {image_url}")

        return serialize_keypoints(keypoints), descriptors.tolist()

    except Exception as e:
        logger.warning(f"⚠️ Exception during feature extraction from {image_url}: {e}")
        return None, None

def process_record(row):
    scryfall_id = row['scryfall_id']
    image_url = row['image_url']
    face_index = row['face_index']

    if not image_url:
        logger.warning(f"⚠️ No image URL for scryfall_id {scryfall_id}")
        return None

    keypoints, descriptors = extract_features_from_url(image_url)
    if descriptors is None:
        logger.warning(f"⚠️ Descriptor extraction failed for scryfall_id {scryfall_id}")
        return None

    return {
        "scryfall_id": scryfall_id,
        "image_url": image_url,
        "face_index": face_index,
        "keypoints": keypoints,
        "descriptors": descriptors
    }