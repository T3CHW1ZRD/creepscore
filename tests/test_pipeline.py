"""End-to-end behavioural tests for the Augur pipeline."""
from __future__ import annotations

import numpy as np
import torch

from augur.data import generate_series, make_windows
from augur.evaluate import evaluate
from augur.infer import forecast
from augur.model import QuantileForecaster, pinball_loss


def test_generate_series_shape():
    df = generate_series(rows=300, seed=1)
    assert list(df.columns) == ["date", "value"]
    assert len(df) == 300
    assert df["value"].notna().all()


def test_make_windows_shapes():
    series = np.arange(100, dtype=np.float32)
    X, Y = make_windows(series, lookback=10, horizon=3)
    assert X.shape == (88, 10, 1)
    assert Y.shape == (88, 3)
    # Window i target should be the values right after the window.
    assert np.allclose(Y[0], series[10:13])


def test_model_forward_shape():
    model = QuantileForecaster(hidden_size=16, num_layers=1, horizon=4, n_quantiles=3)
    out = model(torch.randn(8, 20, 1))
    assert out.shape == (8, 4, 3)


def test_pinball_loss_is_positive_and_zero_at_truth():
    q = (0.1, 0.5, 0.9)
    target = torch.zeros(4, 3)
    perfect = torch.zeros(4, 3, 3)  # every quantile equals the target
    assert pinball_loss(perfect, target, q).item() == 0.0
    wrong = torch.ones(4, 3, 3)
    assert pinball_loss(wrong, target, q).item() > 0.0


def test_model_beats_naive_baseline(trained):
    metrics = evaluate(trained["model"], trained["scaler"], trained["df"], trained["config"])
    # On a seasonality-dominated series the model must beat the last-value naive
    # baseline. (The tiny/fast test config understates the full-run skill of ~0.7;
    # this margin just guards the "beats baseline" invariant without flakiness.)
    assert metrics["skill_vs_naive"] > 0.05, metrics
    # Intervals should be in a sane calibration band, not collapsed or absurd.
    assert 0.6 <= metrics["interval_coverage"] <= 1.0, metrics


def test_forecast_intervals_are_ordered(trained):
    cfg = trained["config"]
    history = trained["df"]["value"].to_numpy(dtype=np.float32)
    preds = forecast(trained["model"], trained["scaler"], history, cfg)  # (H, Q)
    assert preds.shape == (cfg.horizon, cfg.n_quantiles)
    # Quantiles must be non-decreasing at every horizon (no interval crossing).
    assert np.all(np.diff(preds, axis=1) >= -1e-5)


def test_forecast_rejects_short_history(trained):
    cfg = trained["config"]
    try:
        forecast(trained["model"], trained["scaler"], np.zeros(cfg.lookback - 1), cfg)
        raised = False
    except ValueError:
        raised = True
    assert raised
