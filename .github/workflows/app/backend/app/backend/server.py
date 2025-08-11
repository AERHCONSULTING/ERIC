from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import io

from .config import STORAGE_MODE
from .repo_sqlite import SqliteRepo

app = FastAPI(title="Mini BI")

# Default repo = sqlite
_sqlite = SqliteRepo()

# Lazy holders for pgch
_pgch = None
def pgch_repo():
    global _pgch
    if _pgch is None:
        from .repo_pgch import PgChRepo
        _pgch = PgChRepo()
    return _pgch

def use_pgch():
    return STORAGE_MODE == "pgch"

@app.get("/api/health")
async def health():
    try:
        if use_pgch():
            n = await pgch_repo().health()
        else:
            n = _sqlite.health()
        return {"status":"ok","datasets": n, "mode": STORAGE_MODE}
    except Exception as e:
        return {"status":"degraded","error": str(e), "mode": STORAGE_MODE}

@app.post("/api/files/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "CSV uniquement")
    raw = await file.read()
    df = pd.read_csv(io.BytesIO(raw))
    if df.empty:
        raise HTTPException(400, "CSV vide")

    if use_pgch():
        res = await pgch_repo().upload_csv(file.filename, df)
    else:
        res = _sqlite.upload_csv(file.filename, df)
    return res

@app.get("/api/datasets")
async def list_datasets():
    if use_pgch():
        res = await pgch_repo().list_datasets()
    else:
        res = _sqlite.list_datasets()
    return res

class DataQueryModel(pd.core.base.PandasObject): ...  # just a marker, not used

from pydantic import BaseModel
class DataQuery(BaseModel):
    limit: int = 1000
    offset: int = 0
    column: str | None = None
    value: str | None = None

@app.post("/api/datasets/{ds_id}/data")
async def query_data(ds_id: str, q: DataQuery):
    if use_pgch():
        table, rows = await pgch_repo().query(ds_id, q.limit, q.offset, q.column, q.value)
    else:
        try:
            table, rows = _sqlite.query(ds_id, q.limit, q.offset, q.column, q.value)
        except ValueError:
            raise HTTPException(400, "Colonne invalide")
    if table is None:
        raise HTTPException(404, "dataset inconnu")
    return {"rows": rows, "count": len(rows)}

@app.post("/api/datasets/{ds_id}/export/csv")
async def export_csv(ds_id: str, q: DataQuery):
    data = await query_data(ds_id, q)
    import pandas as pd
    df = pd.DataFrame(data["rows"])
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{ds_id}.csv"'} )
