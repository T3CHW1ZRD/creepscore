#!/usr/bin/env bash
# One-shot demo: data -> train -> evaluate -> forecast -> plot -> ONNX.
set -e
augur gen-data --rows 1200
augur train --data data/series.csv --quiet
augur evaluate
augur forecast
augur plot
augur export-onnx
echo "Done. Now run:  augur serve"
