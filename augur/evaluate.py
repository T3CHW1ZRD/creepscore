"""Honest evaluation on a held-out, time-ordered test segment.

Two questions, two metrics:
  1. Is the point forecast better than a naive last-value baseline?  -> skill score
  2. Are the prediction intervals calibrated?  -> empirical coverage vs nominal
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from augur.config import Config
from augur.data import Scaler, make_windows
from augur.infer import forecast_batch
from augur.model import QuantileForecaster


def evaluate(model: QuantileForecaster, scaler: Scaler, df: pd.DataFrame, cfg: Config) -> dict:
    values = df["value"].to_numpy(dtype=np.float32)
    n = len(values)
    n_test = max(cfg.horizon + 1, int(n * cfg.test_frac))
    test_with_ctx = values[n - n_test - cfg.lookback :]

    Xr, Yr = make_windows(test_with_ctx, cfg.lookback, cfg.horizon)  # raw windows + targets
    windows = Xr[:, :, 0]  # (N, lookback)
    pred = forecast_batch(model, scaler, windows, cfg)  # (N, H, Q)

    median = pred[:, :, cfg.median_idx]
    last_val = windows[:, -1][:, None]
    naive = np.repeat(last_val, cfg.horizon, axis=1)

    mae_model = float(np.mean(np.abs(median - Yr)))
    mae_naive = float(np.mean(np.abs(naive - Yr)))
    rmse_model = float(math.sqrt(np.mean((median - Yr) ** 2)))
    skill = 1.0 - mae_model / mae_naive if mae_naive else 0.0

    low, high = pred[:, :, 0], pred[:, :, -1]
    coverage = float(np.mean((Yr >= low) & (Yr <= high)))
    nominal = float(cfg.quantiles[-1] - cfg.quantiles[0])

    return {
        "n_test_windows": int(len(Yr)),
        "horizon": cfg.horizon,
        "mae_model": round(mae_model, 4),
        "mae_naive": round(mae_naive, 4),
        "rmse_model": round(rmse_model, 4),
        "skill_vs_naive": round(skill, 4),  # >0 means the model beats the baseline
        "interval_coverage": round(coverage, 4),
        "interval_nominal": round(nominal, 4),
        "coverage_gap": round(coverage - nominal, 4),
    }
