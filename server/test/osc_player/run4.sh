#!/usr/bin/env bash
timeout 20m python3 osc_record_replay.py ./nathan.csv 9999 replay localhost &
timeout 20m python3 osc_record_replay.py ./christiane.csv 9999 replay localhost &
timeout 20m python3 osc_record_replay.py ./chris.csv 9999 replay localhost &
timeout 20m python3 osc_record_replay.py ./phillip.csv 9999 replay localhost &
