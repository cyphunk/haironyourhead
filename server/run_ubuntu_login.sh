#!/usr/bin/bash

cd ~/haironyourhead/server
DISPLAY=:0 gnome-terminal -x bash -c 'node server.js --runtestserver --interface enp3s0 --showname runonlogin; bash'
