"""Diagnostic candidate, never an enforcement or acceptance input.

Linux wait4 CPU includes children waited by the reaped process. Summing only
supervisor-direct/adopted reaps avoids sampled-ancestor duplication. However,
SIGCHLD=SIG_IGN / SA_NOCLDWAIT below the supervisor can discard descendant
usage before adoption. Neither sampling nor supervisor RUSAGE_CHILDREN proves
that absent usage exists. No supported enforcement of descendant wait discipline
is available in this task. Accordingly the finalized unique metric is UNKNOWN,
even when the observed reap subtotal passes every consistency check.
"""
import os
import resource
import signal


def seconds(who):
    r = resource.getrusage(who)
    return r.ru_utime + r.ru_stime


def validate(events, children_delta, missing=()):
    """Cross-check the receipt, not completeness of descendants' wait discipline."""
    import math
    problems = list(missing)
    identities = set()
    total = 0.0
    for event in events:
        identity = tuple(event['identity'])
        if len(identity) != 2 or identity[1] == 'reaped':
            problems.append('unverified reap identity')
        if identity in identities:
            problems.append('duplicate reap identity')
        identities.add(identity)
        values = (event['userSeconds'], event['systemSeconds'])
        if any(not math.isfinite(v) or v < 0 for v in values):
            problems.append('invalid reap usage')
        total += sum(values)
    # Both derive from the same kernel microsecond rusage, not /proc ticks.
    if not math.isfinite(children_delta) or abs(total - children_delta) > 0.00001:
        problems.append('reap sum differs from RUSAGE_CHILDREN delta')
    return total, problems


class Evidence:
    def __init__(self, existing, bootstrap):
        self.self_start = seconds(resource.RUSAGE_SELF)
        self.children_start = seconds(resource.RUSAGE_CHILDREN)
        self.events = []
        self.problems = []
        self.bootstrap = bootstrap
        if existing:
            self.problems.append('preexisting direct children: ownership is not exclusive')
        if signal.getsignal(signal.SIGCHLD) != signal.SIG_DFL:
            self.problems.append('supervisor SIGCHLD disposition is not default')

    def missing(self, identity, reason):
        self.problems.append({'identity': list(identity), 'reason': reason})

    def reap(self, identity, user, system):
        self.events.append(dict(identity=list(identity), userSeconds=user, systemSeconds=system))

    def finish(self, cleanup):
        own = seconds(resource.RUSAGE_SELF) - self.self_start
        children = seconds(resource.RUSAGE_CHILDREN) - self.children_start
        total, problems = validate(self.events, children, self.problems)
        if not cleanup:
            problems.append('cleanup incomplete')
        # Non-reaping check: a live direct child gives None; no children gives
        # ECHILD. No unknown child is consumed to make a receipt appear complete.
        try:
            os.waitid(os.P_ALL, 0, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        except ChildProcessError:
            pass
        except OSError as error:
            problems.append('terminal child census unavailable: ' + str(error))
        else:
            problems.append('direct children remain at finalization')
        if self.bootstrap:
            problems.append('bootstrap lifetime own-only CPU not finalized or independently bounded')
        return dict(status='incomplete', uniqueCPUSeconds=None, diagnosticOnly=True,
                    authoritativeMetric='cpuSeconds', authoritativeDefaultLimitSeconds=90,
                    observedReapCPUSeconds=total, supervisorOwnIntervalSeconds=own,
                    observedIntervalSubtotalSeconds=total + own,
                    reapConsistency='reject' if problems else 'consistent-but-not-complete',
                    consistencyProblems=problems, reapEvents=self.events,
                    childrenRusageDeltaSeconds=children,
                    completenessBlocker='Descendant auto-reaping/SA_NOCLDWAIT can discard CPU usage; exclusive ownership and complete wait propagation cannot be established for arbitrary commands from proc samples and wait4.',
                    assumptionsRequired=['single exclusive reaper, no concurrent unrelated children or waits',
                                         'every descendant is waited with usage propagation or adopted and reaped here',
                                         'no auto-reaping, external reaper or ownership escape',
                                         'complete cleanup and identity-pinned reaps',
                                         'separately finalized supervisor/bootstrap own-only lifetime overhead'],
                    scope='Observed disjoint direct/adopted reaps plus supervisor own-only interval; not a complete unique subtree total or an alternate pass criterion.')
