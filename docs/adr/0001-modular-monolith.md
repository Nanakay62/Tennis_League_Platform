# ADR 0001: Modular Monolith with Pure Domain Layer

## Status
Accepted

## Context
The Tennis League Platform requires high reliability across 30+ complex, evolving sports league rules (formats, scoring validation, tie-breakers, promotion/demotion, strikes, discounts, playoffs). At our initial scale (pilot to several thousand players), microservices would introduce excessive operational overhead, network latency, distributed transaction complexity, and increased hosting costs.

## Decision
We adopt a **modular monolith** architecture in Python 3.12 with FastAPI:
1. `app/domain/` contains 100% pure Python functions and dataclasses with zero framework dependencies (no FastAPI, no SQLAlchemy, no network or disk I/O). All league policies are executed here and tested in milliseconds via `pytest` and `hypothesis`.
2. Feature modules (`identity/`, `markets/`, `catalog/`, `billing/`, `leagues/`, `matches/`, `playoffs/`, `community/`, `notify/`) handle persistence, API routing, and orchestration.
3. Cross-module imports must follow explicit dependency boundaries.

## Consequences
- **Positive:** Domain logic can be unit-tested thoroughly without database setup or network mocks; rules can be modified safely; hosting runs on a single low-cost VPS.
- **Negative:** Internal modularity boundaries must be actively maintained through linting and code reviews to avoid spaghetti coupling.
