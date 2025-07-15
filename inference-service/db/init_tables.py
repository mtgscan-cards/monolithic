from db.postgres_pool import pg_pool
import logging
import json
import os

logger = logging.getLogger(__name__)

def init_auth_tables():
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.users');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE users (
                id            SERIAL PRIMARY KEY,
                email         VARCHAR(255) UNIQUE NOT NULL,
                username      VARCHAR(64)  UNIQUE,
                full_name     TEXT,
                picture_url   TEXT,
                locale        VARCHAR(10),
                password_hash TEXT,
                google_sub    VARCHAR(255) UNIQUE,
                github_id     BIGINT        UNIQUE,
                created_at    TIMESTAMPTZ DEFAULT NOW()
            );
            """)
        cur.execute("SELECT to_regclass('public.tokens');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                expires_at  TIMESTAMPTZ,
                revoked     BOOLEAN DEFAULT FALSE
            );
            """)
        cur.execute("SELECT to_regclass('public.recovery_codes');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE recovery_codes (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code_hash  TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                used       BOOLEAN DEFAULT FALSE
            );
            """)
        conn.commit()
        logger.info("Authentication tables ensured.")
    except Exception as e:
        conn.rollback()
        logger.error("Error ensuring auth tables:", e)
    finally:
        pg_pool.putconn(conn)

def init_security_tables():
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.login_attempts');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE login_attempts (
                ip            VARCHAR(45) PRIMARY KEY,
                attempt_count INTEGER     DEFAULT 0,
                banned_until  TIMESTAMPTZ,
                last_attempt  TIMESTAMPTZ DEFAULT NOW()
            );
            """)
            conn.commit()
            logger.info("Security tables ensured.")
    except Exception as e:
        conn.rollback()
        logger.error("Error ensuring security tables:", e)
    finally:
        pg_pool.putconn(conn)

def init_collection_tables():
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.collections');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE collections (
                id                     SERIAL PRIMARY KEY,
                user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                label                  VARCHAR(255) NOT NULL,
                card_stack_state_index INTEGER NOT NULL,
                color_top              INTEGER NOT NULL,
                color_bottom           INTEGER NOT NULL,
                is_public              BOOLEAN DEFAULT FALSE,
                is_manual_state        BOOLEAN DEFAULT FALSE,
                user_collection_id     INTEGER NOT NULL,
                created_at             TIMESTAMPTZ DEFAULT NOW()
            );
            """)
            cur.execute("""
            CREATE UNIQUE INDEX idx_user_collection
            ON collections (user_id, user_collection_id);
            """)
        cur.execute("SELECT to_regclass('public.collection_cards');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE collection_cards (
                id            SERIAL PRIMARY KEY,
                collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                card_id       UUID    NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
                added_at      TIMESTAMPTZ DEFAULT NOW()
            );
            """)
        cur.execute("SELECT to_regclass('public.collection_price_snapshots');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE collection_price_snapshots (
                id                  SERIAL PRIMARY KEY,
                collection_card_id  INTEGER NOT NULL REFERENCES collection_cards(id) ON DELETE CASCADE,
                snapshot_date       DATE    NOT NULL,
                prices              JSONB,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_snapshot
                  UNIQUE (collection_card_id, snapshot_date)
            );
            """)
        conn.commit()
        logger.info("Collection tables ensured.")
    except Exception as e:
        conn.rollback()
        logger.error("Error ensuring collection tables:", e)
    finally:
        pg_pool.putconn(conn)

def init_mobile_scan_tables():
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.mobile_scan_sessions');")
        if cur.fetchone()[0] is None:
            cur.execute("""
                CREATE TABLE mobile_scan_sessions (
                    id UUID PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
                    completed BOOLEAN DEFAULT FALSE,
                    result JSONB
                );
            """)
            logger.info("✅ mobile_scan_sessions table created.")
        else:
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='mobile_scan_sessions' AND column_name='completed'
                    ) THEN
                        ALTER TABLE mobile_scan_sessions ADD COLUMN completed BOOLEAN DEFAULT FALSE;
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='mobile_scan_sessions' AND column_name='result'
                    ) THEN
                        ALTER TABLE mobile_scan_sessions ADD COLUMN result JSONB;
                    END IF;
                END
                $$;
            """)
            logger.info("✅ mobile_scan_sessions table updated.")
        cur.execute("SELECT to_regclass('public.mobile_scan_results');")
        if cur.fetchone()[0] is None:
            cur.execute("""
                CREATE TABLE mobile_scan_results (
                    id UUID PRIMARY KEY,
                    session_id UUID NOT NULL REFERENCES mobile_scan_sessions(id) ON DELETE CASCADE,
                    result JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            logger.info("✅ mobile_scan_results table created.")
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("❌ Error ensuring mobile scan tables:", e)
    finally:
        pg_pool.putconn(conn)

def init_landing_cards_table():
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS landing_cards (
                id UUID PRIMARY KEY,
                name TEXT,
                image_uris JSONB
            );
        """)
        cur.execute("SELECT COUNT(*) FROM landing_cards;")
        count = cur.fetchone()[0]
        if count > 0:
            logger.info("[INIT] landing_cards already populated")
            cur.close()
            return
        cur.execute("""
            INSERT INTO landing_cards (id, name, image_uris)
            SELECT id, name, image_uris
            FROM (
                SELECT DISTINCT ON (name) id, name, image_uris
                FROM cards
                WHERE layout = 'normal'
                AND lang = 'en'
                AND highres_image = true
                AND image_uris IS NOT NULL
                AND image_uris->>'png' IS NOT NULL
                ORDER BY name, RANDOM()
            ) sub
            LIMIT 100;
        """)
        conn.commit()
        cur.close()
        logger.info("[INIT] landing_cards table populated with 100 random unique cards")
    except Exception as e:
        logger.exception("[INIT] Failed to initialize landing_cards")
    finally:
        if conn:
            pg_pool.putconn(conn)

def build_tag_cache():
    cache_path = 'tags_cache.json'
    if os.path.exists(cache_path):
        logger.info("Tag cache already exists; skipping build.")
        return
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT keyword, COUNT(*) AS count
            FROM (
                SELECT jsonb_array_elements_text(keywords) AS keyword
                FROM cards
                WHERE keywords IS NOT NULL
                  AND lang = 'en'
                  AND edhrec_rank IS NOT NULL
            ) sub
            GROUP BY keyword
            ORDER BY count DESC
            LIMIT 40;
        """)
        tags = [{'keyword': row[0], 'count': row[1]} for row in cur.fetchall()]
        with open(cache_path, 'w') as f:
            json.dump({"tags": tags}, f)
        logger.info("Tag cache built.")
    except Exception as e:
        logger.error("Error building tag cache:", e)
    finally:
        pg_pool.putconn(conn)
