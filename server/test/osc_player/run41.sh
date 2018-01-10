#!/usr/bin/env bash
#python3 osc_record_replay.py ./nathan.csv 9999 replay localhost
timeout 20m python3 osc_record_replay.py ./test_graphs.csv 9999 replay localhost >/dev/null &
timeout 20m python3 osc_record_replay.py ./test_graphs1.csv 9999 replay localhost >/dev/null &
timeout 20m python3 osc_record_replay.py ./test_graphs2.csv 9999 replay localhost >/dev/null &
timeout 20m python3 osc_record_replay.py ./test_graphs3.csv 9999 replay localhost >/dev/null &
timeout 20m python3 osc_record_replay.py ./test_graphs4.csv 9999 replay localhost >/dev/null &
timeout 20m python3 osc_record_replay.py ./test_graphs5.csv 9999 replay localhost >/dev/null &
timeout 20m python3 osc_record_replay.py ./test_graphs6.csv 9999 replay localhost >/dev/null &
