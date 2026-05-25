"""ONNX parity and live API tests."""
from __future__ import annotations

from augur.artifacts import save_checkpoint
from augur.export import export_onnx, verify_parity


def test_onnx_parity(trained, tmp_path):
    onnx_path = tmp_path / "model.onnx"
    export_onnx(trained["model"], trained["config"], onnx_path)
    max_diff = verify_parity(trained["model"], trained["config"], onnx_path)
    assert max_diff < 1e-4, f"PyTorch/ONNX outputs diverged: {max_diff}"


def test_api_forecast(trained, tmp_path, monkeypatch):
    ckpt = tmp_path / "model.pt"
    save_checkpoint(trained["model"], trained["config"], trained["scaler"], ckpt)
    monkeypatch.setenv("AUGUR_MODEL", str(ckpt))

    import augur.api as api

    api._load.cache_clear()  # drop any cached model from a previous test
    from fastapi.testclient import TestClient

    client = TestClient(api.app)

    health = client.get("/health").json()
    assert health["status"] == "ok"
    assert health["horizon"] == trained["config"].horizon

    history = trained["df"]["value"].tolist()
    resp = client.post("/forecast", json={"history": history})
    assert resp.status_code == 200
    body = resp.json()
    assert body["horizon"] == trained["config"].horizon
    assert len(body["point_forecast"]) == trained["config"].horizon
    assert len(body["steps"]) == trained["config"].horizon
    # Every step exposes one number per quantile level.
    assert len(body["steps"][0]["quantiles"]) == trained["config"].n_quantiles


def test_api_rejects_short_history(trained, tmp_path, monkeypatch):
    ckpt = tmp_path / "model.pt"
    save_checkpoint(trained["model"], trained["config"], trained["scaler"], ckpt)
    monkeypatch.setenv("AUGUR_MODEL", str(ckpt))

    import augur.api as api

    api._load.cache_clear()
    from fastapi.testclient import TestClient

    client = TestClient(api.app)
    resp = client.post("/forecast", json={"history": [1.0, 2.0, 3.0]})  # far too short
    assert resp.status_code == 422
