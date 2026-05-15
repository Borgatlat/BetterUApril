## Retention & Notification Roadmap (Implemented + Next)

This file mirrors the plan’s phased roadmap, but written as an implementation checklist for this codebase.

### Phase 1 (Done in code now): Foundations

- **State machine**: `utils/userStateMachine.js`
  - Computes raw context (streak, engagement, recency, monthly totals)
  - Classifies users into `onTrack | atRisk | offTrack_recent | offTrack_long | returning`
- **Template selector**: `utils/notificationTemplateSelector.js`
  - Picks supportive copy based on state (and uses lifetime/monthly reframes after streak breaks)
- **Daily reminders upgraded**: `utils/notificationHelpers.js`
  - `createMotivationAwareDailyReminderNotification` now uses the state machine + template selector
  - Stores analytics metadata in the notification JSON payload:
    - `notification_state`
    - `notification_template_id`
    - `channel`

### Phase 2 (Next): Personalization controls

- **User settings (UI)**:
  - Notification intensity: light / normal / high
  - Quiet hours window (start/end)
  - Channel preferences: push vs email summary
- **Behavior learning**:
  - Store user’s “best time window” based on open/completion history
  - Use it to schedule reminders 30–60 minutes before typical completion time

### Phase 3 (Next): Retention features beyond notifications

- **Progress / wins panel**:
  - Show “you showed up X times this month” and “lifetime sessions”
  - Default to this view when user is `offTrack_*`
- **Habit resizing loop**:
  - If a user misses repeatedly, automatically offer an easier version
  - Expose “easy mode” CTA directly from notifications
- **Accountability boosters**:
  - Weekly summary to partner/group
  - Small group mini-challenges (2–7 day challenges)

### Phase 4 (Next): Experiments

- **A/B tests**:
  - Short vs long messages per state
  - “identity-based” vs “tiny-step” framing
  - Different caps (2/day vs 3/day) for low priority notifications
- **Success metrics**:
  - D7 / D30 retention lift by state/template
  - “notification opened → completed within 24h”

