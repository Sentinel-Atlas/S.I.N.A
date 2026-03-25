# Platform Support Strategy

## Current support order

1. **Tier 1 (Primary):** Linux native (Ubuntu/Debian)
2. **Tier 2 (Supported):** Windows with WSL2 Ubuntu
3. **Tier 3 (Future):** Native Windows without WSL2

## Why this order

- Preserves stable Linux-first architecture
- Adds low-risk Windows usability via WSL2
- Avoids destabilizing paths to chase unready native Windows behavior

## Remaining work for native Windows

- Native bootstrap/start parity (PowerShell implementation)
- Windows service/lifecycle management strategy
- Native path normalization and file watcher validation
- Docker/Ollama host integration defaults on native Windows
- Expanded CI coverage for win32 runtime
