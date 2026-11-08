#!/usr/bin/env python3
"""Offline swept-hull regression tests, analytical oracle, exact demo1 checks."""
import importlib.util
import itertools
import math
from pathlib import Path
import random
import sys
import unittest

spec = importlib.util.spec_from_file_location('quake2_bsp_route', Path(__file__).with_name('quake2-bsp-route.py'))
q = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = q
spec.loader.exec_module(q)


def box(low, high, index=0, contents=1):
    planes = []
    for i in range(3):
        axis = tuple(int(j == i) for j in range(3))
        planes.extend([(axis, high[i]), (tuple(-x for x in axis), -low[i])])
    return q.Brush(index, tuple(planes), contents, bounds=(low, high))


def interval_oracle(brush, a, b, hull):
    """Independent linear-inequality interval solver, no trace implementation.

    Enumerate all eight translated box corners for each plane. Intersection
    of the resulting time half-lines is the swept Minkowski brush interval.
    This oracle uses zero epsilon; fixed epsilon has separate numeric tests.
    """
    corners = list(itertools.product(*zip(*hull)))
    lo, hi = -math.inf, math.inf
    inside_a = inside_b = True
    for n, d in brush.planes:
        # minimum box dot is the overlap support, independently enumerated.
        support = min(sum(n[i]*v[i] for i in range(3)) for v in corners)
        f0 = sum(n[i]*a[i] for i in range(3))+support-d
        f1 = sum(n[i]*b[i] for i in range(3))+support-d
        inside_a &= f0 <= 0
        inside_b &= f1 <= 0
        slope = f1-f0
        if slope == 0:
            if f0 > 0:
                return None
        elif slope > 0:
            hi = min(hi, -f0/slope)
        else:
            lo = max(lo, -f0/slope)
    if inside_a:
        return (1, True, inside_b)
    if max(lo, 0) < min(hi, 1):
        return (max(lo, 0), False, False)
    return None


