#!/bin/bash
cd "$(dirname "$0")"

docker compose down
docker image rm restream_orchestrator
docker compose build --no-cache orchestrator
docker compose up -d
docker compose logs orchestrator | grep "monitor started"
