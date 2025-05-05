#db/postgres_pool.py
import psycopg2.pool
from config import POSTGRES_CONFIG

pg_pool = psycopg2.pool.SimpleConnectionPool(
    1, 10,
    user=POSTGRES_CONFIG["user"],
    password=POSTGRES_CONFIG["password"],
    host=POSTGRES_CONFIG["host"],
    port=POSTGRES_CONFIG["port"],
    database=POSTGRES_CONFIG["database"]
)
