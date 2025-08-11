# ClickHouse for rows (analytics)
# Lazy client; only used in STORAGE_MODE=pgch
from clickhouse_connect import get_client
from .config import CH_URL, CH_USER, CH_PASS

def ch_client():
    # CH_URL expected like http://host:8123
    # clickhouse-connect expects host, port separately
    # quick parse:
    import urllib.parse as up
    u = up.urlparse(CH_URL)
    host = u.hostname or "localhost"
    port = u.port or 8123
    return get_client(host=host, port=port, username=CH_USER, password=CH_PASS)

def ensure_db():
    # optional: prepare a database/schema if wanted
    pass
