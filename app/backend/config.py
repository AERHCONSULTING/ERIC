import os

# Feature flags
STORAGE_MODE = os.environ.get("STORAGE_MODE", "sqlite").lower()  # "sqlite" | "pgch"

# SQLite
SQLITE_PATH = os.environ.get("SQLITE_PATH", "app/backend/mini_bi.db")

# Postgres (metadata)
PG_DSN = os.environ.get("PG_DSN", "postgresql+asyncpg://pbi_user:pbi_pass@localhost:5432/pbi_db")
# Alternative sync for local dev (if needed): "postgresql://pbi_user:pbi_pass@localhost:5432/pbi_db"

# ClickHouse (rows)
CH_URL = os.environ.get("CH_URL", "http://localhost:8123")
CH_USER = os.environ.get("CH_USER", "default")
CH_PASS = os.environ.get("CH_PASS", "")

# MinIO (files)
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minio")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minio123")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "aerh-pbi")
