"""Render PNG plots from raw-results/. Run: python benchmarks/plots/plot.py"""

import csv
import json
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RAW = ROOT / "raw-results"
OUT = HERE

# cinema-themed palette to match the frontend
COLOR_WIN     = "#c9a55a"  # gold
COLOR_LOSE    = "#7a3838"  # velvet
COLOR_NEUTRAL = "#5e6a78"  # slate
COLOR_BAD     = "#d04545"  # alarm
COLOR_BG      = "#fbf5e8"  # cream
COLOR_FG      = "#2a2018"  # ink

plt.rcParams.update({
    "figure.facecolor": COLOR_BG,
    "axes.facecolor":   COLOR_BG,
    "axes.edgecolor":   COLOR_FG,
    "axes.labelcolor":  COLOR_FG,
    "axes.titlecolor":  COLOR_FG,
    "xtick.color":      COLOR_FG,
    "ytick.color":      COLOR_FG,
    "text.color":       COLOR_FG,
    "font.family":      "DejaVu Sans",
    "font.size":        11,
    "axes.spines.top":   False,
    "axes.spines.right": False,
    "axes.grid":        True,
    "grid.color":       "#d8cbb0",
    "grid.linestyle":   ":",
    "grid.alpha":       0.6,
})


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(fig, name):
    path = OUT / name
    fig.savefig(path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  wrote {path.relative_to(ROOT.parent)}")


# Bar chart of HTTP status counts from the 500-VU stampede.
def plot_stampede_outcomes():
    rows = read_csv(RAW / "stampede-outcomes.csv")
    codes  = [r["status_code"] for r in rows]
    counts = [int(r["count"])   for r in rows]
    labels = [r["label"]        for r in rows]

    colors = []
    for c in codes:
        if c == "200":   colors.append(COLOR_WIN)
        elif c == "409": colors.append(COLOR_LOSE)
        elif c == "500": colors.append(COLOR_BAD)
        else:            colors.append(COLOR_NEUTRAL)

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(
        [f"{c}\n{l}" for c, l in zip(codes, labels)],
        counts, color=colors, edgecolor=COLOR_FG, linewidth=0.8,
    )

    for bar, count in zip(bars, counts):
        h = bar.get_height()
        ax.annotate(
            f"{count}",
            xy=(bar.get_x() + bar.get_width() / 2, h),
            xytext=(0, 4), textcoords="offset points",
            ha="center", fontsize=12, fontweight="bold",
        )

    ax.set_yscale("symlog", linthresh=10)
    ax.set_ylabel("Number of VUs (log scale)")
    ax.set_title(
        "STAMPEDE TEST — 500 VUs Racing for Seat G12\n"
        "Outcome distribution by HTTP status",
        fontsize=13, fontweight="bold", pad=12,
    )
    ax.text(
        0.5, -0.18,
        "Pass condition: exactly 1× 200, 0× 5xx. "
        "Redis SET NX is atomic — only one VU writes the key first.",
        ha="center", transform=ax.transAxes,
        fontsize=9, style="italic", color="#6a5840",
    )
    ax.yaxis.set_major_formatter(mticker.ScalarFormatter())
    save(fig, "stampede-outcomes.png")


# Latency percentiles (min/p50/p90/p95/p99/max) of the stampede lock requests.
def plot_stampede_latency():
    data = read_json(RAW / "stampede-summary.json")
    lat = data["lock_latency_ms"]

    pcts   = ["min", "med", "p90", "p95", "p99", "max"]
    labels = ["min", "p50", "p90", "p95", "p99", "max"]
    values = [lat[p] for p in pcts]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(
        labels, values,
        color=[COLOR_WIN if l == "p50" else COLOR_NEUTRAL for l in labels],
        edgecolor=COLOR_FG, linewidth=0.8,
    )
    for bar, v in zip(bars, values):
        ax.annotate(
            f"{v} ms",
            xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
            xytext=(0, 4), textcoords="offset points",
            ha="center", fontsize=10,
        )
    ax.set_ylabel("Lock-request latency (ms)")
    ax.set_title(
        "STAMPEDE TEST — Lock-Request Latency Distribution\n"
        "500 VUs hitting /api/bookings/lock-seats simultaneously",
        fontsize=13, fontweight="bold", pad=12,
    )
    ax.text(
        0.5, -0.18,
        f"All 500 VUs received a definitive verdict within {lat['max']} ms. "
        f"Median: {lat['med']} ms, p95: {lat['p95']} ms.",
        ha="center", transform=ax.transAxes,
        fontsize=9, style="italic", color="#6a5840",
    )
    save(fig, "stampede-latency.png")


# RPS and p50/p95 latency on twin axes — shows the system holds flat under load.
def plot_throughput_over_time():
    rows = read_csv(RAW / "throughput.csv")
    t   = np.array([float(r["timestamp_s"])  for r in rows])
    rps = np.array([float(r["rps"])          for r in rows])
    p50 = np.array([float(r["lock_p50_ms"])  for r in rows])
    p95 = np.array([float(r["lock_p95_ms"])  for r in rows])

    fig, ax1 = plt.subplots(figsize=(10, 5.5))

    ax1.plot(t, rps, color=COLOR_WIN, linewidth=2.5, marker="o", markersize=4, label="Throughput (RPS)")
    ax1.set_xlabel("Elapsed time (seconds)")
    ax1.set_ylabel("Requests per second", color=COLOR_WIN)
    ax1.tick_params(axis="y", labelcolor=COLOR_WIN)
    ax1.set_ylim(0, max(rps) * 1.25)

    ax2 = ax1.twinx()
    ax2.spines["top"].set_visible(False)
    ax2.plot(t, p50, color=COLOR_LOSE, linewidth=1.5, linestyle="--", label="Lock p50 latency (ms)")
    ax2.plot(t, p95, color=COLOR_NEUTRAL, linewidth=1.5, linestyle=":",  label="Lock p95 latency (ms)")
    ax2.set_ylabel("Latency (ms)", color=COLOR_LOSE)
    ax2.tick_params(axis="y", labelcolor=COLOR_LOSE)
    ax2.set_ylim(0, max(p95) * 1.8)
    ax2.grid(False)

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="lower center",
               bbox_to_anchor=(0.5, -0.30), ncol=3, frameon=False)

    ax1.set_title(
        "THROUGHPUT TEST — 100 Sustained VUs Over 60 Seconds\n"
        "Each VU targets a unique seat — no contention, measuring raw pipeline RPS",
        fontsize=13, fontweight="bold", pad=12,
    )
    save(fig, "throughput-over-time.png")


