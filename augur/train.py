"""Training: seeded, time-ordered split, early stopping, pinball loss.

Everything that affects the result is derived from `Config` + the input series,
so two runs with the same config and data produce the same weights.
"""
from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, TensorDataset

from augur.artifacts import build_model
from augur.config import Config
from augur.data import Scaler, make_windows
from augur.model import pinball_loss


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True, warn_only=True)


def _split(values: np.ndarray, cfg: Config) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = len(values)
    n_test = int(n * cfg.test_frac)
    n_val = int(n * cfg.val_frac)
    n_train = n - n_val - n_test
    return values[:n_train], values[n_train : n_train + n_val], values[n_train - cfg.lookback :]  # test gets context


def _loader(values: np.ndarray, cfg: Config, shuffle: bool) -> DataLoader:
    X, Y = make_windows(values, cfg.lookback, cfg.horizon)
    ds = TensorDataset(torch.from_numpy(X), torch.from_numpy(Y))
    return DataLoader(ds, batch_size=cfg.batch_size, shuffle=shuffle)


def train(df: pd.DataFrame, cfg: Config, artifacts_dir: str | Path = "artifacts", verbose: bool = True):
    """Train a model on df['value']; persist checkpoint + metrics. Returns (model, scaler, history)."""
    set_seed(cfg.seed)
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    values = df["value"].to_numpy(dtype=np.float32)
    train_raw, val_raw, _ = _split(values, cfg)

    scaler = Scaler().fit(train_raw)
    train_s = scaler.transform(train_raw)
    # Give val its lookback context from the tail of train to avoid a cold start.
    val_s = scaler.transform(np.concatenate([train_raw[-cfg.lookback :], val_raw]))

    train_loader = _loader(train_s, cfg, shuffle=True)
    val_loader = _loader(val_s, cfg, shuffle=False)

    model = build_model(cfg, input_size=1)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr)

    best_val = float("inf")
    best_state = None
    epochs_no_improve = 0
    history: list[dict] = []

    for epoch in range(1, cfg.epochs + 1):
        model.train()
        tr_loss = 0.0
        for xb, yb in train_loader:
            opt.zero_grad()
            loss = pinball_loss(model(xb), yb, cfg.quantiles)
            loss.backward()
            opt.step()
            tr_loss += loss.item() * len(xb)
        tr_loss /= len(train_loader.dataset)

        model.eval()
        va_loss = 0.0
        with torch.no_grad():
            for xb, yb in val_loader:
                va_loss += pinball_loss(model(xb), yb, cfg.quantiles).item() * len(xb)
        va_loss /= len(val_loader.dataset)
        history.append({"epoch": epoch, "train_loss": round(tr_loss, 6), "val_loss": round(va_loss, 6)})
        if verbose:
            print(f"epoch {epoch:3d}  train {tr_loss:.5f}  val {va_loss:.5f}")

        if va_loss < best_val - 1e-6:
            best_val, best_state, epochs_no_improve = va_loss, {k: v.clone() for k, v in model.state_dict().items()}, 0
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= cfg.patience:
                if verbose:
                    print(f"early stopping at epoch {epoch} (best val {best_val:.5f})")
                break

    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()
    return model, scaler, history
