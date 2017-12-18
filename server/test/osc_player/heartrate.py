import time, sys

# Open and read in the .csv file into array of file lines
messages = open(sys.argv[1], 'r').readlines()

# i used to iterate through array
i=0
# message variable will always hold the current line we are parsing from csv
message = messages[i] # start with first line [0]
# split the csv line into its parts
message_elems = message.split(",")
# Store the very first time stamp in the file. With each new line we process
# we will substract the timestamp of the new line from this timestamp in order
# to know how long after the start of recording the paticular line was recorded.
# This lets use parse/calculate/print lines at the same rate as they were
# originally recorded.
messages_first_time = float(message_elems[0])
# next variable will contain the time difference between the timestamp in the
# first line in the csv and the time stamp of the current line being worked on.
# This value will change for each new line from the csv that we parse.
# Because now the first and current line are the same, the time passed is 0.
# Later you'll see that this allows us to parse/calculate/print lines at the
# same rate/speed that they were originally recorded.
message_time_passed = 0

# Record the time that this script was started. Compare the time.time() in
# each loop with time_start to understand how much time has passed while
# executing the script. Lets helps with parse/calculate/print syncronization
time_start = time.time()

# how many beats should we include in our sliding average window:
beatwindow=6
# If a value is over this we consider it a beat:
# For example, with phillip.csv and nathan.csv 600 works but with chris.csv
# it doesnt. In the future it may be better to make this value change over
# time based on it's own sliding window/average of the highest pulse values
beatthreshold = 600
# If value is lower than this, we consider consider it NOT a beat. We only want
# to detect "beats" once, but what if there are 4 or 5 entries all over the
# threashold? We dont want to record them all as beats, and only want to
# record the first one. So when we hit beatthreshold we toggle 'waitforbeat'
# and when we then hit nobeatthreashhold we untoggle 'waitforbeat'
nobeatthreashold = 400
waitforbeat = True
# array to store the sliding window of values. By summing these together and
# dividing by the 'beatwindow' value, we should get the average heart rate
beattimes = [0]*beatwindow
# Here is where I was going to start coding the sliding window to handle
# dynamically setting the beatthreshold value, but I stopped coding
#beatmaxwindow = [0]*beatwindow

while 1:
    # We put this loop in a try/except so that we can ctrl+c to stop the script
    # I can't remember if that is absolutely nescissary but it's what I have now
    try:
        now = time.time()
        time_passed = now - time_start

        # If this iteration happens N time since the start of the script,
        # AND that amount of time passed is greater than the amount of time
        # passed for the currently line in the csv: parse/calculate/print
        # other wise, do the loop again, thereby waiting until more time has
        # passed
        if time_passed > message_time_passed:
            #print ("send:"+message,end="")

            # To get the beat we could simply take the [3] element from the
            # csv line. But I wanted to support OSC lines that may contain
            # multiple values in the future. So instead we take all the values
            # from [3] onward. Anyway, at the moment it's just one, [3].
            args = message_elems[3:]
            beat=int(args[0])
            # this if statement is where we make certain we only record one
            # beat at a time (rather than a bunch of beats when there are
            # many consecutive csv lines that are all over beatthreshold)
            if waitforbeat and beat > beatthreshold:
                #print("bang")
                # By setting waitforbeat=False this section of code will NOT
                # be run again until a csv line value of nobeatthreashold is
                # found.
                waitforbeat = False
                # To slide our window of beat's (to eventually average out)
                # remove the last item in the array, and then add our current
                # timestamp.
                beattimes.pop()
                beattimes.insert(0,now)
                # Average out the values in the window:
                tot = 0
                prev = 0
                for t in beattimes:
                    if prev>0:
                        tot += prev - t
                    prev = t
                avg=tot/len(beattimes)

                print("avg",avg*100)
            elif beat < nobeatthreashold:
                waitforbeat = True

            # increment the message `i` so we grab the next line
            i+=1
            # ... but if we already reached the end of the file, reset i to 0
            # so we loop back to the beginning of the file
            if i >= len(messages):
                i=0
                # Also be sure to reset the start time for the script so that it
                # is in synce with timestamps in the file
                time_start = time.time()
                print("restart")

            # Okay, so now grab the next line for processing:
            message = messages[i]
            message_elems = message.split(",")
            # Get the time stamp for that line
            message_time = float(message_elems[0])
            # get the amount of time passed between the timestamp of the first
            # line of the file, and this one. This value is used at the
            # start of this loop to determine if we parse/calculate/print or
            # not.
            message_time_passed = message_time - messages_first_time

    except KeyboardInterrupt:
        break