class Synthetic(unittest.TestCase):
    def test_continuous_thin_wall_endpoints_free(self):
        c = q.Collision([box((50,-100,-100), (50.125,100,100))])
        self.assertTrue(c.clear((0,0,0), (0,0,0)))
        self.assertTrue(c.clear((100,0,0), (100,0,0)))
        tr = c.trace((0,0,0), (100,0,0))
        self.assertAlmostEqual(tr.fraction, (50-16-q.EPSILON)/100)
        self.assertEqual(tr.normal, (-1,0,0))

    def test_startsolid_escape_and_allsolid(self):
        c = q.Collision([box((-10,-10,-10), (10,10,10))])
        a = c.trace((0,0,0), (100,0,0), 'point')
        self.assertTrue(a.startsolid)
        self.assertFalse(a.allsolid)
        self.assertEqual(a.fraction, 1)
        b = c.trace((0,0,0), (1,0,0), 'point')
        self.assertTrue(b.allsolid)
        self.assertEqual(b.fraction, 1)  # original moving-trace convention
        self.assertEqual(c.trace((0,0,0),(0,0,0),'point').fraction,0)
        self.assertFalse(c.clear((0,0,0), (100,0,0), 'point'))

    def test_grazing_and_hull_width(self):
        c = q.Collision([box((32,20,-100), (64,40,100))])
        self.assertTrue(c.clear((16-.001,0,0), (16-.001,60,0)))
        self.assertFalse(c.clear((16,0,0), (16,60,0)))
        narrow = ((-15,-15,-24), (15,15,32))
        self.assertTrue(c.clear((16,0,0), (16,60,0), narrow))

    def test_crouched_clearance(self):
        c = q.Collision([box((-100,-100,48), (100,100,80))])
        self.assertFalse(c.clear((0,0,24.125), (40,0,24.125)))
        self.assertTrue(c.clear((0,0,24.125), (40,0,24.125), 'crouch'))

    def test_mask_playerclip_window_trigger(self):
        for contents, blocked in [(1,True),(2,True),(0x10000,True),(0x2000000,True),(0x40000000,False),(0x20,False)]:
            with self.subTest(contents=contents):
                c = q.Collision([box((30,-100,-100), (31,100,100), contents=contents)])
                self.assertEqual(not c.clear((0,0,0), (100,0,0)), blocked)

    def test_step_height_headroom_and_landing(self):
        floor = box((-1000,-1000,-64), (1000,1000,0))
        for height, expected in [(16,True),(20,False)]:
            c = q.Collision([floor,box((32,-100,0),(100,100,height),1)])
            self.assertEqual(c.step((0,0,24.125),(64,0,24.125))['pass'], expected)
        c = q.Collision([floor,box((32,-100,0),(100,100,16),1),box((-100,-100,64),(100,100,80),2)])
        self.assertFalse(c.step((0,0,24.125),(64,0,24.125))['pass'])

    def test_jump_ceiling_wall_and_ballistic_envelope(self):
        self.assertTrue(q.Collision([]).jump((0,0,24.125),(100,0,270), seconds=.5)['clear'])
        ceiling = q.Collision([box((-1000,-1000,80),(1000,1000,100))])
        self.assertFalse(ceiling.jump((0,0,24.125),(100,0,270),seconds=.5)['clear'])
        wall = q.Collision([box((30,-100,-100),(31,100,200))])
        self.assertFalse(wall.jump((0,0,24.125),(100,0,270),seconds=.5)['clear'])
        # The exact apex is .3375s, between .3/.4 chords. Inflation must catch it.
        apex = 24.125+270**2/1600+32
        c = q.Collision([box((-100,-100,apex-.01),(100,100,apex+2))])
        self.assertFalse(c.jump((0,0,24.125),(0,0,270),dt=.1,seconds=.6)['clear'])

    def test_cover_plane_requires_convex_coverage_not_samples(self):
        c = q.Collision([box((-100,10,-100),(100,11,100))])
        self.assertTrue(c.cover_plane(10,(-20,-20,20,20))['fully_blocked'])
        # A real one-unit gap between two obstacles is never certified blocked.
        c = q.Collision([box((-100,10,-100),(-16.5,11,100)),
                         box((16.5,10,-100),(100,11,100))])
        proof = c.cover_plane(10,(-20,-20,20,20),maxdepth=8)
        self.assertFalse(proof['fully_blocked'])
        self.assertTrue(proof['unresolved'])

    def test_invalid_inputs(self):
        c = q.Collision([])
        with self.assertRaises(ValueError): c.trace((0,0,float('nan')),(0,0,0))
        with self.assertRaises(ValueError): c.trace((0,0,0),(0,0,0),((1,0,0),(0,0,0)))
        with self.assertRaises(ValueError): c.jump((0,0,0),(0,0,270),dt=0)
        with self.assertRaises(ValueError): q.BSP(b'bad')
        self.assertTrue(q.Collision([q.Brush(0,(),1)]).clear((0,0,0),(0,0,0)))


