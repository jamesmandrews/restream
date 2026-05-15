#!/bin/bash
cd "$(dirname "$0")"

git pull
docker compose build --no-cache
docker compose up -d
docker compose logs -f orchestrator
