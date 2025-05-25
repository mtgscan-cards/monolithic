# Backend – Flask + PostgreSQL + FAISS

This is the backend module of the monorepo. It powers authentication, collection management, image inference, and other backend stuff.

---

## Stack Overview

* **Framework**: Flask (Python 3.11)
* **Database**: PostgreSQL 15
* **Authentication**: JWT (access + refresh cookies), OAuth (Google + GitHub)
* **Image Matching**: OpenCV + RootSIFT + FAISS IVF-PQ
* **Background Jobs**: Flask-APScheduler (e.g. daily Scryfall sync)
* **Docs**: Flasgger (Swagger/OpenAPI)

---

### Install dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

### Start development server

start the compose stack from the project root:

```bash
~/monolithic $
docker-compose up --build
```

---

## Environment Variables

Create a `.env` file in the `inference-backend/` directory with the following placeholders changed to match the local development env:

```
POSTGRES_USER=mtguser
POSTGRES_PASSWORD=mtgpass
POSTGRES_DB=mtgdb
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

JWT_SECRET=super-secret-key
FLASK_SECRET_KEY=dev-key
FRONTEND_URL=http://localhost:5173
```

---

## Deployment

This portion of the app is deployed via workflow dispatch:

* **Docker Compose** on a self-hosted server
* **GitHub Actions** (manual `workflow_dispatch` to `prod` branch)

```bash
git pull origin prod
docker-compose down
docker-compose up -d --build
```

---

## LICENSE

This project is licensed under the GNU General Public License v3.0.
See the [LICENSE](../LICENSE) file for full details.
