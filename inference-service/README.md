# Backend - Inference Service 

This is the memory-optimized, horizontally scalable microservice responsible for descriptor-based Magic: The Gathering card recognition. It exposes a single `/infer` endpoint, powered by OpenCV and FAISS, and manages nightly Scryfall and descriptor updates in isolation from the main application. It should be accessed through an authenticated and authorized forward proxy connection from the core backend service.

---

## Stack Overview

* **Framework**: Flask (Python 3.13)
* **Inference Engine**: OpenCV + FAISS IVF-PQ
* **Storage**: HDF5 (RootSIFT descriptors), PostgreSQL (metadata)
* **Locking**: Redis (safe updates), Thread Lock (watchdog-safe inference)
* **Scheduling**: APScheduler (nightly update pipeline)
* **Docs**: Flasgger (Swagger/OpenAPI)

---

### Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
````

> Requires system packages: `libgl1`, `libglib2.0-0`, `libpq-dev`, `build-essential`

---

### Start Development Server

From the project root:

```bash
~/monolithic $
docker-compose up --build
```

This service will be exposed internally at:

```
http://localhost:5001
```

> The `/infer` route is meant to be accessed only through the `core-api` reverse proxy.

---

## Environment Variables

Create a `.env` file inside `inference-service/`:

```
POSTGRES_USER=mtguser
POSTGRES_PASSWORD=mtgpass
POSTGRES_DB=mtgdb
POSTGRES_HOST=mtg-db
POSTGRES_PORT=5432

REDIS_HOST=redis

SCRYFALL_DATA_DIR=/app/data
LOG_FILE_PATH=/app/logs/inference-service.log
LOG_LEVEL=INFO

FRONTEND_URL=http://localhost:3000
FLASK_ENV=development
```

---

## Descriptor Resources

### Files expected in `/app/resources/run/`:

* `faiss_ivf.index` – trained FAISS IVF-PQ index
* `candidate_features.h5` – RootSIFT descriptors and keypoints
* `id_map.json` – maps index IDs to Scryfall UUIDs

If missing, they will be downloaded from the nightly release:

```
https://huggingface.co/datasets/JakeTurner616/mtg-cards-SIFT-Features
```

> Automatically file-locked and shared-safe across containers.

---

## Inference Flow

1. User submits image to `/infer` (via core proxy)
2. Image → CLAHE → SIFT → RootSIFT
3. Nearest neighbors searched via FAISS
4. Geometric filtering via RANSAC
5. Best-matching card ID returned

---

## Scheduled Updates

A nightly descriptor refresh pipeline is scheduled:

* Downloads latest Scryfall bulk data
* Refreshes PostgreSQL card records
* Rebuilds and validates descriptor files
* Promotes new files to `/resources/run/`

---

## Locking System

To ensure safe, reliable behavior across containers:

### Redis Lock (Update Safety)

Used during descriptor updates to ensure **only one instance** performs the refresh:

```
model_update_lock → held via Redis
```

Prevents concurrent file writes or database conflicts.

### Watchdog Lock (Serving Safety)

A background thread watches for descriptor file changes. During reload:

* A **local thread lock** (`model_lock`) is acquired
* All incoming inferences **pause until reload completes**

Ensures no request is served while files are partially written.

---

## Deployment

This service is deployed via Docker Compose:

```bash
git pull origin prod
docker-compose down
docker-compose up -d --build
```

Service container: `descriptor-infer-service`
Internal port: `5001`
Proxy path: `/infer` via `core-api`

---

## Swagger Docs

Access full OpenAPI docs at:

```
http://localhost:5001/apidocs
```

---

## LICENSE

This inference microservice is part of the `mtgscan-cards/monolithic` repository
Licensed under the GNU General Public License v3.0
See [LICENSE](../LICENSE) for details.
