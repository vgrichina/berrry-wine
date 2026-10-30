(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BlockerModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function dependencies(snapshot, task) {
    return (snapshot.tasks || []).filter(other => hasId(other) && other !== task && other.id !== task.id && other.status === 'blocked' &&
      ((task.dependencies || []).includes(other.id) || (task.waitingOn || '').split(/[^a-zA-Z0-9_.-]+/).includes(other.id)));
  }

  function kind(snapshot, task) {
    if (dependencies(snapshot, task).length) return ['Dependency', 'neutral', 'View dependency'];
    if (/automated.*review|review.*resolution/i.test(task.waitingOn + ' ' + task.blocker)) return ['Review blocked', 'warn', 'Message owner'];
    if (/host|capacity|CPU|GPU/i.test(task.waitingOn + ' ' + task.needs)) return ['Capacity needed', 'warn', 'Provide capacity'];
    return ['Needs follow-up', 'warn', 'Message owner'];
  }

  function order(snapshot, tasks) {
    return [...tasks].sort((a, b) => Number(kind(snapshot, a)[0] === 'Review blocked') -
      Number(kind(snapshot, b)[0] === 'Review blocked') || a.line - b.line);
  }

  function primaryRoots(snapshot, tasks) {
    const roots = tasks.filter(task => !dependencies(snapshot, task).length);
    // Preserve the dashboard fallback for an all-cycle selection.
    return order(snapshot, roots.length ? roots : tasks);
  }

  // Who can unblock a task, from recorded fields only: [actor, basis].
  // 'user' = needs the user's input or resources; 'agent' = an agent or the
  // coordinator can resolve it. A task that records nothing is the owner's to
  // clarify, which is agent work, and the basis says so.
  function actor(snapshot, task) {
    const waiting = String(task.waitingOn || '').trim();
    if (dependencies(snapshot, task).length) return ['agent', 'Waits on another blocked task'];
    const category = kind(snapshot, task)[0];
    if (/\bno (?:user|human) (?:decision|input|action)\b/i.test(waiting)) return ['agent', 'Waiting on: ' + waiting];
    if (/\b(?:user|human|you|maintainer|dashboard-user|approval)\b/i.test(waiting)) return ['user', 'Waiting on: ' + waiting];
    if (category === 'Review blocked') return ['user', 'Automated review stopped validation; agents must not retry it, so a person decides'];
    if (category === 'Capacity needed') return ['user', 'Capacity needed (host, CPU or GPU): ' + (task.needs || waiting || 'not described')];
    if (waiting) return ['agent', 'Waiting on: ' + waiting];
    return ['agent', 'No waitingOn recorded; the owner must state what is needed'];
  }

  function split(snapshot, tasks) {
    const user = [], agent = [];
    for (const task of tasks) (actor(snapshot, task)[0] === 'user' ? user : agent).push(task);
    return { user, agent };
  }

  const hasId = task => task.id != null && String(task.id).trim() !== '';
  // Identity is exact: do not trim IDs, merge anonymous rows, or select a
  // preferred record. These counts describe evidence, not scheduling eligibility.
  function countSummary(snapshot) {
    const rows = (snapshot.tasks || []).filter(task => task.status === 'blocked');
    const ids = new Set(rows.filter(hasId).map(task => task.id));
    const anonymousBlockedRows = rows.filter(task => !hasId(task)).length;
    return {
      distinctBlockedTaskIds: ids.size,
      rawBlockedRows: rows.length,
      duplicateBlockedRows: rows.length - anonymousBlockedRows - ids.size,
      anonymousBlockedRows,
    };
  }

  function countSummaryText(counts) {
    return `${counts.distinctBlockedTaskIds} distinct blocked task IDs · ${counts.rawBlockedRows} blocked rows · ${counts.duplicateBlockedRows} duplicate-ID blocked rows · ${counts.anonymousBlockedRows} anonymous blocked rows (counted separately)`;
  }

  // Include nonblocked records sharing a blocked ID: status disagreement must
  // remain visible. Fields compared here affect identity, ownership or unblocking.
  const evidenceFields = ['status', 'title', 'blocker', 'waitingOn', 'needs', 'next', 'owner', 'dependencies'];
  function repeatedIds(snapshot) {
    const groups = new Map();
    for (const task of snapshot.tasks || []) {
      if (!hasId(task)) continue;
      if (!groups.has(task.id)) groups.set(task.id, []);
      groups.get(task.id).push(task);
    }
    return [...groups].filter(([, rows]) => rows.length > 1 && rows.some(t => t.status === 'blocked'))
      .map(([id, rows]) => ({id, rows, conflictingFields: evidenceFields.filter(field =>
        new Set(rows.map(row => JSON.stringify(row[field] ?? null))).size > 1)}));
  }

  function repeatedIdNotes(groups) {
    return groups.map(({id, rows, conflictingFields}) => {
      const label = conflictingFields.length ? `AMBIGUOUS (${conflictingFields.join(', ')})` : 'repeated records';
      const evidence = rows.map((row, index) => `Record ${index + 1}${row.line == null ? '' : ' / line ' + row.line}: ` +
        evidenceFields.map(field => `${field}: ${JSON.stringify(row[field] ?? null)}`).join('; '));
      return [`ID ${id}: ${rows.length} records — ${label}. All records retained; reconcile with owner before acting.`, ...evidence].join('\n');
    });
  }

  function blockerSummary(snapshot) {
    const blocked = order(snapshot, (snapshot.tasks || []).filter(task => task.status === 'blocked'));
    const roots = primaryRoots(snapshot, blocked);
    const approvals = (snapshot.approvals?.items || []).filter(item => !item.sent);
    const { user, agent } = split(snapshot, roots);
    return { blocked, roots, dependentCount: blocked.length - roots.length, approvals, needsUser: user, agentResolvable: agent,
      counts: countSummary(snapshot), repeatedIds: repeatedIds(snapshot) };
  }

  return { actor, blockerSummary, countSummary, countSummaryText, repeatedIds, repeatedIdNotes, dependencies, kind, order, primaryRoots, split };
});
