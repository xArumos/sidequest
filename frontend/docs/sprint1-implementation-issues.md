# Sprint 1 implementation issue tracker

Reviewed October 26, 2026 against current remote main and all available feature branches/PR discussions. These issues were created successfully on GitHub, not merely drafted. Existing model/search and session-middleware reports were checked first.

| Area | Sprint 1 PBIs | GitHub issue |
|---|---|---|
| Catalog | 11–16 | [[Sprint 1][PBI 11–16] Publish catalog, game-detail, and community ranking API contracts](https://github.com/xArumos/sidequest/issues/21) |
| Reviews | 5–10 | [[Sprint 1][PBI 5–10] Implement persistent rating/review operations and personal review history](https://github.com/xArumos/sidequest/issues/22) |
| Libraries | 17–22 | [[Sprint 1][PBI 17–22] Implement persistent wishlist and backlog APIs with agreed status transitions](https://github.com/xArumos/sidequest/issues/23) |
| Profiles | 3–4 | [[Sprint 1][PBI 3–4] Expose profile and played-game/rating-history data for profile pages](https://github.com/xArumos/sidequest/issues/24) |
| Privacy | 28–29 | [[Sprint 1][PBI 28–29] Implement public wishlist sharing and server-enforced visibility controls](https://github.com/xArumos/sidequest/issues/25) |
| Frontend | 3–22, 28–29 | [[Sprint 1][Frontend] Connect the remaining discovery, review, profile and library screens to real APIs](https://github.com/xArumos/sidequest/issues/26) |

Each issue includes the missing behavior, current frontend state, evidence, existing branch/PR work, acceptance criteria, impact and suggested owner. Dependencies link the related deliverables without assuming undocumented endpoints.

Existing prerequisite reports were reused rather than duplicated:

- [#16: Model review and search/query alignment](https://github.com/xArumos/sidequest/issues/16).
- [#17: Shared sessions and mutation Origin protection](https://github.com/xArumos/sidequest/issues/17).

Authentication is implemented or already tracked in PRs #7/#13/#18/#19/#20, so no duplicate missing-authentication issue was opened. The prior rating recalculation race has a fix on PR #10 at `68fc41c`; that old finding was not reopened. Unmerged work is distinguished from missing HTTP APIs. Steam, friendship and developer moderation were excluded from these Sprint 1 reports.

## Local Google option

The local checkout is on `feature/frontend-password-auth-integration`. Login and registration now show Continue with Google even without a local public client ID. The placeholder is disabled until real configuration is available, and no configuration banner is displayed. With a configured client, Google's official SDK button replaces it. No fake client ID or successful login is supplied.

Validation: all 98 frontend tests pass; 21 standard responsive Chrome checks and 9 Google-specific browser checks pass; lint/build pass. The new local-visibility case verifies the disabled visible button and absence of configuration banners at desktop, tablet and mobile sizes. Backend/database source and teammate-owned branches were not changed.
