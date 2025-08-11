import io
import uuid
import pandas as pd
from sqlalchemy import text
from .config import MINIO_BUCKET
from .db_postgres import pg_engine, ensure_meta
from .db_clickhouse import ch_client
from .storage_minio import minio_client

class PgChRepo:
    """
    Metadata in Postgres (datasets), rows in ClickHouse (table ds_<id>),
    original CSV stored in MinIO (optional).
    All heavy deps are imported lazily via helper modules.
    """

    async def health(self):
        await ensure_meta()
        eng = await pg_engine()
        async with eng.begin() as conn:
            n = (await conn.execute(text("SELECT COUNT(*) FROM datasets"))).scalar()
        return int(n)

    async def upload_csv(self, filename: str, df: pd.DataFrame):
        ds_id = str(uuid.uuid4())[:8]
        table = f"ds_{ds_id}"

        # 1) store file to MinIO (optional for now)
        client = minio_client()
        csv_buf = io.BytesIO()
        df.to_csv(csv_buf, index=False)
        csv_buf.seek(0)
        client.put_object(MINIO_BUCKET, f"datasets/{ds_id}/{filename}", csv_buf, length=len(csv_buf.getvalue()), content_type="text/csv")

        # 2) create CH table typed & insert rows
        ch = ch_client()
        # simple typing: store as String to start; can be optimized later
        # create table with columns derived from df dtypes
        cols_sql = ", ".join([f"`{c}` String" for c in df.columns])
        ch.command(f"CREATE TABLE IF NOT EXISTS {table} ({cols_sql}) ENGINE = MergeTree ORDER BY tuple()")
        # insert rows
        data = df.astype(str).to_dict("records")
        ch.insert(table, [tuple(row.values()) for row in data], column_names=list(df.columns))

        # 3) record metadata in PG
        await ensure_meta()
        eng = await pg_engine()
        async with eng.begin() as conn:
            await conn.execute(
                text("INSERT INTO datasets(id,name,table_name,rows) VALUES (:id,:name,:table,:rows)"),
                {"id": ds_id, "name": filename, "table": table, "rows": len(df)}
            )
        return {"dataset_id": ds_id, "name": filename, "rows": int(len(df))}

    async def list_datasets(self):
        eng = await pg_engine()
        async with eng.begin() as conn:
            rows = (await conn.execute(text("SELECT id,name,rows FROM datasets ORDER BY name ASC"))).mappings().all()
        items = [dict(r) for r in rows]
        return {"items": items, "total": len(items)}

    async def query(self, ds_id: str, limit: int, offset: int, column: str | None, value: str | None):
        # read from CH
        eng = await pg_engine()
        async with eng.begin() as conn:
            row = (await conn.execute(text("SELECT table_name FROM datasets WHERE id = :id"), {"id": ds_id})).first()
        if not row:
            return None, None
        table = row[0]

        ch = ch_client()
        # whitelist: check column exists
        ch_cols = ch.query(f"DESCRIBE TABLE {table}")
        allowed = {c[0] for c in ch_cols.result_set}
        if column and column not in allowed:
            raise ValueError("invalid_column")

        sql = f"SELECT * FROM {table}"
        params = {}
        if column and value is not None:
            sql += f" WHERE `{column}` = %(val)s"
            params["val"] = str(value)
        sql += f" LIMIT %(limit)s OFFSET %(offset)s"
        params["limit"] = int(limit)
        params["offset"] = int(offset)

        res = ch.query(sql, params=params)
        cols = [c[0] for c in res.column_descriptions]
        rows = [dict(zip(cols, row)) for row in res.result_rows]
        return table, rows
