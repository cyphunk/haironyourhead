#!/usr/bin/bash
# Add this to ~/.profile to execute on user login

cd ~/haironyourhead/server
DISPLAY=:0 gnome-terminal -x bash -c 'node server.js --runtestserver --interface enp3s0 --showname runonlogin; bash' &
sleep 4
DISPLAY=:0 firefox http://localhost:8081/graphs &
