#!/usr/bin/env python3
"""Read-only Quake II IBSP38 convex-brush swept player-box checker.

Coordinates are player ORIGINS, not feet. Standing mins/maxs are
(-16,-16,-24)/(16,16,32); duck max z is 4. Collision epsilon is 1/32.
No renderer, game process, guest state or configuration is accessed.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
from dataclasses import dataclass, asdict

PAK = 'test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/baseq2/pak0.pak'
PAK_SHA = 'cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09'
BSP_SHA = 'ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457'
EPSILON = 0.03125
PLAYER_MASK = 1 | 2 | 0x10000 | 0x2000000
HULLS = {'stand': ((-16, -16, -24), (16, 16, 32)),
         'crouch': ((-16, -16, -24), (16, 16, 4)),
         'point': ((0, 0, 0), (0, 0, 0))}


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def lerp(a, b, f):
    return tuple(x+(y-x)*f for x, y in zip(a, b))


@dataclass
class Brush:
    index: int
    planes: tuple
    contents: int
    model: int = 0
    entity: int = 0
    classname: str = 'worldspawn'
    bounds: tuple = None


@dataclass
class Trace:
    fraction: float = 1.0
    startsolid: bool = False
    allsolid: bool = False
    endpos: tuple = ()
    normal: tuple = ()
    brush: int = None
    model: int = None
    entity: int = None
    contents: int = 0


def clip_brush(brush, start, end, mins, maxs, epsilon=EPSILON):
    """CM_ClipBoxToBrush entering/leaving plane test; no time sampling.

    Each original side plane is expanded by the box support value. Bevel
    planes are retained. getout/startout and epsilon follow Q2 conventions.
    """
    if not brush.planes:
        return None
    enter, leave = -1.0, 1.0
    startout = getout = False
    normal = ()
    for n, dist in brush.planes:
        offset = tuple(maxs[i] if n[i] < 0 else mins[i] for i in range(3))
        expanded = dist - dot(offset, n)
        d1, d2 = dot(start, n)-expanded, dot(end, n)-expanded
        getout |= d2 > 0
        startout |= d1 > 0
        if d1 > 0 and d2 >= d1:
            return None
        if d1 <= 0 and d2 <= 0:
            continue
        if d1 > d2:
            f = (d1-epsilon)/(d1-d2)
            if f > enter:
                enter, normal = f, n
        else:
            leave = min(leave, (d1+epsilon)/(d1-d2))
    if not startout:
        # Original demo EXE 0x4123e1..0x41240d sets the two flags but
        # does NOT change fraction for a moving trace wholly inside a brush.
        # The separate stationary position test sets fraction=0 instead.
        return Trace(1.0, True, not getout)
    if enter < leave and enter > -1 and enter < 1:
        return Trace(max(enter, 0.0), normal=normal)
    return None


class Collision:
    def __init__(self, brushes):
        self.brushes = brushes

    def trace(self, start, end, hull='stand', mask=PLAYER_MASK, epsilon=EPSILON):
        mins, maxs = HULLS[hull] if isinstance(hull, str) else hull
        if len(start) != 3 or len(end) != 3 or any(not math.isfinite(v) for v in (*start, *end, *mins, *maxs)):
            raise ValueError('finite 3D coordinates required')
        if any(a > b for a, b in zip(mins, maxs)):
            raise ValueError('inverted hull')
        result = Trace()
        low = tuple(min(start[i], end[i])+mins[i]-epsilon for i in range(3))
        high = tuple(max(start[i], end[i])+maxs[i]+epsilon for i in range(3))
        for brush in self.brushes:
            if not brush.contents & mask:
                continue
            if brush.bounds and any(low[i] > brush.bounds[1][i] or high[i] < brush.bounds[0][i] for i in range(3)):
                continue
            tr = clip_brush(brush, start, end, mins, maxs, epsilon)
            if tr is None:
                continue
            if tuple(start) == tuple(end) and tr.allsolid:
                tr.fraction = 0.0
            result.startsolid |= tr.startsolid
            result.allsolid |= tr.allsolid
            if tr.fraction < result.fraction:
                result.fraction = tr.fraction
                result.normal = tr.normal
                result.brush, result.model, result.entity = brush.index, brush.model, brush.entity
                result.contents = brush.contents
        result.endpos = lerp(start, end, result.fraction)
        return result

    def clear(self, start, end, hull='stand'):
        tr = self.trace(start, end, hull)
        return tr.fraction == 1 and not tr.startsolid

    def cover_plane(self, y, xz_bounds, hull='stand', maxdepth=18):
        """Conservative obstruction certificate for an entire XZ rectangle.

        A cell is covered only if all four corners satisfy EVERY expanded
        plane of ONE convex brush. Convexity then proves every point in the
        cell blocked, independent of grid resolution or route direction.
        Unresolved cells are reported, never inferred blocked by sampling.
        """
        if maxdepth < 0 or maxdepth > 22:
            raise ValueError('maxdepth must be 0..22')
        x0,z0,x1,z1 = xz_bounds
        if x0 >= x1 or z0 >= z1:
            raise ValueError('positive rectangle required')
        mins,maxs = HULLS[hull]
        candidates = []
        for brush in self.brushes:
            if not brush.contents & PLAYER_MASK:
                continue
            if brush.bounds and (brush.bounds[0][1] > y+maxs[1] or brush.bounds[1][1] < y+mins[1]):
                continue
            # At fixed y, each expanded side becomes a*x+b*z <= c.
            planes = [(n[0],n[2],d-sum(n[i]*(maxs[i] if n[i]<0 else mins[i]) for i in range(3))-n[1]*y)
                      for n,d in brush.planes]
            candidates.append((brush,planes))
        covered, unresolved = [], []
        pending = [(tuple(xz_bounds),0,candidates)]
        while pending:
            bounds,depth,candidates = pending.pop()
            x0,z0,x1,z1 = bounds
            corners = ((x0,z0),(x0,z1),(x1,z0),(x1,z1))
            intersecting = []
            for brush,planes in candidates:
                # If even the minimum over this cell is outside one plane,
                # this brush cannot cover any part of the cell.
                if any(min(a*x+b*z for x,z in corners) > d for a,b,d in planes):
                    continue
                intersecting.append((brush,planes))
                if all(max(a*x+b*z for x,z in corners) <= d for a,b,d in planes):
                    covered.append({'bounds':bounds,'brush':brush.index,'model':brush.model,'entity':brush.entity})
                    break
            else:
                if depth == maxdepth or not intersecting:
                    unresolved.append(bounds)
                elif x1-x0 >= z1-z0:
                    mid=(x0+x1)/2
                    pending.extend([((x0,z0,mid,z1),depth+1,intersecting),((mid,z0,x1,z1),depth+1,intersecting)])
                else:
                    mid=(z0+z1)/2
                    pending.extend([((x0,z0,x1,mid),depth+1,intersecting),((x0,mid,x1,z1),depth+1,intersecting)])
        return {'y':y,'xz_bounds':xz_bounds,'hull':hull,'fully_blocked':not unresolved,
                'covered':covered,'unresolved':unresolved,'maxdepth':maxdepth}

    def step(self, start, end, hull='stand', height=18):
        """Geometric up/across/down clearance, not full PM_StepSlideMove.

        Straight route first; step fallback requires a clear lift and across,
        then a walkable landing (normal z >= .7). Never teleports through a lip.
        """
        if not math.isfinite(height) or not 0 < height <= 18:
            raise ValueError('step height must be positive and <= native 18-unit limit')
        direct = self.trace(start, end, hull)
        if direct.fraction == 1 and not direct.startsolid:
            return {'pass': True, 'kind': 'direct', 'traces': [asdict(direct)]}
        up_end = (start[0], start[1], start[2]+height)
        up = self.trace(start, up_end, hull)
        across_end = (end[0], end[1], start[2]+height)
        across = self.trace(up.endpos, across_end, hull)
        down = self.trace(across.endpos, (end[0], end[1], end[2]-height), hull)
        good = (not up.startsolid and up.fraction == 1 and not across.startsolid
                and across.fraction == 1 and not down.startsolid and down.fraction < 1
                and bool(down.normal) and down.normal[2] >= .7)
        return {'pass': good, 'kind': 'step', 'traces': [asdict(t) for t in (direct, up, across, down)]}

    def jump(self, start, velocity, hull='stand', gravity=800, dt=.0125, seconds=1.0):
        """Conservative continuous chord sweeps of a ballistic clearance probe.

        Vertical chord inflation g*dt^2/8 covers the exact parabola between
        times. This is clearance only, without PM acceleration/slide or damage.
        Initial Q2 normal jump vertical speed is 270, gravity default is 800.
        """
        if dt <= 0 or seconds <= 0 or dt > .1 or gravity <= 0:
            raise ValueError('positive gravity/time; dt <= .1 required')
        mins, maxs = HULLS[hull]
        n = math.ceil(seconds/dt)
        dt = seconds/n
        inflated = (mins, (maxs[0], maxs[1], maxs[2]+gravity*dt*dt/8))
        traces = []
        pos = tuple(start)
        for i in range(1, n+1):
            t = i*dt
            end = tuple(start[j]+velocity[j]*t-(gravity*t*t/2 if j == 2 else 0) for j in range(3))
            tr = self.trace(pos, end, inflated)
            traces.append(asdict(tr))
            if tr.fraction < 1 or tr.startsolid:
                return {'clear': False, 'time': (i-1+tr.fraction)*dt, 'traces': traces}
            pos = end
        return {'clear': True, 'time': seconds, 'traces': traces}


def records(data, fmt):
    size = struct.calcsize(fmt)
    if len(data) % size:
        raise ValueError('misaligned BSP lump')
    return list(struct.iter_unpack(fmt, data))


class BSP:
    def __init__(self, data):
        if len(data) < 160 or struct.unpack_from('<4si', data) != (b'IBSP', 38):
            raise ValueError('expected IBSP version 38')
        self.sha256 = hashlib.sha256(data).hexdigest()
        self.lumps = records(data[8:160], '<ii')
        for off, size in self.lumps:
            if off < 0 or size < 0 or off+size > len(data):
                raise ValueError('BSP lump outside file')
        def lump(i):
            off, size = self.lumps[i]
            return data[off:off+size]
        self.planes = [((x, y, z), d) for x, y, z, d, _ in records(lump(1), '<4fi')]
        self.nodes = records(lump(4), '<iii6hHH')
        self.leaves = records(lump(8), '<ihh6h4H')
        self.leafbrushes = [v[0] for v in records(lump(10), '<H')]
        self.rawbrushes = records(lump(14), '<iii')
        self.sides = records(lump(15), '<Hh')
        self.models = records(lump(13), '<9fiii')
        self.entities = []
        for block in re.findall(r'\{([^{}]*)\}', lump(0).decode('latin1')):
            self.entities.append(dict(re.findall(r'"([^"\n]*)"\s*"([^"\n]*)"', block)))
        self.model_brushes = []
        for model in self.models:
            pending, visited, brushes = [model[9]], set(), set()
            while pending:
                node = pending.pop()
                if node in visited:
                    continue
                visited.add(node)
                if node >= 0:
                    pending.extend(self.nodes[node][1:3])
                else:
                    leaf = self.leaves[-1-node]
                    first, count = leaf[-2:]
                    brushes.update(self.leafbrushes[first:first+count])
            self.model_brushes.append(sorted(brushes))

    def brushes(self, model, entity=0, classname='worldspawn', origin=(0, 0, 0)):
        out = []
        for index in self.model_brushes[model]:
            first, count, contents = self.rawbrushes[index]
            planes = tuple((self.planes[self.sides[i][0]][0],
                            self.planes[self.sides[i][0]][1]+dot(self.planes[self.sides[i][0]][0], origin))
                           for i in range(first, first+count))
            low, high = [-math.inf]*3, [math.inf]*3
            for n, dist in planes:
                for axis in range(3):
                    if n == tuple(1 if i == axis else 0 for i in range(3)):
                        high[axis] = min(high[axis], dist)
                    if n == tuple(-1 if i == axis else 0 for i in range(3)):
                        low[axis] = max(low[axis], -dist)
            out.append(Brush(index, planes, contents, model, entity, classname, (low, high)))
        return out

    def destroyed_models(self, state):
        """Validate an explicit assumption, never evidence of live destruction.

        Bind entity identities to these exact BSP bytes and unique inline
        models. Only initially solid, damageable func_explosive models may be
        removed; world/shared geometry and arbitrary exclusions are forbidden.
        """
        if not isinstance(state, dict) or set(state) != {'bsp_sha256', 'destroyed_breakables'}:
            raise ValueError('state requires only bsp_sha256 and destroyed_breakables')
        if state['bsp_sha256'] != self.sha256:
            raise ValueError('state BSP identity mismatch')
        entries = state['destroyed_breakables']
        if not isinstance(entries, list):
            raise ValueError('destroyed_breakables must be a list')
        removed, entities = set(), set()
        for entry in entries:
            if not isinstance(entry, dict) or set(entry) != {'entity', 'model', 'classname'}:
                raise ValueError('breakable identity requires entity/model/classname only')
            i, m = entry['entity'], entry['model']
            if type(i) is not int or type(m) is not int or not 0 < i < len(self.entities) or not 0 < m < len(self.models):
                raise ValueError('invalid entity/model index')
            e = self.entities[i]
            if e.get('model') != '*'+str(m) or entry['classname'] != 'func_explosive' or e.get('classname') != entry['classname']:
                raise ValueError('breakable entity/model/class identity mismatch')
            if i in entities or m in removed:
                raise ValueError('duplicate breakable identity')
            if int(e.get('spawnflags', '0')) & 1 or int(e.get('health', '0')) < 0 or e.get('targetname'):
                raise ValueError('not an initially solid damageable breakable')
            # Missing/zero health uses the native default; no claim it died.
            members = set(self.model_brushes[m])
            if not members or any(members & set(other) for j, other in enumerate(self.model_brushes) if j != m):
                raise ValueError('empty or shared model brush ownership')
            if sum(other.get('model') == e['model'] for other in self.entities) != 1:
                raise ValueError('ambiguous model entity ownership')
            if any(float(x) != 0 for x in e.get('angles', '0 0 0').split()):
                raise ValueError('rotated breakable unsupported')
            entities.add(i)
            removed.add(m)
        return removed

    def scene(self, policy='initial', state=None):
        """World + solid brush entities at authored positions.

        Triggers/areaportals excluded. Movers retained at authored position,
        explicitly no live-state claim. Unknown/rotated entity transforms fail
        closed rather than silently supplying a false clear trace.
        'world' is an explicit diagnostic exclusion, not a complete scene.
        """
        if policy not in ('initial', 'world'):
            raise ValueError('unknown scene policy')
        if state is not None and policy != 'initial':
            raise ValueError('explicit state requires full initial scene')
        removed = self.destroyed_models(state) if state is not None else set()
        brushes = self.brushes(0)
        inventory = []
        for index, e in enumerate(self.entities):
            if not e.get('model', '').startswith('*'):
                continue
            m, cls = int(e['model'][1:]), e.get('classname', '')
            flags = int(e.get('spawnflags', '0'))
            excluded = cls.startswith('trigger_') or cls == 'func_areaportal'
            if cls == 'func_wall' and flags & 1 and not flags & 4:
                excluded = True
            if cls == 'func_explosive' and flags & 1:
                excluded = True
            reason = 'nonblocking/initially disabled' if excluded else 'authored solid position; runtime state unknown'
            if m in removed:
                excluded = True
                reason = 'caller-supplied destroyed breakable assumption; live state NOT verified'
            inventory.append({'entity': index, 'model': m, 'class': cls,
                              'bounds': self.models[m][:6], 'included': not excluded and policy != 'world', 'reason': reason})
            if excluded or policy == 'world':
                continue
            if cls not in {'func_wall', 'func_explosive', 'func_door', 'func_button', 'func_train', 'func_rotating'}:
                raise ValueError('unsupported solid entity '+cls)
            if any(float(x) != 0 for x in e.get('angles', '0 0 0').split()):
                raise ValueError('rotated authored brush unsupported')
            # angle is a movement direction on doors/buttons, not brush rotation.
            origin = tuple(float(x) for x in e.get('origin', '0 0 0').split())
            brushes.extend(self.brushes(m, index, cls, origin))
        return Collision(brushes), inventory


def load_original(pak_path=PAK):
    path = Path(pak_path)
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
        size = f.tell()
        if h.hexdigest() != PAK_SHA or size != 49951322:
            raise ValueError('original PAK SHA/size mismatch')
        f.seek(0)
        magic, off, length = struct.unpack('<4sii', f.read(12))
        if magic != b'PACK' or off < 12 or length < 0 or off+length > size:
            raise ValueError('invalid PACK directory')
        f.seek(off)
        entries = records(f.read(length), '<56sii')
        entry = [r for r in entries if r[0].split(b'\0')[0] == b'maps/demo1.bsp']
        if len(entry) != 1:
            raise ValueError('expected unique demo1')
        _, bsp_off, bsp_size = entry[0]
        if (bsp_off, bsp_size) != (1264679, 1991772):
            raise ValueError('demo1 PAK range mismatch')
        f.seek(bsp_off)
        data = f.read(bsp_size)
    if hashlib.sha256(data).hexdigest() != BSP_SHA:
        raise ValueError('original BSP hash mismatch')
    return BSP(data), {'pak_path': str(path), 'pak_sha256': h.hexdigest(), 'pak_size': size,
                       'entry': 'maps/demo1.bsp', 'offset': bsp_off, 'size': bsp_size, 'sha256': BSP_SHA}


def vec(s):
    v = tuple(float(x) for x in s.split(','))
    if len(v) != 3:
        raise argparse.ArgumentTypeError('x,y,z required')
    return v


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--pak', default=PAK)
    ap.add_argument('--policy', choices=('initial', 'world'), default='initial')
    ap.add_argument('--hull', choices=HULLS, default='stand')
    ap.add_argument('--state', help='JSON BSP-pinned destroyed_breakables assumption; never reads live state')
    sub = ap.add_subparsers(dest='command', required=True)
    sub.add_parser('info')
    for name in ('trace', 'step'):
        p = sub.add_parser(name)
        p.add_argument('start', type=vec)
        p.add_argument('end', type=vec)
    p = sub.add_parser('jump')
    p.add_argument('start', type=vec)
    p.add_argument('velocity', type=vec)
    p.add_argument('--seconds', type=float, default=.675)
    p = sub.add_parser('path')
    p.add_argument('json_path', help='JSON list of player-origin waypoints; continuous straight segments')
    p = sub.add_parser('cover-plane')
    p.add_argument('y',type=float)
    p.add_argument('bounds',help='x0,z0,x1,z1 origin rectangle')
    args = ap.parse_args()
    bsp, identity = load_original(args.pak)
    state = json.loads(Path(args.state).read_text()) if args.state else None
    if args.state:
        bsp.destroyed_models(state)  # Explicit JSON null is not an omitted state.
    scene, inventory = bsp.scene(args.policy, state)
    out = {'identity': identity, 'policy': args.policy, 'hull': args.hull,
           'state': state, 'state_scope': 'caller assumption; live state NOT verified' if state is not None else 'authored initial; live state unknown'}
    if args.command == 'info':
        out.update(entities=len(bsp.entities), models=inventory, brushes=len(scene.brushes))
    elif args.command == 'trace':
        out['trace'] = asdict(scene.trace(args.start, args.end, args.hull))
    elif args.command == 'step':
        out['step'] = scene.step(args.start, args.end, args.hull)
    elif args.command == 'jump':
        out['jump'] = scene.jump(args.start, args.velocity, args.hull, seconds=args.seconds)
    elif args.command == 'cover-plane':
        bounds=tuple(float(x) for x in args.bounds.split(','))
        out['certificate']=scene.cover_plane(args.y,bounds,args.hull)
    else:
        points = json.loads(Path(args.json_path).read_text())
        if not isinstance(points, list) or len(points) < 2:
            raise ValueError('at least two origin waypoints required')
        traces = [asdict(scene.trace(a, b, args.hull)) for a, b in zip(points, points[1:])]
        out.update(traces=traces, clear=all(t['fraction'] == 1 and not t['startsolid'] for t in traces))
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
