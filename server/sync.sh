#!/usr/bin/env bash
EXCLUDEFLAGS="
--exclude node_modules
--exclude health_monitor
--exclude script_praha.txt
--exclude .git
"
[ $# -le 0 ] && echo "$0 <ip>" && exit 1
#IP=192.168.4.1
IP=$1
set -x
rsync -avz $EXCLUDEFLAGS --chown=apps:apps -e ssh ./ root@${IP}:/home/apps/hoyh/
set +x
