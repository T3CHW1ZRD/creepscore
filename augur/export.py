"""Export the trained PyTorch model to ONNX and verify numerical parity.

ONNX is the production-serving story: a framework-agnostic graph that runtimes
like ONNX Runtime execute with lower latency and no Python/PyTorch dependency —
directly answering the "latency optimization / model deployment" line that shows
up in ML-engineering job postings.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from augur.config import Config
from augur.model import QuantileForecaster


def export_onnx(model: QuantileForecaster, cfg: Config, path: str | Path) -> Path:
    model.eval()
    dummy = torch.randn(1, cfg.lookback, 1)
    kwargs = dict(
        input_names=["history"],
        output_names=["quantiles"],
        dynamic_axes={"history": {0: "batch"}, "quantiles": {0: "batch"}},
        opset_version=17,
    )
    try:
        # Force the stable TorchScript exporter; the newer dynamo path needs onnxscript.
        torch.onnx.export(model, dummy, str(path), dynamo=False, **kwargs)
    except TypeError:
        torch.onnx.export(model, dummy, str(path), **kwargs)  # older torch without `dynamo` kwarg
    return Path(path)


def verify_parity(model: QuantileForecaster, cfg: Config, onnx_path: str | Path, n: int = 8) -> float:
    """Return the max absolute difference between PyTorch and ONNX Runtime outputs."""
    import onnxruntime as ort

    x = torch.randn(n, cfg.lookback, 1)
    model.eval()
    with torch.no_grad():
        torch_out = model(x).numpy()
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    onnx_out = sess.run(None, {"history": x.numpy().astype(np.float32)})[0]
    return float(np.max(np.abs(torch_out - onnx_out)))
