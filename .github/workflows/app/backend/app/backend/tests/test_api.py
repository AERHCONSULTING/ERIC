from fastapi.testclient import TestClient
from app.backend.server import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_upload_and_list():
    csv_content = "col1,col2,col3\nA,1,alpha\nB,2,beta\n"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    response = client.post("/api/upload-csv", files=files)
    assert response.status_code == 200
    assert response.json()["rows_inserted"] == 2

    response = client.get("/api/list")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["col1"] == "A"

def test_query():
    response = client.get("/api/query", params={"col1": "A"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["col1"] == "A"

def test_export_csv():
    response = client.get("/api/export-csv")
    assert response.status_code == 200
    csv_data = response.json()["csv"]
    assert "col1" in csv_data
    assert "A" in csv_data
