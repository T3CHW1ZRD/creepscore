"""Run configuration — one dataclass that fully determines a reproducible run.

Persisted next to every checkpoint so any model can be re-instantiated and any
experiment re-run from disk alone. That reproducibility guarantee is exactly the
MLOps property ML-engineering job postings ask for.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass
class Config:
    # Windowing
    lookback: int = 30          # timesteps of history fed to the model
    horizon: int = 5            # timesteps forecast ahead
    # Model
    hidden_size: int = 64
    num_layers: int = 2
    dropout: float = 0.1
    quantiles: tuple[float, ...] = (0.05, 0.5, 0.95)
    # Training
    lr: float = 1e-3
    epochs: int = 60
    batch_size: int = 64
    patience: int = 10          # early-stopping patience on val loss
    val_frac: float = 0.15
    test_frac: float = 0.15
    seed: int = 42

    @property
    def n_quantiles(self) -> int:
        return len(self.quantiles)

    @property
    def median_idx(self) -> int:
        """Index of the q=0.5 forecast (the point estimate)."""
        return min(range(self.n_quantiles), key=lambda i: abs(self.quantiles[i] - 0.5))

    def to_json(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(asdict(self), indent=2))

    @classmethod
    def from_dict(cls, d: dict) -> "Config":
        d = dict(d)
        if "quantiles" in d:
            d["quantiles"] = tuple(d["quantiles"])
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in known})
