# One-shot demo: data -> train -> evaluate -> forecast -> plot -> ONNX.
$ErrorActionPreference = "Stop"
augur gen-data --rows 1200
augur train --data data/series.csv --quiet
augur evaluate
augur forecast
augur plot
augur export-onnx
Write-Host "Done. Now run:  augur serve"
