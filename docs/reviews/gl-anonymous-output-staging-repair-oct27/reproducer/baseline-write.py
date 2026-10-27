    def write(self, name, data):
        name = self.name(name)
        temporary = name + '.new'
        with self.directory() as directory:
            self.verify(directory)
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=directory)
            try:
                self.bound(directory, temporary, fd)
                remaining = memoryview(data)
                while remaining:
                    count = os.write(fd, remaining)
                    if count <= 0:
                        raise RuntimeError('short output write')
                    remaining = remaining[count:]
                self.bound(directory, temporary, fd)
                # procfs paths preserve the existing replace-observation contract
                # while anchoring BOTH parents to the verified open directory.
                anchor = pathlib.Path('/proc/self/fd') / str(directory)
                os.replace(anchor / temporary, anchor / name)
                self.bound(directory, name, fd)
            finally:
                os.close(fd)
