# Performance Benchmarks

This document summarizes recent end-to-end spawn latency and operational timings.

## Spawn latency (end-to-end)
Source: `runs.json` (last 30 days).

| Metric | Value |
| --- | --- |
| Count | 63 |
| Min | 25,015 ms (25.0 s) |
| P50 | 52,222 ms (52.2 s) |
| P90 | 164,121 ms (164.1 s) |
| P95 | 243,511 ms (243.5 s) |
| Max | 381,385 ms (381.4 s) |
| Avg | 78,971 ms (79.0 s) |

Notes:
- Duration reflects the orchestrator run time for a spawn, including analysis, retrieval, and flight plan generation.
- Latency varies with repo size, retrieval mode, and LLM rerank configuration.

## Repo scan and vector index timings
See the Timing Summary section in `docs/marketability-demo-report.md`.

## Refreshing benchmarks
Run:
```bash
npm run marketability:demo
```
This generates `docs/marketability-demo-report.md` with scan, spawn, evaluation, and vector index timing data.
