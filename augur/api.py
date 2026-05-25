"""FastAPI service exposing the trained forecaster over HTTP.

Run with:  augur serve   (or)   uvicorn augur.api:app
The model path is read from the AUGUR_MODEL env var (default: artifacts/model.pt).
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from augur.artifacts import DEFAULT_DIR, MODEL_FILE, load_checkpoint
from augur.infer import forecast as run_forecast

app = FastAPI(
    title="Augur Forecasting API",
    version="0.1.0",
    description="Uncertainty-aware financial time-series forecasting (PyTorch).",
)


class ForecastRequest(BaseModel):
    history: list[float] = Field(..., description="Recent observed values; must be at least `lookback` long.")


class ForecastStep(BaseModel):
    step: int
    quantiles: dict[str, float]


class ForecastResponse(BaseModel):
    horizon: int
    quantile_levels: list[float]
    point_forecast: list[float]
    steps: list[ForecastStep]


@lru_cache(maxsize=1)
def _load():
    path = Path(os.environ.get("AUGUR_MODEL", DEFAULT_DIR / MODEL_FILE))
    if not path.exists():
        raise FileNotFoundError(f"No model at {path}. Train one first: `augur train`.")
    return load_checkpoint(path)


@app.get("/health")
def health() -> dict:
    try:
        _, cfg, _ = _load()
        return {"status": "ok", "lookback": cfg.lookback, "horizon": cfg.horizon, "quantiles": list(cfg.quantiles)}
    except FileNotFoundError as e:
        return {"status": "no_model", "detail": str(e)}


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    try:
        model, cfg, scaler = _load()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    try:
        preds = run_forecast(model, scaler, req.history, cfg)  # (H, Q)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    labels = [str(q) for q in cfg.quantiles]
    steps = [
        ForecastStep(step=h + 1, quantiles={labels[i]: round(float(preds[h, i]), 4) for i in range(cfg.n_quantiles)})
        for h in range(cfg.horizon)
    ]
    return ForecastResponse(
        horizon=cfg.horizon,
        quantile_levels=list(cfg.quantiles),
        point_forecast=[round(float(preds[h, cfg.median_idx]), 4) for h in range(cfg.horizon)],
        steps=steps,
    )
