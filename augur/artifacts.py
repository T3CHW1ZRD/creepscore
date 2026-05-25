"""Checkpoint save/load — the single source of truth tying weights, config, and
the data scaler together so a model is fully reproducible from one file."""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

import torch

from augur.config import Config
from augur.data import Scaler
from augur.model import QuantileForecaster

DEFAULT_DIR = Path("artifacts")
MODEL_FILE = "model.pt"
ONNX_FILE = "model.onnx"
METRICS_FILE = "metrics.json"


def build_model(config: Config, input_size: int = 1) -> QuantileForecaster:
    return QuantileForecaster(
        input_size=input_size,
        hidden_size=config.hidden_size,
        num_layers=config.num_layers,
        horizon=config.horizon,
        n_quantiles=config.n_quantiles,
        dropout=config.dropout,
    )


def save_checkpoint(model: QuantileForecaster, config: Config, scaler: Scaler, path: str | Path) -> None:
    torch.save(
        {
            "state_dict": model.state_dict(),
            "config": asdict(config),
            "scaler": {"mean": scaler.mean, "std": scaler.std},
            "input_size": model.gru.input_size,
        },
        path,
    )


def load_checkpoint(path: str | Path) -> tuple[QuantileForecaster, Config, Scaler]:
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    config = Config.from_dict(ckpt["config"])
    model = build_model(config, input_size=ckpt.get("input_size", 1))
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    scaler = Scaler(ckpt["scaler"]["mean"], ckpt["scaler"]["std"])
    return model, config, scaler
