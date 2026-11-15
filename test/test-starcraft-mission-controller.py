"""Synthetic policy assertions only; no StarCraft world inspection."""
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location('mission', ROOT/'tools/starcraft-mission-controller.py')
a = importlib.util.module_from_spec(s)
s.loader.exec_module(a)


class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1300))
        a.c.save('native-pid.json', dict(pid=123, startToken='fixture'))
        a.c.save('mission-admitted.json', dict(scene='fixture'))
        self.clock = patch.object(a.time, 'time', return_value=500)
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.tmp.cleanup()

    def scene(self, name='fresh', at=499, **fields):
        png = a.c.R/(name+'.png')
        png.write_bytes(b'fixture only')
        digest = hashlib.sha256(png.read_bytes()).hexdigest()
        a.c.save(name+'.json', dict(at=at, pngSHA256=digest, target=a.c.read('native-pid.json'), snapshot=dict(mainHwnd='0x1', eip='0x2')))
        r = dict(at=at, pngSHA256=digest, submittedScene=True, observation='synthetic full scene', mode='command',
            sceneType='mission', unobstructedMission=True, completeWorldReview='fixture complete world', visibleObjectives='fixture objective',
            pauseState='not-observed', visibleTarget='fixture command', selectedUnitsEvidence='fixture SCV HUD',
            nativeCommandSemantics='fixture Gather', commandKind='gather', selectedWorkerEvidence='fixture SCV selected',
            selectedBuildingEvidence='fixture Command Center selected', visibleTrainUnit='fixture train SCV', resourcesBefore='fixture minerals 250',
            selectionIntent='fixture selection', navigationIntent='fixture camera',
            activeCommandEvidence='fixture Select Target', visibleResourceTarget='fixture minerals', commandIntent='chosen',
            pixelGeometry=dict(source='current-full-scene', target=a.c.read('native-pid.json'), chosenCenter=[200,200]))
        r.update(fields)
        a.c.save(name+'-review.json', r)

    def order(self, mode='command', kind='gather', at=498, scene='before'):
        evidence={}
        if (a.c.R/(scene+'.json')).exists():
            evidence=dict(pngSHA256=a.c.read(scene+'.json')['pngSHA256'],review=a.c.read(scene+'-review.json'))
        a.c.save('chosen-mission-order.json', dict(mode=mode, commandKind=kind, at=at, scene=scene, target=a.c.read('native-pid.json'),**evidence))

    def check(self, mode='command', route=None):
        return a.policy(['mousedown:200:200'], 'fresh', mode, route)

    def test_gather_command(self):
        self.scene(); self.check()

    def test_training_selected_building_and_cost(self):
        for missing in ('selectedBuildingEvidence', 'visibleTrainUnit', 'resourcesBefore'):
            with self.subTest(missing=missing):
                self.scene(missing, commandKind='train', **{missing:''})
                with self.assertRaises(AssertionError): a.policy(['mousedown:200:200'],missing,'command')

    def test_worker_required(self):
        self.scene(selectedWorkerEvidence='')
        with self.assertRaises(AssertionError): self.check()

    def test_target_separate_consumed_command(self):
        self.scene(mode='target')
        with self.assertRaises(FileNotFoundError): self.check('target')
        self.order(); self.check('target')

    def test_wrong_command_kind_cannot_target(self):
        self.scene(mode='target'); self.order(kind='move')
        with self.assertRaises(AssertionError): self.check('target')

    def test_current_target_required(self):
        self.scene(mode='target', visibleResourceTarget=''); self.order()
        with self.assertRaises(AssertionError): self.check('target')

    def test_attack_requires_armed_hud_and_visible_command(self):
        self.scene(commandKind='attack')
        with self.assertRaises(AssertionError):self.check()
        self.scene('armed',commandKind='attack',armedUnitHUD='fixture weapon',visibleAttackCommand='fixture Attack')
        a.policy(['mousedown:200:200'],'armed','command')

    def test_attack_target_requires_current_enemy_and_consumed_command(self):
        self.scene(mode='target',commandKind='attack',armedUnitHUD='fixture weapon',visibleAttackCommand='fixture Attack')
        self.order(kind='attack')
        with self.assertRaises(AssertionError):self.check('target')
        self.scene('enemy',mode='target',commandKind='attack',armedUnitHUD='fixture weapon',
            visibleAttackCommand='fixture Attack',visibleEnemy='fixture red Marine')
        a.policy(['mousedown:200:200'],'enemy','target')

    def test_command_superseded(self):
        self.scene(mode='target'); self.order()
        a.c.save('later-mission-order.json', dict(at=498.5))
        with self.assertRaisesRegex(AssertionError,'superseded'): self.check('target')

    def test_whole_current_world_and_objectives(self):
        for missing in ('completeWorldReview', 'visibleObjectives', 'selectedUnitsEvidence', 'nativeCommandSemantics'):
            self.scene(missing, **{missing:''})
            with self.assertRaises(AssertionError): a.policy(['mousedown:200:200'], missing, 'command')

    def test_no_assumed_native_pause(self):
        self.scene(pauseState='observed-native-pause')
        with self.assertRaisesRegex(AssertionError,'visible evidence'): self.check()
        self.scene('paused', pauseState='observed-native-pause', nativePauseEvidence='fixture native Paused label')
        a.policy(['mousedown:200:200'], 'paused','command')

    def test_no_frozen_clock_pause(self):
        self.scene(pauseState='frozen-clock')
        with self.assertRaises(AssertionError): self.check()

    def test_five_second_freshness(self):
        self.scene(at=495)
        with self.assertRaisesRegex(AssertionError,'expired'): self.check()

    def test_menu_thirty_seconds(self):
        self.scene(at=475, mode='menu',nativeMenuPurpose='dismiss-tip'); self.check('menu')
        with patch.object(a.time,'time',return_value=505):
            with self.assertRaises(AssertionError): self.check('menu')

    def test_exact_click_no_queue(self):
        self.scene()
        for keys in (['rmousedown:200:200'], ['keydown:19'], ['mousedown:201:200'], ['mousedown:200:200']*2):
            with self.assertRaises(AssertionError): a.policy(keys,'fresh','command')

    def test_no_mission_selection_or_cheat_command(self):
        self.scene(commandKind='console')
        with self.assertRaises(AssertionError): self.check()

    def test_truthful_bootstrap_only(self):
        self.scene(nativeTitleOrMenu=True)
        with patch.object(a.c,'bind') as bound:
            with self.assertRaises(AssertionError): a.bind('fresh')
            bound.assert_not_called()

    def test_mission_admission_requires_world(self):
        (a.c.R/'mission-admitted.json').unlink()
        self.scene(completeWorldReview='')
        with patch.object(a.c,'lease'):
            with self.assertRaises(AssertionError): a.admit_mission('fresh')

    def test_irreversible_quit(self):
        self.scene(mode='quit', quitRoute='open-menu', visibleQuitTarget=True)
        self.check('quit','open-menu')
        self.scene('next')
        with self.assertRaisesRegex(AssertionError,'irreversible'): a.policy(['mousedown:200:200'],'next','command')

    def test_final_reserve(self):
        self.scene(at=1121)
        with patch.object(a.time,'time',return_value=1122):
            with self.assertRaises(AssertionError): self.check()
        self.assertTrue(a.c.read('quit-phase.json')['irreversible'])

    def test_no_midpress_capture_or_too_short_pulse(self):
        with patch.object(a.c,'pulse') as sent:
            for ms in (0,40,79,1500,1501):
                with self.assertRaises(AssertionError): a.pulse('x',['mousedown:200:200'],ms,'fresh','fixture','command')
            sent.assert_not_called()

    def test_immediate_before_down_deadline(self):
        self.scene(); commands=[]
        def send(*args, **kwargs):
            a.c.call(dict(action='guarded-input',guard=dict(deadline=999999,owner='fixture',epoch=1,nonce='fresh')))
        def reply(command,timeout=10):
            commands.append(command)
            return command['guard']
        with patch.object(a.c,'pulse',send), patch.object(a.c,'call',reply):
            a.pulse('x',['mousedown:200:200'],400,'fresh','fixture','command')
        self.assertEqual(commands[0]['guard']['deadline'],504000)

    def result_fixture(self, kind='production', **fields):
        self.scene('before', at=490, commandKind='train')
        self.order(kind='train', at=491)
        metadata = dict(resultKind=kind, visibleResultEvidence='fixture new SCV', attributionEvidence='fixture queue then unit',
            persistentResultEvidence='fixture unit remains', confoundingChangesReviewed=True,
            producedUnitIdentity='fixture SCV selected 60/60', resourcesBeforeAfter='fixture 250 to 200')
        metadata.update(fields)
        self.scene('after', at=497, **metadata)
        with patch.object(a.c,'lease'), patch.object(a.time,'time',return_value=498): a.attest_result('after')
        self.scene('persistent', at=499, **metadata)

    def result(self):
        with patch.object(a.c,'lease'): a.record_result('result','before','after','persistent','chosen')

    def test_persistent_production_not_mission_completion(self):
        self.result_fixture(); self.result()
        r=a.c.read('result-mission-result.json')
        self.assertTrue(r['proven']); self.assertFalse(r['missionCompletionClaim'])

    def test_ack_or_animation_not_proof(self):
        self.result_fixture(persistentResultEvidence='')
        with self.assertRaises(AssertionError): self.result()

    def test_no_time_score_attribution(self):
        with self.assertRaises(AssertionError): self.result_fixture(attributionEvidence='')

    def test_gather_needs_delivery_and_resources(self):
        self.result_fixture(kind='gathering')
        with self.assertRaises(AssertionError): self.result()

    def test_objective_needs_native_objective_evidence(self):
        self.result_fixture(kind='objective-progress')
        with self.assertRaisesRegex(AssertionError,'incidental'): self.result()

    def combat_fixture(self, **changes):
        self.result_fixture(kind='enemy-consequence')
        for name in ('before','after','persistent'):
            r=a.c.read(name+'-review.json')
            r.update(visibleEnemy='fixture red enemy before target', enemyConsequence='destruction',
                enemyBeforeAfterEvidence='fixture enemy then remains and absence',
                sameSelectedUnitEvidence='fixture same selected Marine',nativeCounterOrHPEvidence='fixture Kills 0 to 1',
                otherShootersReviewed=True,otherUnitsFiring=False)
            r.update(changes)
            if name == 'before':r.update(mode='target',commandKind='attack')
            (a.c.R/(name+'-review.json')).write_text(json.dumps(r))
        (a.c.R/'chosen-mission-order.json').unlink()
        self.order(mode='target',kind='attack',at=491)
        (a.c.R/'after-result-observation.json').unlink()
        with patch.object(a.c,'lease'),patch.object(a.time,'time',return_value=498):a.attest_result('after')

    def test_enemy_consequence_is_separate_from_objective_and_win(self):
        self.combat_fixture();self.result()
        r=a.c.read('result-mission-result.json')
        self.assertTrue(r['proven'])
        self.assertFalse(r['objectiveProgressClaim']);self.assertFalse(r['missionCompletionClaim'])

    def test_enemy_result_requires_consumed_attack_target(self):
        self.combat_fixture();(a.c.R/'chosen-mission-order.json').unlink()
        self.order(mode='command',kind='attack',at=491)
        with self.assertRaisesRegex(AssertionError,'attack target'):self.result()

    def test_enemy_result_rejects_ambiguous_shooters(self):
        self.combat_fixture(otherUnitsFiring=True)
        with self.assertRaisesRegex(AssertionError,'ambiguous'):self.result()

    def test_enemy_result_requires_visible_native_consequence(self):
        self.combat_fixture(nativeCounterOrHPEvidence='')
        with self.assertRaisesRegex(AssertionError,'native consequence'):self.result()

    def test_enemy_result_ack_or_animation_alone_refused(self):
        self.combat_fixture(enemyConsequence='animation')
        with self.assertRaisesRegex(AssertionError,'not damage'):self.result()

    def test_enemy_result_same_consequence_persists(self):
        self.combat_fixture()
        r=a.c.read('persistent-review.json');r['enemyConsequence']='damage'
        (a.c.R/'persistent-review.json').write_text(json.dumps(r))
        with self.assertRaisesRegex(AssertionError,'must persist'):self.result()

    def test_before_image_hash_checked(self):
        self.result_fixture(); (a.c.R/'before.png').write_bytes(b'changed')
        with self.assertRaises(AssertionError): self.result()

    def test_result_requires_current_persistent_scene(self):
        self.result_fixture()
        with patch.object(a.time,'time',return_value=505):
            with self.assertRaises(AssertionError): self.result()

    def test_completion_separate_native_screen(self):
        self.scene()
        with patch.object(a.c,'lease'):
            with self.assertRaises(AssertionError): a.completion('win','fresh')

    def test_consumed_foreign_ack_is_terminal(self):
        self.scene()
        def send(*args, **kwargs):
            a.c.call(dict(action='guarded-input',guard=dict(owner='actual',epoch=1,nonce='fresh',deadline=999999)))
        with patch.object(a.c,'pulse',send),patch.object(a.c,'call',return_value=dict(owner='foreign',epoch=1,nonce='fresh')):
            with self.assertRaisesRegex(AssertionError,'ACK identity'):a.pulse('x',['mousedown:200:200'],400,'fresh','fixture','command')

    def test_changed_window_cannot_review(self):
        self.scene()
        rr=a.c.read('fresh.json');rr['target']['startToken']='replaced'
        (a.c.R/'fresh.json').write_text(json.dumps(rr))
        with self.assertRaisesRegex(AssertionError,'identity'):self.check()

    def test_changed_review_image_cannot_input(self):
        self.scene();(a.c.R/'fresh.png').write_bytes(b'replaced')
        with self.assertRaises(AssertionError):self.check()

    def test_train_cannot_target_world(self):
        self.scene(mode='target',commandKind='train')
        with self.assertRaisesRegex(AssertionError,'no world target'):self.check('target')

    def test_result_before_is_actual_order_scene(self):
        self.result_fixture()
        order=a.c.read('chosen-mission-order.json');order['scene']='different'
        (a.c.R/'chosen-mission-order.json').write_text(json.dumps(order))
        with self.assertRaisesRegex(AssertionError,'before is actual'):self.result()

    def test_result_confounds_required(self):
        self.result_fixture(confoundingChangesReviewed=False)
        with self.assertRaises(AssertionError):self.result()

    def test_produced_unit_identity_required(self):
        self.result_fixture(producedUnitIdentity='')
        with self.assertRaises(AssertionError):self.result()

    def test_result_no_ack_inferred_resource_change(self):
        self.result_fixture(resourcesBeforeAfter='')
        with self.assertRaises(AssertionError):self.result()

    def test_after_review_attestation_is_not_recreated(self):
        self.result_fixture();(a.c.R/'after-result-observation.json').unlink()
        with self.assertRaises(FileNotFoundError):self.result()

    def test_old_after_review_valid_only_with_fresh_persistence(self):
        self.result_fixture()
        # The first result was personally attested fresh. A later independently
        # reviewed scene supplies persistence; no expired scene drives input.
        self.scene('later',at=520,resultKind='production',visibleResultEvidence='fixture remains',
            attributionEvidence='fixture known queue',persistentResultEvidence='fixture selected unit',
            confoundingChangesReviewed=True,producedUnitIdentity='fixture SCV',resourcesBeforeAfter='fixture 250 to 200')
        with patch.object(a.time,'time',return_value=521),patch.object(a.c,'lease'):
            a.record_result('later-result','before','after','later','chosen')
        self.assertTrue(a.c.read('later-result-mission-result.json')['proven'])

    def test_result_different_native_identity(self):
        self.result_fixture()
        order=a.c.read('chosen-mission-order.json');order['target']['startToken']='replaced'
        (a.c.R/'chosen-mission-order.json').write_text(json.dumps(order))
        with self.assertRaises(AssertionError):self.result()

    def test_final_confirmation_needs_separate_native_review(self):
        self.scene(mode='quit',quitRoute='confirm-quit',visibleQuitTarget=True)
        with self.assertRaisesRegex(AssertionError,'confirmation'):self.check('quit','confirm-quit')


if __name__ == '__main__': unittest.main(verbosity=2)