# Scaling curve — p50/p95/p99 vs VU count, with error-rate subplot underneath.
def plot_latency_vs_load():
    rows = read_csv(RAW / "latency-ramp.csv")
    vus  = np.array([int(r["target_vus"])    for r in rows])
    p50  = np.array([float(r["lock_p50_ms"]) for r in rows])
    p95  = np.array([float(r["lock_p95_ms"]) for r in rows])
    p99  = np.array([float(r["lock_p99_ms"]) for r in rows])
    err  = np.array([float(r["error_rate"])  for r in rows])

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 7), gridspec_kw={"height_ratios": [3, 1]}, sharex=True)

    ax1.plot(vus, p50, color=COLOR_WIN,     linewidth=2.5, marker="o", markersize=7, label="p50")
    ax1.plot(vus, p95, color=COLOR_LOSE,    linewidth=2.0, marker="s", markersize=6, label="p95")
    ax1.plot(vus, p99, color=COLOR_NEUTRAL, linewidth=1.5, marker="^", markersize=6, label="p99")
    ax1.set_ylabel("Lock-request latency (ms)")
    ax1.legend(loc="upper left", frameon=False)
    ax1.set_title(
        "LATENCY-VS-LOAD — How Lock Latency Scales with Concurrent VUs\n"
        "Ramping load 10 → 200 VUs in 30-second stages",
        fontsize=13, fontweight="bold", pad=12,
    )

    # find the stage where p95 jumped the most — that's the knee
    knee_idx = int(np.argmax(np.diff(p95)))
    ax1.annotate(
        "knee — Redis pipelining\nstarts to saturate",
        xy=(vus[knee_idx + 1], p95[knee_idx + 1]),
        xytext=(vus[knee_idx + 1] - 30, p95[knee_idx + 1] + 200),
        fontsize=9, style="italic", color="#6a5840",
        arrowprops=dict(arrowstyle="->", color="#6a5840", linewidth=0.8),
    )

    ax2.bar(vus, err * 100, width=15, color=COLOR_BAD, edgecolor=COLOR_FG, linewidth=0.6, alpha=0.85)
    ax2.set_ylabel("Error rate (%)")
    ax2.set_xlabel("Target concurrent VUs")
    ax2.set_ylim(0, max(err * 100) * 1.5 + 0.5)

    save(fig, "latency-vs-load.png")


def main():
    print(f"Reading raw results from {RAW.relative_to(ROOT.parent)}")
    print(f"Writing plots to {OUT.relative_to(ROOT.parent)}\n")

    for label, fn in [
        ("stampede outcomes",     plot_stampede_outcomes),
        ("stampede latency",      plot_stampede_latency),
        ("throughput over time",  plot_throughput_over_time),
        ("latency vs load",       plot_latency_vs_load),
    ]:
        print(f"Plotting {label}...")
        try:
            fn()
        except FileNotFoundError as e:
            print(f"  skipped — missing input: {e.filename}", file=sys.stderr)
        except Exception as e:
            print(f"  FAILED — {type(e).__name__}: {e}", file=sys.stderr)

    print("\nDone.")


if __name__ == "__main__":
    main()
