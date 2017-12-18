#!/usr/bin/python
from __future__ import print_function
import sys, os, time

try:
    import liblo
    USE_LIBLO=True
except:
    import socket
    import struct
    USE_LIBLO=False
    # use socket for replay since mac's have issues installing liblo

if len(sys.argv) < 3:
    print("usage: ", sys.argv[0], " <file> <osc_port> record")
    print("usage: ", sys.argv[0], " <file> <osc_port> replay <target_ip>")
    sys.exit(1)


FILEPATH = sys.argv[1]

OSCPORT = int(sys.argv[2])

if sys.argv[3] == 'record':
    if not USE_LIBLO:
        print("can't record on this system because we do not have pyliblo package")
        sys.exit()
    RECORD = True
    if os.path.exists(FILEPATH):
        print(FILEPATH,"already exists. Please delete first if you wish to overwrite")
        sys.exit(1)
elif sys.argv[3] == 'replay':
    RECORD = False

    if len(sys.argv) < 4:
        print("forgot target ip")
        sys.exit(1)

    IP=sys.argv[4]

    if len(sys.argv) > 5:
        PATH=sys.argv[5]
    else:
        PATH=None

fileh = None



#
# Write incoming osc messages to a file
#
def osc_callback(path, args, types, src):

    #print("osc_callback() path: %s " % (path),end="")
    #for a, t in zip(args, types):
    #    print(" arg: %s:%s" % (t, a),end="")
    print("callback")
    if not fileh:
        print("file not open")
        return

    timestamp = str(time.time())

    # concat arguments into one , seperated list:
    arguments = ",".join(str(x) for x in args)

    print(timestamp+","+path+","+types+","+arguments)
    fileh.write(timestamp+","+path+","+types+","+arguments+"\n")


if RECORD:
    try:
        server = liblo.ServerThread(OSCPORT)
        print("server started on port:",OSCPORT)
    except liblo.ServerError as err:
        print(err)
        sys.exit()

    try:
        fileh = open(FILEPATH, 'w')
    except:
        print("error opening file:",FILEPATH)
        sys.exit()

    server.add_method(None, None, osc_callback)
    print("osc_callback method added")
    server.start()
    print("server started")
    # keep the party going:
    while 1:
        try:
            time.sleep(10)
        except KeyboardInterrupt:
            break
    server.stop()
    fileh.close()
else: # REPLAY
    try:
        fileh = open(FILEPATH, 'r')
    except:
        print("error opening file:",FILEPATH)
        sys.exit()

    if USE_LIBLO:
        target = liblo.Address(IP, OSCPORT)
    else:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        target = (IP,OSCPORT)

    messages = fileh.readlines()
    i=0

    message = messages[i]
    message_time_passed = 0
    message_elems = message.split(",")
    messages_first_time = float(message.split(",")[0])

    time_start = time.time()

    # manage time such that messages are sent at a similar rate of time
    # as they recorded
    while 1:
        try:
            time_passed = time.time() - time_start

            if time_passed > message_time_passed:
                print ("send:"+message,end="")
                if PATH:
                    path = PATH
                else:
                    path = message_elems[1]
                types = message_elems[2]
                args = message_elems[3:]

                if USE_LIBLO:
                    oscmsg = liblo.Message(path)
                    # list(types) = split into individual chars
                    for t, arg in zip(list(types),args):
                        oscmsg.add( (t, arg) )
                    liblo.send(target, oscmsg)
                else:
                    oscmsg = bytearray()
                    oscmsg.extend(path.encode())
                    if len(oscmsg)%4:
                        oscmsg.extend(b'\0' * (4-(len(oscmsg)%4)) )

                    oscmsg.extend(','.encode()+types.encode())
                    if len(oscmsg)%4:
                        oscmsg.extend(b'\0' * (4-(len(oscmsg)%4)) )

                    for t, arg in zip(list(types),args):
                        if t == 'i':
                            oscmsg.extend(struct.pack('>i',int(arg)))
                            if len(oscmsg)%4:
                                oscmsg.extend(b'\0' * 4-(len(oscmsg)%4) )
                        else:
                            print("type",t,"unsupported at the moment")

                    #print("len",len(oscmsg),oscmsg)
                    sent = sock.sendto(oscmsg, target)

                # next:
                i+=1
                if i >= len(messages):
                    i=0
                    time_start = time.time()
                    print("restart")

                message = messages[i]
                message_elems = message.split(",")
                message_time = float(message_elems[0])
                message_time_passed = message_time - messages_first_time

        except KeyboardInterrupt:
            break


    fileh.close()
