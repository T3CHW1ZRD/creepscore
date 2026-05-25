"""The model: a GRU encoder with a multi-quantile, multi-horizon head, trained
with the pinball (quantile) loss.

Predicting quantiles instead of a single point is the whole idea — it yields
calibrated prediction *intervals* (how uncertain the forecast is), which is what
makes a forecast usable for real financial decisions.
"""
from __future__ import annotations

import torch
import torch.nn as nn


class QuantileForecaster(nn.Module):
    def __init__(
        self,
        input_size: int = 1,
        hidden_size: int = 64,
        num_layers: int = 2,
        horizon: int = 5,
        n_quantiles: int = 3,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.horizon = horizon
        self.n_quantiles = n_quantiles
        self.gru = nn.GRU(
            input_size,
            hidden_size,
            num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, horizon * n_quantiles),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, lookback, input_size) -> (B, horizon, n_quantiles)."""
        out, _ = self.gru(x)
        last = out[:, -1, :]
        y = self.head(last)
        return y.view(-1, self.horizon, self.n_quantiles)


def pinball_loss(pred: torch.Tensor, target: torch.Tensor, quantiles: tuple[float, ...]) -> torch.Tensor:
    """Quantile loss. pred: (B,H,Q), target: (B,H). Averaged over all elements."""
    target = target.unsqueeze(-1)  # (B,H,1)
    q = torch.tensor(quantiles, dtype=pred.dtype, device=pred.device).view(1, 1, -1)
    err = target - pred
    loss = torch.maximum(q * err, (q - 1.0) * err)
    return loss.mean()
