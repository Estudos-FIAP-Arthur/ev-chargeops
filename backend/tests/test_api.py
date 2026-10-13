from fastapi.testclient import TestClient

from app.api import create_app


def test_health_returns_service_status(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ev-chargeops"}


def test_seed_creates_demo_data_and_invoices(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    seed_response = client.post("/seed")
    invoice_response = client.get("/invoices/2026-06")

    assert seed_response.status_code == 200
    assert seed_response.json()["sessions"] >= 5
    assert invoice_response.status_code == 200
    invoices = invoice_response.json()["invoices"]
    assert {invoice["unit_id"] for invoice in invoices} == {"unit-101", "unit-202", "unit-303"}
    assert next(invoice for invoice in invoices if invoice["unit_id"] == "unit-303")["total"] == 35.0


def test_simulates_session_by_rfid_and_updates_invoice(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)
    client.post("/seed")

    response = client.post(
        "/sessions/simulate",
        json={
            "rfid_tag": "RFID-303",
            "vehicle_id": "vehicle-303",
            "start": "2026-06-20T18:00:00-03:00",
            "end": "2026-06-20T20:00:00-03:00",
            "kwh_delivered": 12.0,
            "status": "concluida",
        },
    )
    invoice_response = client.get("/invoices/2026-06")

    assert response.status_code == 201
    assert response.json()["session"]["user_id"] == "user-303"
    invoice = next(item for item in invoice_response.json()["invoices"] if item["unit_id"] == "unit-303")
    assert invoice["energy_kwh"] == 12.0
    assert invoice["total"] == 50.0


def test_insights_returns_anomalies_and_profiles(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)
    client.post("/seed")

    response = client.get("/insights")

    assert response.status_code == 200
    payload = response.json()
    assert payload["anomalies"]
    assert payload["profiles"]["user-101"]["profile"] == "noturno intensivo"
