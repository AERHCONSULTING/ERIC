from sqlalchemy import create_engine, text
import pandas as pd
import uuid
from .config import SQLITE_PATH

class SqliteRepo:
    def __init__(self):
        self.engine = create_engine(f"sqlite:///{SQLITE_PATH}", future=True)
        with self.engine.begin() as conn:
            conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS datasets(
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              table_name TEXT NOT NULL,
              rows INTEGER NOT NULL
            );
            """)

    def health(self):
        with self.engine.begin() as conn:
            n = conn.exec_driver_sql("SELECT COUNT(*) FROM datasets").scalar()
        return int(n)

    def upload_csv(self, filename: str, df: pd.DataFrame):
        ds_id = str(uuid.uuid4())[:8]
        table = f"ds_{ds_id}"
        with self.engine.begin() as conn:
            df.to_sql(table, conn, if_exists="replace", index=False)
            conn.exec_driver_sql(
                "INSERT INTO datasets(id,name,table_name,rows) VALUES (?,?,?,?)",
                (ds_id, filename, table, len(df))
            )
        return {"dataset_id": ds_id, "name": filename, "rows": int(len(df))}

    def list_datasets(self):
        with self.engine.begin() as conn:
            rows = conn.exec_driver_sql(
                "SELECT id,name,rows FROM datasets ORDER BY rowid DESC"
            ).mappings().all()
        items = [dict(r) for r in rows]
        return {"items": items, "total": len(items)}

    def _columns(self, table: str):
        with self.engine.begin() as conn:
            cols = conn.exec_driver_sql(f"PRAGMA table_info({table})").all()
        return [c[1] for c in cols]

    def _table_for(self, ds_id: str):
        with self.engine.begin() as conn:
            row = conn.exec_driver_sql("SELECT table_name FROM datasets WHERE id = ?", (ds_id,)).first()
        return row[0] if row else None

    def query(self, ds_id: str, limit: int, offset: int, column: str | None, value: str | None):
        table = self._table_for(ds_id)
        if not table:
            return None, None
        if column:
            cols = self._columns(table)
            if column not in cols:
                raise ValueError("invalid_column")
        sql = f"SELECT * FROM {table}"
        params = {}
        if column and value is not None:
            sql += " WHERE " + column + " = :val"
            params["val"] = value
        sql += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = offset
        with self.engine.begin() as conn:
            res = conn.exec_driver_sql(text(sql), params).mappings().all()
        return table, [dict(r) for r in res]
