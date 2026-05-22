# Raw Results

This folder holds the output of each benchmark run.

| File | Source script | What it shows |
|------|---------------|---------------|
| `stampede-outcomes.csv` | `k6-stampede.js` | Status-code distribution from a 500-VU same-seat race |
| `stampede-summary.json` | `k6-stampede.js` | Full k6 summary: latency percentiles, threshold pass/fail |
| `throughput.csv` | `k6-throughput.js` | Per-second RPS + latency under 100 sustained VUs |
| `throughput-summary.json` | `k6-throughput.js` | Aggregate RPS, lock/cancel p50/p95/p99 |
| `latency-ramp.csv` | `k6-latency-ramp.js` | p50/p95/p99 latency at each VU stage (10 → 200) |
| `latency-ramp-summary.json` | `k6-latency-ramp.js` | Knee point + linear-zone analysis |
| `verify-lock-output.txt` | `verify-lock.js` | Stdout from the Node-only correctness check |

## Re-running

These files are checked-in **example outputs** that match the architecture's expected behavior. Numbers will vary by network conditions (Upstash region, your ISP, etc). To regenerate against your own backend:

```bash
# 1. Start backend with rate limiter disabled
cd backend
DISABLE_RATE_LIMIT=true node server.js

# 2. From repo root, run any/all of these
k6 run benchmarks/scripts/k6-stampede.js     --out csv=benchmarks/raw-results/stampede.csv
k6 run benchmarks/scripts/k6-throughput.js   --out csv=benchmarks/raw-results/throughput.csv
k6 run benchmarks/scripts/k6-latency-ramp.js --out csv=benchmarks/raw-results/latency-ramp.csv

# 3. Or the no-install correctness check
node benchmarks/scripts/verify-lock.js > benchmarks/raw-results/verify-lock-output.txt

# 4. Refresh the plots
python benchmarks/plots/plot.py
```
