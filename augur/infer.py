"""Inference helpers shared by the CLI, the API, and evaluation."""
from __future__ import annotations

import numpy as np
import torch

from augur.config import Config
from augur.data import Scaler
from augur.model import QuantileForecaster


def forecast(model: QuantileForecaster, scaler: Scaler, history: np.ndarray, cfg: Config) -> np.ndarray:
    """Forecast from a 1-D history of raw values.

    Returns an array of shape (horizon, n_quantiles) in the *original* units,
    with quantiles sorted ascending so intervals never cross.
    """
    history = np.asarray(history, dtype=np.float32).ravel()
    if len(history) < cfg.lookback:
        raise ValueError(f"Need at least {cfg.lookback} history points, got {len(history)}.")
    window = scaler.transform(history[-cfg.lookback :])
    x = torch.from_numpy(window.astype(np.float32)).view(1, cfg.lookback, 1)
    model.eval()
    with torch.no_grad():
        out = model(x).numpy()[0]  # (H, Q)
    out = np.sort(out, axis=1)  # enforce monotone quantiles
    return scaler.inverse(out)


def forecast_batch(model: QuantileForecaster, scaler: Scaler, windows_raw: np.ndarray, cfg: Config) -> np.ndarray:
    """Vectorized forecast for many raw windows. windows_raw: (N, lookback) -> (N, H, Q)."""
    xs = scaler.transform(windows_raw).astype(np.float32)[..., None]
    model.eval()
    with torch.no_grad():
        out = model(torch.from_numpy(xs)).numpy()  # (N,H,Q)
    out = np.sort(out, axis=2)
    return scaler.inverse(out)
