#!/usr/bin/env bash
sudo tcpdump -nAA port 9999 | grep '/'
