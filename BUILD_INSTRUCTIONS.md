# BUILD_INSTRUCTIONS.md

**Relay is built but needs Go to be compiled.**

---

## Prerequisites

```bash
# Install Go (if not installed)
brew install go

# Verify installation
go version
```

---

## Build Instructions

```bash
# Navigate to relay repo
cd ~/repos/relay

# Build
go build -o bin/relay ./cmd/relay

# Test build
./bin/relay --help
```

---

## Quick Test (After Go is installed)

```bash
# Test with a simple task
cd ~/repos/relay
./bin/relay --workdir ~/repos/dev1/pb-api --task "What files are in this directory?"
```

---

## Installation

```bash
# After building, install to PATH
cp bin/relay /usr/local/bin/relay

# Verify
relay --help
```

---

**Note:** Go is required to build Relay. Once built, the binary is standalone.

---

*Created: 2026-03-03*
*Build instructions for Relay*
