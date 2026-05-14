#!/usr/bin/env bash
set -euo pipefail

# Restream UFW firewall setup for Ubuntu
# Ports:
#   22/tcp   - SSH
#   9000/udp - SRT ingest (configurable via SRT_PORT)
#   1935/tcp - RTMP (nginx-rtmp relay, only needed if external access required)

SRT_PORT="${SRT_PORT:-9000}"

echo "Configuring UFW firewall..."

# Reset to defaults
ufw default deny incoming
ufw default allow outgoing

# SSH — always allow
ufw allow 22/tcp comment "SSH"

# SRT ingest — UDP
ufw allow "$SRT_PORT"/udp comment "SRT ingest"

# RTMP — only needed if you want external RTMP access to nginx-rtmp
# Uncomment the next line if needed:
# ufw allow 1935/tcp comment "RTMP relay"

# Enable firewall (non-interactive)
ufw --force enable

echo ""
ufw status verbose
echo ""
echo "Firewall configured. Ports open: SSH (22/tcp), SRT ($SRT_PORT/udp)"
