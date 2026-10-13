from fastapi.testclient import TestClient

from app.api import create_app


def test_health_returns_service_status(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ev-chargeops"}


def test_login_returns_fake_manager_session(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    response = client.post(
        "/auth/login",
        json={"email": "admin@goodwe.local", "password": "chargeops"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["token"] == "fake-token-manager"
    assert payload["user"]["role"] == "manager"
    assert payload["user"]["name"] == "Gestor Energy Innovation Lab"


def test_login_rejects_invalid_fake_credentials(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    response = client.post(
        "/auth/login",
        json={"email": "admin@goodwe.local", "password": "errada"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais invalidas"


def test_me_resolves_fake_token(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    response = client.get("/auth/me", headers={"Authorization": "Bearer fake-token-user-101"})

    assert response.status_code == 200
    assert response.json()["user"]["rfid_tag"] == "RFID-101"


def test_units_auto_seed_empty_database(tmp_path):
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)

    response = client.get("/units")

    assert response.status_code == 200
    assert len(response.json()["units"]) == 3


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
