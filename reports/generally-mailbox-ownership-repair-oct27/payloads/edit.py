from pathlib import Path
p=Path('/tmp/generally-mailbox-ownership-repair-oct27/repo/tools/generally-loading-controller.py')
s=p.read_text().replace('    os.replace(tmp, path)\n','    os.replace(tmp, path)\n    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)\n    try:\n        os.fsync(directory)\n    finally:\n        os.close(directory)\n',1)
s=s.replace('        self.root = Path(root)\n        self.consumed = {}\n        (self.root / \'requests\').mkdir(exist_ok=True)\n', '''        self.root = Path(root).resolve(strict=True)
        self.consumed = {}
        self.journal = None
        self.started = False
        (self.root / 'requests').mkdir(exist_ok=True)
        (self.root / 'replies').mkdir(exist_ok=True)
        # The actual requests directory owns the lock, even when two mailbox
        # roots (or their requests directories) are symlink aliases.
        self.requests = (self.root / 'requests').resolve(strict=True)
        self.replies = (self.root / 'replies').resolve(strict=True)
        self.lock = (self.requests / '.generally-loading.lock').open('a')
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except Exception:
            self.lock.close()
            raise
        self.journal_path = self.requests / '.generally-loading.journal'

    def close(self):
        self.lock.close()

    def save(self):
        atomic(self.journal_path, self.journal)

    def inventory(self, directory):
        names = set()
        for count, path in enumerate(directory.iterdir(), 1):
            if count > 8192:
                raise Refusal('mailbox inventory bound; no dispatch')
            if path.suffix == '.json':
                names.add(path.name)
        return names

    def begin(self, cursor):
        identity = {name: [path.stat().st_dev, path.stat().st_ino]
                    for name, path in (('requests', self.requests), ('replies', self.replies))}
        if self.journal_path.exists():
            self.journal = json.loads(self.journal_path.read_bytes()[:MAX_LINE + 1])
            if (self.journal.get('version') != 1 or self.journal.get('identity') != identity
                    or self.journal.get('status') != 'clean'):
                raise Refusal('uncertain/poisoned mailbox ownership; no replay or handoff')
            if self.journal.get('next') != cursor['next']:
                raise Refusal('clean handoff requires exact mailbox next ID')
            history = self.journal.get('history')
            if type(history) is not dict or len(history) > 4096:
                raise Refusal('invalid/bounded mailbox history')
            for name, entry in history.items():
                if (not name.endswith('.json') or not name[:-5].isdigit()
                        or name != f"{int(name[:-5]):04}.json" or type(entry) is not dict):
                    raise Refusal('invalid mailbox history entry')
                for directory, key in ((self.requests, 'request'), (self.replies, 'reply')):
                    path = directory / name
                    if hashlib.sha256(path.read_bytes()).hexdigest() != entry.get(key):
                        raise Refusal('acknowledged mailbox history changed; no handoff')
                self.consumed[self.replies / name] = entry['reply']
        else:
            # No inference from old files, ACKs or dead processes. Only a fresh,
            # empty transport may adopt an explicit initial cursor.
            if self.inventory(self.requests) or self.inventory(self.replies):
                raise Refusal('unjournaled mailbox history; no adoption or replay')
            self.journal = dict(version=1, identity=identity, status='clean',
                                next=cursor['next'], history={})
        expected = set(self.journal['history'])
        if self.inventory(self.requests) != expected or self.inventory(self.replies) != expected:
            raise Refusal('unexpected mailbox request/reply; no handoff')
        self.check()
        self.journal['status'] = 'active'
        self.save()  # active before any cursor mutation; death is never clean
        self.started = True

    def accepted(self, cursor):
        name = f"{cursor['last']['id']:04}.json"
        self.journal['history'][name] = dict(
            request=hashlib.sha256((self.requests / name).read_bytes()).hexdigest(),
            reply=self.consumed[self.replies / name])
        self.journal.update(status='active', next=cursor['next'])
        self.journal.pop('pending', None)
        self.save()  # still active until ALL semantic/frozen-zero checks pass

    def finish(self, cursor):
        self.check()
        if cursor.get('pending') is not False or cursor.get('failed'):
            raise Refusal('uncertain cursor cannot release mailbox')
        self.journal.update(status='clean', next=cursor['next'])
        self.save()

    def poison(self):
        if self.started:
            self.journal['status'] = 'poisoned'
            self.save()
''')
s=s.replace('        dest = self.root / \'requests\' / name\n        reply = self.root / \'replies\' / name\n','''        if not self.started or self.journal['status'] != 'active':
            raise Refusal('mailbox ownership not active')
        if request['id'] != self.journal['next'] or len(self.journal['history']) >= 4096:
            raise Refusal('mailbox next ID/history bound; no dispatch')
        dest = self.requests / name
        reply = self.replies / name
''')
s=s.replace('        atomic(dest, request)\n','''        self.journal.update(status='pending', pending=request)
        self.save()  # durable transport uncertainty BEFORE dispatch
        atomic(dest, request)
''',1)
s=s.replace('        self.events = []\n','''        self.events = []
        if isinstance(self.transport, Mailbox):
            self.transport.begin(self.cursor)
''',1)
s=s.replace('            self.events.append(dict(request=request, reply=reply))\n','''            if isinstance(self.transport, Mailbox):
                self.transport.accepted(self.cursor)
            self.events.append(dict(request=request, reply=reply))
''',1)
s=s.replace('    controller = None\n','    controller = None\n    channel = None\n',1)
s=s.replace('        controller = LoadingController(Mailbox(args.mailbox) if args.mailbox else Stdio(),\n','        channel = Mailbox(args.mailbox) if args.mailbox else Stdio()\n        controller = LoadingController(channel,\n',1)
s=s.replace('        atomic(args.receipt, dict(ok=True, **result))\n','        if isinstance(channel, Mailbox):\n            channel.finish(controller.cursor)\n        atomic(args.receipt, dict(ok=True, **result))\n',1)
s=s.replace('    except Exception as error:\n        atomic(args.receipt,','    except Exception as error:\n        if isinstance(channel, Mailbox):\n            channel.poison()\n        atomic(args.receipt,',1)
s=s.replace('    finally:\n        lock.close()\n','    finally:\n        if isinstance(channel, Mailbox):\n            channel.close()\n        lock.close()\n',1)
p.write_text(s)
