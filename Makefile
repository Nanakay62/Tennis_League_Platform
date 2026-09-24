.PHONY: dev check test api-test client-test migrate format

dev-api:
	cd apps/api && uv run fastapi dev app/main.py

dev-mobile:
	cd apps/mobile && npm run start

check: check-api check-client

check-api:
	cd apps/api && uv run ruff format --check .
	cd apps/api && uv run ruff check .
	cd apps/api && uv run mypy app
	cd apps/api && uv run pytest

format-api:
	cd apps/api && uv run ruff check --fix .
	cd apps/api && uv run ruff format .

check-client:
	cd apps/mobile && npm run typecheck

test:
	cd apps/api && uv run pytest -v
