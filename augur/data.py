"""Data: a realistic synthetic indicator generator (so the tool runs with zero
external data) plus a generic CSV loader, and the windowing used for supervised
sequence learning.

The synthetic series is intentionally *learnable* — trend + multi-period
seasonality + AR(1) mean-reversion + noise — so a temporal model can
demonstrably beat naive baselines, which a pure random walk could not. Real
markets are far closer to a random walk; the README is explicit about that.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


def generate_series(rows: int = 1500, seed: int = 42, start: str = "2018-01-01") -> pd.DataFrame:
    """Return a DataFrame with columns ['date', 'value'] of length ``rows``."""
    rng = np.random.default_rng(seed)
    t = np.arange(rows)

    # Mild trend so the series stays roughly stationary in level (a seasonal
    # economic index, not a runaway random walk). Structure dominates the level.
    trend = 100 + 0.005 * t
    weekly = 6.0 * np.sin(2 * np.pi * t / 7)
    monthly = 5.0 * np.sin(2 * np.pi * t / 30.0 + 0.7)
    yearly = 6.0 * np.sin(2 * np.pi * t / 365.0)

    # AR(1) mean-reverting stochastic component.
    ar = np.zeros(rows)
    phi = 0.6
    for i in range(1, rows):
        ar[i] = phi * ar[i - 1] + rng.normal(0, 1.0)

    noise = rng.normal(0, 0.5, size=rows)
    value = trend + weekly + monthly + yearly + ar + noise

    dates = pd.date_range(start=start, periods=rows, freq="D")
    return pd.DataFrame({"date": dates, "value": np.round(value, 4)})


def load_csv(path: str | Path, value_col: str = "value", date_col: str | None = "date") -> pd.DataFrame:
    """Load any CSV into the canonical ['date', 'value'] frame."""
    df = pd.read_csv(path)
    if value_col not in df.columns:
        raise ValueError(f"Column '{value_col}' not found. Available: {list(df.columns)}")
    out = pd.DataFrame()
    if date_col and date_col in df.columns:
        out["date"] = pd.to_datetime(df[date_col], errors="coerce")
    else:
        out["date"] = pd.RangeIndex(len(df))
    out["value"] = pd.to_numeric(df[value_col], errors="coerce")
    out = out.dropna(subset=["value"]).reset_index(drop=True)
    if len(out) < 50:
        raise ValueError(f"Series too short ({len(out)} rows); need at least 50.")
    return out


def make_windows(series: np.ndarray, lookback: int, horizon: int) -> tuple[np.ndarray, np.ndarray]:
    """Sliding windows. X: (N, lookback, 1) float32; Y: (N, horizon) float32."""
    series = np.asarray(series, dtype=np.float32)
    n = len(series) - lookback - horizon + 1
    if n <= 0:
        raise ValueError(f"Series of length {len(series)} too short for lookback={lookback}, horizon={horizon}.")
    X = np.stack([series[i : i + lookback] for i in range(n)])[..., None]
    Y = np.stack([series[i + lookback : i + lookback + horizon] for i in range(n)])
    return X.astype(np.float32), Y.astype(np.float32)


class Scaler:
    """Standardization using statistics fit on the training segment only."""

    def __init__(self, mean: float = 0.0, std: float = 1.0):
        self.mean = float(mean)
        self.std = float(std) if std else 1.0

    def fit(self, x: np.ndarray) -> "Scaler":
        self.mean = float(np.mean(x))
        self.std = float(np.std(x)) or 1.0
        return self

    def transform(self, x: np.ndarray) -> np.ndarray:
        return (np.asarray(x, dtype=np.float32) - self.mean) / self.std

    def inverse(self, x: np.ndarray) -> np.ndarray:
        return np.asarray(x, dtype=np.float32) * self.std + self.mean