class Original(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bsp, cls.identity = q.load_original()
        cls.scene, cls.inventory = cls.bsp.scene()
        cls.world, _ = cls.bsp.scene('world')
        cls.state = {'bsp_sha256': q.BSP_SHA, 'destroyed_breakables': [
            {'entity': 328, 'model': 20, 'classname': 'func_explosive'}]}
        cls.opened, cls.open_inventory = cls.bsp.scene(state=cls.state)

    def test_explicit_state_removes_only_validated_window(self):
        before = {b.index for b in self.scene.brushes}
        after = {b.index for b in self.opened.brushes}
        self.assertEqual(before-after, set(range(1678,1685)))
        self.assertEqual(len(self.opened.brushes),1714)
        self.assertTrue(set(self.bsp.model_brushes[0]) <= after)
        entry = next(e for e in self.open_inventory if e['entity']==328)
        self.assertFalse(entry['included'])
        self.assertIn('live state NOT verified',entry['reason'])
        self.assertEqual(self.bsp.scene(state={'bsp_sha256':q.BSP_SHA,'destroyed_breakables':[]})[0].brushes,self.scene.brushes)
        self.assertTrue(next(e for e in self.bsp.scene()[1] if e['entity']==328)['included'])

    def test_state_fail_closed_identity_and_schema(self):
        import copy
        invalid = [None, [], {}, dict(self.state, bsp_sha256='wrong'),
                   dict(self.state, delete_brushes=[239]), dict(self.state,destroyed_breakables={})]
        for key, value in [('entity',0),('entity',329),('entity',True),('entity',328.0),
                           ('model',0),('model',19),('model',-1),('model',35),('model',True),
                           ('classname','func_wall'),('arbitrary_geometry',[239])]:
            state=copy.deepcopy(self.state);state['destroyed_breakables'][0][key]=value;invalid.append(state)
        state=copy.deepcopy(self.state);state['destroyed_breakables']*=2;invalid.append(state)
        # None means omitted only at scene API; explicit JSON null is tested by CLI below.
        for state in invalid:
            with self.subTest(state=state), self.assertRaises(ValueError): self.bsp.destroyed_models(state)
        with self.assertRaises(ValueError):self.bsp.scene('world',self.state)

    def test_state_rejects_shared_model_and_nondamageable_entity(self):
        import copy
        for mutation in ['shared','owner','class','disabled','targetname','rotation','empty']:
            b=copy.deepcopy(self.bsp)
            if mutation=='shared':b.model_brushes[0].append(1678)
            elif mutation=='owner':b.entities.append(dict(b.entities[328]))
            elif mutation=='class':b.entities[328]['classname']='func_door'
            elif mutation=='disabled':b.entities[328]['spawnflags']='1'
            elif mutation=='targetname':b.entities[328]['targetname']='activate'
            elif mutation=='rotation':b.entities[328]['angles']='0 90 0'
            else:b.model_brushes[20]=[]
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):b.scene(state=self.state)

    def test_destroyed_window_approach_step_and_continuation(self):
        for hull in ['stand','crouch']:
            self.assertTrue(self.opened.clear((128,-320,24.125),(96,-320,24.125),hull))
            self.assertTrue(self.opened.clear((96,-320,24.125),(96,96,24.125),hull))
            result=self.opened.step((96,96,24.125),(96,160,24.125),hull)
            self.assertTrue(result['pass']);self.assertEqual(result['kind'],'step')
            direct,up,across,down=result['traces']
            self.assertEqual(direct['brush'],239)
            self.assertEqual(up['endpos'],(96,96,42.125))
            self.assertEqual(across['endpos'],(96,160,42.125))
            self.assertEqual(down['endpos'],(96,160,40.03125))
            self.assertEqual(down['normal'],(0,0,1))
            self.assertTrue(self.opened.clear(down['endpos'],(96,192,40.03125),hull))
            self.assertFalse(self.scene.step((96,96,24.125),(96,160,24.125),hull)['pass'])
            self.assertFalse(self.opened.step((96,96,24.125),(96,160,24.125),hull,height=15)['pass'])
            for height in [0,-1,19,float('nan')]:
                with self.assertRaises(ValueError):self.opened.step((96,96,24.125),(96,160,24.125),hull,height)

    def test_destroyed_window_world_edges_and_lintel(self):
        for hull,top in [('stand',80),('crouch',108)]:
            for x,z,brush in [(-48,40.125,240),(112,40.125,1603),(96,40,239),(96,top,1586)]:
                tr=self.opened.trace((x,96,z),(x,192,z),hull)
                self.assertEqual((tr.entity,tr.brush),(0,brush))
                self.assertEqual(tr.endpos[1],111.96875)
            for x,z in [(-47.875,40.125),(111.875,40.125),(96,top-.125)]:
                self.assertTrue(self.opened.clear((x,96,z),(x,192,z),hull))
            for x in [-48,112]:
                self.assertFalse(self.opened.step((x,96,24.125),(x,160,24.125),hull)['pass'])
        self.assertFalse(self.opened.clear((96,96,80),(96,192,80),'stand'))
        self.assertTrue(self.opened.clear((96,96,80),(96,192,80),'crouch'))

    def test_original_projectile_destruction_static_pins(self):
        import hashlib
        import struct
        d=(Path(q.PAK).parent/'gamex86.dll').read_bytes()
        self.assertEqual(hashlib.sha256(d).hexdigest(),'11fd73be2887a6c567517dbbf74c2f5040c3636e4863befd1ade9f4537e52d60')
        def code(va,n):return d[va-0x20001000+0x400:va-0x20001000+0x400+n]
        self.assertEqual(d[0x40bc4:0x40bd3],b'func_explosive\0')
        self.assertEqual(struct.unpack_from('<II',d,0x401e0),(0x200431c4,0x2000c410))
        # Original field descriptors bind authored health/dmg to edict offsets.
        self.assertEqual(struct.unpack_from('<II',d,0x3f918),(0x2003f0f8,0x1e0))
        self.assertEqual(struct.unpack_from('<II',d,0x3f948),(0x200423ac,0x204))
        self.assertEqual(code(0x2000c4f6,10),bytes.fromhex('c7 86 c8 01 00 00 c0 c0 00 20'))
        self.assertEqual(code(0x20016fef,5),bytes.fromhex('e8 9c d5 fe ff'))
        self.assertEqual(code(0x2000490c,2),bytes.fromhex('2b cf'))
        self.assertEqual(code(0x200042d8,6),bytes.fromhex('ff 97 c8 01 00 00'))
        self.assertEqual(code(0x2000c396,5),bytes.fromhex('e8 65 a0 00 00'))
        self.assertEqual(code(0x20016406,6),bytes.fromhex('ff 15 cc 22 06 20'))

    def test_cli_state_clearance_and_refused_inputs(self):
        import json
        import subprocess
        import tempfile
        with tempfile.TemporaryDirectory(prefix='q2-state-') as td:
            p=Path(td)/'state.json'
            p.write_text(json.dumps(self.state))
            cmd=[sys.executable,'-B',str(Path(q.__file__)),'--state',str(p)]
            out=json.loads(subprocess.check_output(cmd+['step','96,96,24.125','96,160,24.125']))
            self.assertTrue(out['step']['pass'])
            self.assertEqual(out['state'],self.state)
            self.assertIn('live state NOT verified',out['state_scope'])
            for bad in [None,dict(self.state,bsp_sha256='wrong'),dict(self.state,brushes=[239])]:
                p.write_text(json.dumps(bad))
                result=subprocess.run(cmd+['trace','96,96,40.125','96,192,40.125'],capture_output=True)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(result.stdout,b'')

    def test_identity_and_model_ownership(self):
        self.assertEqual(self.identity['sha256'], q.BSP_SHA)
        self.assertEqual(len(self.bsp.rawbrushes),1758)
        self.assertEqual(len(self.bsp.models),35)
        self.assertEqual(set(self.bsp.model_brushes[20]),set(range(1678,1685)))
        self.assertFalse(set(self.bsp.model_brushes[0]) & set(self.bsp.model_brushes[20]))
        self.assertFalse(next(i for i in self.inventory if i['entity']==346)['included'])
        self.assertTrue(next(i for i in self.inventory if i['entity']==328)['included'])
        self.assertEqual(self.bsp.entities[328], {'model':'*20','target':'t78','dmg':'0',
                         'health':'10','mass':'800','classname':'func_explosive'})

    def test_original_binary_algorithm_crosscheck_pins(self):
        # Static inspection only: never execute/launch this original game.
        import hashlib
        import struct
        p = Path(q.PAK).parent.parent / 'quake2.exe'
        data = p.read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(),
                         '2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b')
        def code(va,n): return data[va-0x401000+0x400:va-0x401000+0x400+n]
        self.assertEqual(struct.unpack_from('<d',data,0x40c00)[0],q.EPSILON)
        self.assertEqual(struct.unpack_from('<d',data,0x40c08)[0],-q.EPSILON)
        self.assertEqual(code(0x41237b,6),bytes.fromhex('dc 25 00 26 44 00'))  # enter d1-eps
        self.assertEqual(code(0x4123a2,6),bytes.fromhex('dc 25 08 26 44 00'))  # leave d1+eps
        self.assertEqual(code(0x4123f3,7),bytes.fromhex('c7 40 04 01 00 00 00'))  # startsolid
        self.assertEqual(code(0x412400,6),bytes.fromhex('c7 00 01 00 00 00'))  # allsolid, no fraction write
        self.assertEqual(code(0x4125a6,7),bytes.fromhex('c7 40 08 00 00 00 00'))  # position-test fraction=0

    def test_known_floor_free_and_solid(self):
        self.assertTrue(self.scene.clear((128,-320,24.125),(112,-320,24.125)))
        self.assertTrue(self.scene.clear((112,-320,24.125),(112,96,24.125)))
        self.assertTrue(self.scene.trace((112,-320,0),(112,-320,0)).allsolid)
        tr = self.scene.trace((112,-320,24.125),(112,-320,0))
        self.assertAlmostEqual(tr.endpos[2],24.03125)
        self.assertEqual(tr.normal,(0,0,1))

    def test_old_aperture_width_graze(self):
        a,b = (112,96,40.125),(112,192,40.125)
        tr = self.world.trace(a,b)
        self.assertEqual(tr.brush,1603)
        self.assertAlmostEqual(tr.endpos[1],111.96875)
        narrow = ((-15,-15,-24),(15,15,32))
        self.assertTrue(self.world.clear(a,b,narrow))
        self.assertTrue(self.world.clear((111.9,96,40.125),(111.9,192,40.125)))

    def test_omitted_window_blocks_both_hulls(self):
        a,b = (96,96,40.125),(96,192,40.125)
        self.assertTrue(self.world.clear(a,b))
        for hull, brush in [('stand',1679),('crouch',1681)]:
            tr = self.scene.trace(a,b,hull)
            self.assertEqual((tr.entity,tr.model,tr.brush),(328,20,brush))
            self.assertEqual(tr.contents & 2,2)
            self.assertAlmostEqual(tr.endpos[1],119.96875)
            self.assertFalse(self.scene.step((96,96,24.125),(96,160,24.125),hull)['pass'])

    def test_sill_step_positive_only_when_window_excluded(self):
        a,b = (96,96,24.125),(96,160,24.125)
        self.assertEqual(self.world.trace(a,b).brush,239)
        self.assertTrue(self.world.step(a,b)['pass'])
        self.assertFalse(self.scene.step(a,b)['pass'])
        # Original candidate tangent remains blocked even in world-only scene.
        self.assertFalse(self.world.step((112,96,24.125),(112,160,24.125))['pass'])

    def test_original_jump_clearance_blocked_by_entity_not_sill(self):
        for hull in ['stand','crouch']:
            blocked=self.scene.jump((96,96,24.125),(0,200,270),hull,seconds=.6)
            self.assertFalse(blocked['clear'])
            self.assertEqual(blocked['traces'][-1]['entity'],328)
            self.assertAlmostEqual(blocked['time'],.11984375)
            self.assertTrue(self.world.jump((96,96,24.125),(0,200,270),hull,seconds=.6)['clear'])

    def test_continuous_whole_aperture_obstruction_certificate(self):
        for hull,zmax in [('stand',80),('crouch',108)]:
            proof = self.scene.cover_plane(140,(-48,40,112,zmax),hull)
            self.assertTrue(proof['fully_blocked'])
            self.assertFalse(proof['unresolved'])
            # Independently verify every emitted rectangle, its area and
            # disjoint interiors, using eight-corner support enumeration.
            area = 0
            brushes = {b.index:b for b in self.scene.brushes}
            for j,cell in enumerate(proof['covered']):
                x0,z0,x1,z1=cell['bounds']
                area += (x1-x0)*(z1-z0)
                self.assertTrue(-48<=x0<x1<=112 and 40<=z0<z1<=zmax)
                brush=brushes[cell['brush']]
                for x,z in itertools.product((x0,x1),(z0,z1)):
                    ref=interval_oracle(brush,(x,140,z),(x,140,z),q.HULLS[hull])
                    self.assertIsNotNone(ref)
                    self.assertTrue(ref[1] and ref[2])
                for other in proof['covered'][:j]:
                    a,b,c,d=other['bounds']
                    self.assertFalse(max(x0,a)<min(x1,c) and max(z0,b)<min(z1,d))
            self.assertEqual(area,160*(zmax-40))
            self.assertFalse(self.world.cover_plane(140,(-48,40,112,zmax),hull,maxdepth=8)['fully_blocked'])

    def test_independent_interval_oracle_2000_brush_traces(self):
        rng = random.Random(2125)  # test-only generation; no game seed access
        for k in range(2000):
            brush = rng.choice(self.scene.brushes)
            low,high = brush.bounds
            if not all(math.isfinite(x) for x in (*low,*high)):
                continue
            a = tuple(rng.uniform(low[i]-50,high[i]+50) for i in range(3))
            b = tuple(rng.uniform(low[i]-50,high[i]+50) for i in range(3))
            hull = q.HULLS[rng.choice(['point','stand','crouch'])]
            ref = interval_oracle(brush,a,b,hull)
            got = q.clip_brush(brush,a,b,*hull,epsilon=0)
            with self.subTest(k=k,brush=brush.index):
                self.assertEqual(ref is None,got is None)
                if ref is not None:
                    self.assertAlmostEqual(ref[0],got.fraction,places=9)
                    self.assertEqual(ref[1:],(got.startsolid,got.allsolid))


if __name__ == '__main__':
    unittest.main(verbosity=2)
