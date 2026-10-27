from common import *
v=json.loads((H/'owned-cleanup.stdout').read_text());assert v['ownedSurvivors']==[] and v['supervisorCleanupComplete']
save('owned-process-cleanup.json',v)
p=H/'report.py';t=p.read_text().replace("'owned-cleanup.json'","'owned-process-cleanup.json'").replace("if p.is_file():payloads.append", "if p.is_file() and p.name!='payloads.json':payloads.append")
p.write_text(t)
p=H/'finalize.py';t=p.read_text().replace("H/'owned-cleanup.json'","H/'owned-process-cleanup.json'").replace("'guest='owned-cleanup.json'","'guest='owned-process-cleanup.json'").replace("guest='owned-cleanup.json'","guest='owned-process-cleanup.json'")
p.write_text(t)
save('cleanup-receipt-namespace-incident.json',dict(cause='semantic receipt used same basename as outer supervisor operation; wrapper overwrote semantic JSON after child exit',originalSemanticPreserved='owned-cleanup.stdout',originalWrapperPreserved='owned-cleanup.json',correctedSemantic='owned-process-cleanup.json',guestReplayed=False,remoteAccessRepeated=False,repair='recover original exact stdout JSON, give semantic receipt a distinct name; exclude payload manifest itself on report refresh'))
print('original cleanup stdout recovered; no guest/API replay; receipt namespace separated')
