# Postgres for metadata (datasets, files, dashboards, etc.)
# Using SQLAlchemy Async for future-proofing, but initialized lazily.
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text
from .config import PG_DSN

_pg_engine: AsyncEngine | None = None

async def pg_engine() -> AsyncEngine:
    global _pg_engine
    if _pg_engine is None:
        _pg_engine = create_async_engine(PG_DSN, future=True)
    return _pg_engine

async def ensure_meta():
    eng = await pg_engine()
    async with eng.begin() as conn:
        await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS datasets(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          table_name TEXT NOT NULL,
          rows INTEGER NOT NULL
        );
        """))
