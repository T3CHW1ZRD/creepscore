"""Shared fixtures. The model is trained once per session (fast on the small
config) and reused across tests."""
from __future__ import annotations

import pytest

from augur.config import Config
from augur.data import generate_series
from augur.train import train


@pytest.fixture(scope="session")
def fast_config() -> Config:
    return Config(lookback=20, horizon=4, hidden_size=32, epochs=30, patience=6, seed=0)


@pytest.fixture(scope="session")
def dataset(fast_config):
    return generate_series(rows=700, seed=0)


@pytest.fixture(scope="session")
def trained(fast_config, dataset):
    model, scaler, history = train(dataset, fast_config, verbose=False)
    return {"model": model, "scaler": scaler, "config": fast_config, "df": dataset, "history": history}
