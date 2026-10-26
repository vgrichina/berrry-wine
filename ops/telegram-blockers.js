'use strict';
const {blockerSummary,countSummaryText,repeatedIdNotes,dependencies,kind,actor}=require('./blocker-model');
const short=(value,max=400)=>{
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>max?text.slice(0,max-1)+'…':text;
};
function blockersText(snapshot){
  const {blocked,roots,dependentCount,approvals,needsUser,agentResolvable,counts,repeatedIds}=blockerSummary(snapshot);
  const lines=[countSummaryText(counts),`${approvals.length} live approvals · ${roots.length} primary blocker rows · ${dependentCount} dependent rows`,`${needsUser.length} need your input · ${agentResolvable.length} agent-resolvable (row classifications; not current eligibility)`];
  if(repeatedIds.length)lines.push('', 'REPEATED TASK IDS / RECORDED AMBIGUITY', ...repeatedIdNotes(repeatedIds));
  if(approvals.length){
    lines.push('', 'Your action:');
    for(const p of approvals)lines.push('• '+short(p.reason||'Command approval needed')+(p.label?' — '+short(p.label,120):''));
    lines.push('Use /approvals to review the current orchestrator command.');
  }
  if(!blocked.length)lines.push('', 'No blocked tasks recorded.');
  for(const task of [...needsUser,...agentResolvable]){
    if(task===needsUser[0])lines.push('','NEEDS YOUR INPUT');
    if(task===agentResolvable[0])lines.push('','AGENT-RESOLVABLE');
    const deps=dependencies(snapshot,task),category=kind(snapshot,task)[0];
    const next=deps.length?'Waiting for '+deps.map(d=>d.title).join('; '):category==='Capacity needed'?(task.waitingOn||task.needs):task.needs||task.next||'Owner needs to record a concrete next step.';
    const owner=snapshot.terminals?.find(t=>t.agentId===task.owner)?.label||task.owner||'Unassigned';
    lines.push('', `${short(task.title,180)}${task.id?' ['+short(task.id,100)+']':''}`, category, 'Next: '+short(next), 'Reason: '+short(task.blocker||'Reason not recorded.'), 'Owner: '+short(owner,180),'Who: '+short(actor(snapshot,task)[1],200));
    if(category==='Review blocked')lines.push('Automated review stopped validation. No dashboard override.');
    if(task.replies?.length)lines.push('Reply posted; awaiting owner verification.');
    const children=blocked.filter(t=>dependencies(snapshot,t).some(d=>d.id===task.id));
    if(children.length)lines.push('Also holds up: '+children.map(t=>short(t.title,120)+(t.id?' ['+short(t.id,100)+']':'')).join('; '));
  }
  return lines.join('\n');
}
module.exports={blockersText};
