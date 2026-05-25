"""Plot a forecast: recent history, median path, and the shaded prediction band."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from augur.config import Config
from augur.data import Scaler
from augur.infer import forecast
from augur.model import QuantileForecaster


def plot_forecast(
    model: QuantileForecaster,
    scaler: Scaler,
    history: np.ndarray,
    cfg: Config,
    out: str | Path,
    context: int = 60,
) -> Path:
    import matplotlib

    matplotlib.use("Agg")  # headless / server-safe
    import matplotlib.pyplot as plt

    history = np.asarray(history, dtype=np.float32).ravel()
    preds = forecast(model, scaler, history, cfg)  # (H, Q)
    median = preds[:, cfg.median_idx]
    low, high = preds[:, 0], preds[:, -1]

    tail = history[-context:]
    hx = np.arange(len(tail))
    fx = np.arange(len(tail) - 1, len(tail) - 1 + cfg.horizon + 1)  # connect to last point

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(hx, tail, color="#1f77b4", label="history")
    ax.plot(fx[1:], median, color="#d62728", marker="o", label="forecast (median)")
    band = int((cfg.quantiles[-1] - cfg.quantiles[0]) * 100)
    ax.fill_between(
        fx[1:], low, high, color="#d62728", alpha=0.18, label=f"{band}% prediction interval"
    )
    ax.axvline(len(tail) - 1, color="gray", ls="--", lw=0.8)
    ax.set_title("Augur — forecast with uncertainty")
    ax.set_xlabel("timestep")
    ax.set_ylabel("value")
    ax.legend(loc="upper left")
    fig.tight_layout()
    out = Path(out)
    fig.savefig(out, dpi=130)
    plt.close(fig)
    return out
