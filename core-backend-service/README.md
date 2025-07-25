# Backend – Flask + PostgreSQL + FAISS

This is the backend module of the monorepo. It powers authentication, collection management, image inference, and other backend stuff.

---

## Stack Overview

* **Framework**: Flask (Python 3.11)
* **Database**: PostgreSQL 15
* **Authentication**: JWT (access + refresh cookies), OAuth (Google + GitHub)
* **Background Jobs**: Flask-APScheduler (price snapshots)
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
POSTGRES_HOST=mtg-db
POSTGRES_PORT=5432

JWT_SECRET=super-secret-key
FLASK_SECRET_KEY=dev-key

REFRESH_TOKEN_EXPIRE_DAYS=30

# Flask app config
JWT_SECRET=replace-this-with-something-secure
FLASK_SECRET_KEY=also-replace-this-with-something-secure

FLASK_ENV=development

LOG_FILE_PATH=/app/logs/app.log
LOG_LEVEL=INFO
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

This core microservice is part of the `mtgscan-cards/monolithic` repository
Licensed under the GNU General Public License v3.0
See [LICENSE](../LICENSE) for details.
