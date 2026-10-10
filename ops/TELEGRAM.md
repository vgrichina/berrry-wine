# Telegram orchestrator bridge

Native Node.js; no npm dependencies. The bot runs separately from the agent so a terminal permission prompt does not stop Telegram polling.

- Token: ignored `scratch/telegram-token.txt`, mode 0600.
- Pairing, owner, update cursor and pending approval: `scratch/telegram/state.json`, mode 0600. Only the paired private Telegram account can chat or approve.
- Health: `scratch/telegram/health.json` and `watchdog.json`.
- Logs: `scratch/telegram/service.log`. Never print the token.

With the service stopped, run `node ops/telegram.js --pair`. Open `https://t.me/WineAssemblyBot?start=CODE` with the returned code within 30 minutes. The bot greets the account after pairing. Start the service with:

```sh
tmux new-session -d -s wine-telegram 'node ops/telegram-watchdog.js >> scratch/telegram/service.log 2>&1'
```

The dashboard must be running on port 8098 (`OPS_URL` can select another loopback port). The registered `orchestrator` in `ops/terminals.json` must refer to its current tmux pane and PID. Send `C-c` to the `wine-telegram` session to stop the service. A stale watchdog lock requires checking the PID before removing it; do not start two pollers.

Send plain text to leave a message in the agent inbox (below). `/status` shows tasks, `/screen` reads the terminal, `/approvals` refreshes a pending command approval, and `/help` explains controls. Only final answers to `[Telegram]` user turns and explicitly marked `[Telegram update]` milestones are forwarded from the registered Codex session. Routine commentary and autonomous goal summaries stay on the dashboard. Approval notifications remain immediate. Direct replies should be brief and conversational; milestones should report completion, failure, or a blocker needing the user. Code fences render as monospace, with no repeated sender heading. Replies use a persistent queue in `state.json`; delivery receipts and retry errors are recorded there. The queue resumes after restart. Quiet-mode upgrades discard old unsolicited queued updates and recover recent Telegram turn identities without replaying history.

**Inbox, not typing.** The bot never types into an agent pane. Every owner message (any length) is appended to `scratch/telegram/inbox.jsonl` (mode 0600) as one JSON line written with a single append, and the bot acks `Saved #N`:

```
{"id":N,"at":"<ISO time>","text":"<message or caption>","attachments":["/abs/path/scratch/telegram/inbox/<iso>-<msgid>-<name>"]}
```

Ids are consecutive integers derived from the file, so they survive restarts. Images, files, voice notes and other attachments are saved under `scratch/telegram/inbox/` (mode 0600, Bot API 20 MB limit) and only their paths are recorded; a message with an attachment is always inbox content even if its caption looks like a command. Commands (`/status`, `/blockers`, `/screen`, `/approvals`, `/help`) are answered by the bot and not saved. `/queue` shows the last id and each consumer's cursor; `/cancel` explains that saved messages cannot be withdrawn.

**Consumers** watch the file and keep their own cursor `scratch/telegram/inbox.<agent>.cursor` (a plain integer: the last id read). Claude agents run a Monitor or background `tail -n0 -F scratch/telegram/inbox.jsonl`; Codex checks the inbox past its cursor at every step of its goal loop (plus a background tail terminal). After reading, write the new last id to the cursor file, and reply with `node ops/telegram-send.js "<text>"`. Consumers are listed in `ops/work-watchdog.json` under `telegramInbox.consumers` (`agent` names the cursor; `agentId`, full or first UUID group, resolves the pane through `ops/terminals.json`).

**Fallback nudge.** The work watchdog (not the bot) compares the inbox with each consumer's cursor. When unread entries are older than `staleMs` (3 min) and the consumer's pane is at an empty prompt or shows Goal stalled / a usage limit, with no draft or prompt open, it sends one fixed line, `[Telegram inbox] N unread in scratch/telegram/inbox.jsonl - read past your cursor` (plus `/goal resume` for a stalled Codex goal), at most once per `cooldownMs` (15 min) per consumer. Message text is never pasted. Nudge state is in `scratch/work-watchdog/state.json` under `telegramInbox`; it honours the watchdog's `paused` control. Approval buttons still answer the registered `orchestrator` pane through `/api/approval-decision`, unchanged.

Approval buttons bind the private account, Telegram message, prompt fingerprint; buttons stay valid while that exact prompt is live. Identity includes the registered target and complete normalized approval prompt; unrelated background output does not create a new request. Clicking rechecks the current dashboard prompt, then the terminal endpoint rechecks the pane/PID and prompt. Choices are accept once, decline, and—only when present in the live menu—always allow the exact displayed rule. No automatic acceptance or policy bypass. Other kinds of prompts require inspecting the terminal. Approval attempts are consumed before sending, preventing automatic replay after ambiguous delivery. Old buttons are retired when a different prompt appears or the prompt closes. Clicking a stale button automatically retrieves the current request without applying the stale choice.

Approvals use a bold heading and monospace command/rule entities, preserving literal text without HTML interpretation. Copied terminal menu choices and keyboard instructions are omitted. `/screen` is monospace too. Long output is split with valid per-message entity offsets. Eligible pending approvals are reformatted in place; past chat history is not rewritten. Standalone leading “Orchestrator” labels are removed from new replies.

The watchdog restarts its own child after exit or 60 seconds without a heartbeat. Telegram requests time out after 15 seconds and dashboard requests after 8 seconds. This supervises the bridge, not the orchestrator or dashboard. It cannot run while the host is asleep or powered off. Incoming action cursors advance before delivery to prevent replay. Outgoing text is retried until confirmed: an ambiguous network failure can duplicate a reply, but never automatically repeat an approval action.

API reference: [Telegram Bot API](https://core.telegram.org/bots/api).
