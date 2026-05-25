"""Augur command-line interface — the whole MLOps lifecycle from one binary.

    augur gen-data      synthesize a labelled time series
    augur train         train the quantile forecaster (seeded, reproducible)
    augur evaluate      score against a naive baseline + check interval coverage
    augur forecast      forecast the next horizon with prediction intervals
    augur export-onnx   export to ONNX and verify PyTorch<->ONNX parity
    augur serve         launch the FastAPI service
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import typer
from rich.console import Console
from rich.table import Table

from augur import __version__
from augur.artifacts import DEFAULT_DIR, METRICS_FILE, MODEL_FILE, ONNX_FILE, load_checkpoint, save_checkpoint
from augur.config import Config

app = typer.Typer(add_completion=False, help="Uncertainty-aware financial forecasting + MLOps pipeline.")
console = Console()


def _load_data(data: Path, value_col: str, date_col: str) -> pd.DataFrame:
    from augur.data import load_csv

    return load_csv(data, value_col=value_col, date_col=date_col)


@app.command()
def version() -> None:
    """Print the Augur version."""
    console.print(f"augur {__version__}")


@app.command("gen-data")
def gen_data(
    rows: int = typer.Option(1500, help="Number of timesteps."),
    out: Path = typer.Option(Path("data/series.csv"), help="Output CSV path."),
    seed: int = typer.Option(42),
) -> None:
    """Generate a synthetic but learnable indicator series."""
    from augur.data import generate_series

    out.parent.mkdir(parents=True, exist_ok=True)
    df = generate_series(rows=rows, seed=seed)
    df.to_csv(out, index=False)
    console.print(f"[green]Wrote[/green] {len(df)} rows to [bold]{out}[/bold]")


@app.command()
def train(
    data: Path = typer.Option(Path("data/series.csv"), help="Input CSV (run gen-data first)."),
    value_col: str = typer.Option("value"),
    date_col: str = typer.Option("date"),
    artifacts: Path = typer.Option(DEFAULT_DIR),
    epochs: int = typer.Option(60),
    lookback: int = typer.Option(30),
    horizon: int = typer.Option(5),
    hidden_size: int = typer.Option(64),
    seed: int = typer.Option(42),
    quiet: bool = typer.Option(False, "--quiet"),
) -> None:
    """Train the quantile forecaster and persist checkpoint + metrics."""
    from augur.evaluate import evaluate as eval_model
    from augur.train import train as train_model

    df = _load_data(data, value_col, date_col)
    cfg = Config(epochs=epochs, lookback=lookback, horizon=horizon, hidden_size=hidden_size, seed=seed)
    artifacts.mkdir(parents=True, exist_ok=True)
    cfg.to_json(artifacts / "config.json")

    model, scaler, history = train_model(df, cfg, artifacts_dir=artifacts, verbose=not quiet)
    save_checkpoint(model, cfg, scaler, artifacts / MODEL_FILE)

    metrics = eval_model(model, scaler, df, cfg)
    metrics["epochs_run"] = len(history)
    metrics["best_val_loss"] = min(h["val_loss"] for h in history)
    (artifacts / METRICS_FILE).write_text(json.dumps(metrics, indent=2))

    console.print(f"\n[green]Saved model[/green] -> {artifacts / MODEL_FILE}")
    _print_metrics(metrics)


@app.command()
def evaluate(
    data: Path = typer.Option(Path("data/series.csv")),
    value_col: str = typer.Option("value"),
    date_col: str = typer.Option("date"),
    artifacts: Path = typer.Option(DEFAULT_DIR),
) -> None:
    """Evaluate a trained model: skill vs naive baseline + interval coverage."""
    from augur.evaluate import evaluate as eval_model

    model, cfg, scaler = load_checkpoint(artifacts / MODEL_FILE)
    df = _load_data(data, value_col, date_col)
    _print_metrics(eval_model(model, scaler, df, cfg))


@app.command()
def forecast(
    artifacts: Path = typer.Option(DEFAULT_DIR),
    data: Path = typer.Option(Path("data/series.csv"), help="Series whose tail is used as history."),
    value_col: str = typer.Option("value"),
    date_col: str = typer.Option("date"),
) -> None:
    """Forecast the next horizon from the tail of a series, with intervals."""
    from augur.infer import forecast as run_forecast

    model, cfg, scaler = load_checkpoint(artifacts / MODEL_FILE)
    df = _load_data(data, value_col, date_col)
    history = df[value_col].to_numpy(dtype=np.float32)
    preds = run_forecast(model, scaler, history, cfg)  # (H, Q)

    table = Table(title="Forecast with prediction intervals", show_lines=False)
    table.add_column("step", justify="right")
    for q in cfg.quantiles:
        table.add_column(f"q{q}", justify="right")
    for h in range(cfg.horizon):
        table.add_row(str(h + 1), *[f"{preds[h, i]:.3f}" for i in range(cfg.n_quantiles)])
    console.print(table)
    lo, hi = cfg.quantiles[0], cfg.quantiles[-1]
    console.print(f"[dim]Point forecast = q0.5; {int((hi - lo) * 100)}% interval = \\[q{lo}, q{hi}].[/dim]")


@app.command()
def plot(
    artifacts: Path = typer.Option(DEFAULT_DIR),
    data: Path = typer.Option(Path("data/series.csv")),
    value_col: str = typer.Option("value"),
    date_col: str = typer.Option("date"),
    out: Path = typer.Option(Path("artifacts/forecast.png")),
    context: int = typer.Option(60, help="How many trailing history points to show."),
) -> None:
    """Render the forecast + prediction band to a PNG (great for the demo)."""
    from augur.viz import plot_forecast

    model, cfg, scaler = load_checkpoint(artifacts / MODEL_FILE)
    df = _load_data(data, value_col, date_col)
    history = df[value_col].to_numpy(dtype=np.float32)
    out.parent.mkdir(parents=True, exist_ok=True)
    path = plot_forecast(model, scaler, history, cfg, out, context=context)
    console.print(f"[green]Saved plot[/green] -> {path}")


@app.command("export-onnx")
def export_onnx_cmd(artifacts: Path = typer.Option(DEFAULT_DIR)) -> None:
    """Export the model to ONNX and verify PyTorch<->ONNX numerical parity."""
    from augur.export import export_onnx, verify_parity

    model, cfg, _ = load_checkpoint(artifacts / MODEL_FILE)
    path = export_onnx(model, cfg, artifacts / ONNX_FILE)
    max_diff = verify_parity(model, cfg, path)
    status = "[green]PASS[/green]" if max_diff < 1e-4 else "[red]FAIL[/red]"
    console.print(f"Exported -> {path}")
    console.print(f"Max |PyTorch - ONNX| = {max_diff:.2e}  {status}")


@app.command()
def serve(
    artifacts: Path = typer.Option(DEFAULT_DIR),
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8000),
) -> None:
    """Launch the FastAPI service for the trained model."""
    import uvicorn

    os.environ["AUGUR_MODEL"] = str(artifacts / MODEL_FILE)
    console.print(f"[green]Serving[/green] {artifacts / MODEL_FILE} at http://{host}:{port}  (docs at /docs)")
    uvicorn.run("augur.api:app", host=host, port=port, reload=False)


def _print_metrics(m: dict) -> None:
    table = Table(title="Evaluation", show_header=False)
    table.add_column("metric", style="cyan")
    table.add_column("value", justify="right")
    for k, v in m.items():
        table.add_row(k, str(v))
    console.print(table)
    if m.get("skill_vs_naive", 0) > 0:
        console.print(f"[green]Model beats naive baseline by {m['skill_vs_naive'] * 100:.1f}% MAE.[/green]")
    else:
        console.print("[yellow]Model does not beat the naive baseline on this data.[/yellow]")


if __name__ == "__main__":
    app()
