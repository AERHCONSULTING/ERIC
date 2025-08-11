from fastapi import FastAPI, UploadFile
import sqlite3
import pandas as pd
import io

app = FastAPI()

DB_FILE = "data.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("CREATE TABLE IF NOT EXISTS data (id INTEGER PRIMARY KEY AUTOINCREMENT, col1 TEXT, col2 TEXT, col3 TEXT)")
    conn.commit()
    conn.close()

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))
    conn = sqlite3.connect(DB_FILE)
    df.to_sql("data", conn, if_exists="replace", index=False)
    conn.close()
    return {"rows_inserted": len(df)}

@app.get("/api/list")
def list_data():
    conn = sqlite3.connect(DB_FILE)
    df = pd.read_sql_query("SELECT * FROM data", conn)
    conn.close()
    return df.to_dict(orient="records")

@app.get("/api/query")
def query_data(col1: str):
    conn = sqlite3.connect(DB_FILE)
    df = pd.read_sql_query("SELECT * FROM data WHERE col1 = ?", conn, params=(col1,))
    conn.close()
    return df.to_dict(orient="records")

@app.get("/api/export-csv")
def export_csv():
    conn = sqlite3.connect(DB_FILE)
    df = pd.read_sql_query("SELECT * FROM data", conn)
    conn.close()
    csv_data = df.to_csv(index=False)
    return {"csv": csv_data}
