#!/bin/bash
# Garante que o Docker e o Postgres de ensaio (container pg16) estão de pé (a sessão do Claude reinicia e derruba o Docker).
docker exec pg16 pg_isready -q 2>/dev/null && exit 0
(rm -f /var/run/docker.pid; setsid nohup dockerd >/tmp/dockerd.log 2>&1 < /dev/null &)
for i in $(seq 1 40); do docker info >/dev/null 2>&1 && break; sleep 1; done
docker start pg16 >/dev/null
for i in $(seq 1 60); do docker exec pg16 pg_isready -q 2>/dev/null && exit 0; sleep 2; done
echo "Postgres de ensaio não subiu"; exit 1
