import errno, os, sys
try:
    fd = os.open('/tmp/tvdeny/outside-canary', os.O_WRONLY | os.O_TRUNC)
except PermissionError as error:
    assert error.errno in (errno.EACCES, errno.EPERM)
    print('OUTSIDE_WRITE_DENIED:' + str(error.errno), flush=True)
else:
    os.close(fd)
    sys.exit(3)
