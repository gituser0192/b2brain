# Stylesheet ownership

Global styles are imported only by the root App Router layout in this order:

1. `foundations/tokens.css`
2. `foundations/reset.css`
3. `foundations/typography.css`
4. `layouts/auth.css`
5. `layouts/dashboard-shell.css`
6. `../globals.css`
7. `features/dashboard.css`
8. `features/automation.css`
9. `features/finance.css`
10. `features/projects.css`
11. `features/crm.css`
12. `customer-enquiry-agent.css`
13. `features/workspace-agent.css`
14. `knowledge-management.css`
15. `dashboard-mobile.css`

`globals.css` temporarily retains feature-specific and interdependent responsive rules until their owning roadmap phase. Shared component styles should live beside the shared component or in a clearly named shared stylesheet. Feature styles belong with their feature rather than returning to `globals.css`; page-specific rules belong with the owning page or feature.

Preserve stylesheet import order when moving rules because the cascade is part of the current UI contract. Verify changes with the full Playwright journey and visual-regression suite at all approved viewports. Screenshot baselines must never be updated merely to make a failing test pass; every intended visual change requires explicit visual review first.

`features/workspace-agent.css` owns only the authenticated internal Business Operating Agent workspace and floating drawer. External Customer Enquiry Agent and Automation styles remain in their existing feature stylesheets.

## Current ownership

- `foundations/tokens.css`: existing design custom properties.
- `foundations/reset.css`: reset and box-model normalization.
- `foundations/typography.css`: base document typography.
- `layouts/auth.css`: authentication and onboarding layouts.
- `layouts/dashboard-shell.css`: authenticated shell, sidebar, and main scrolling foundations.
- `features/dashboard.css`: customer dashboard command centre, metrics, priorities, trends, health state, and responsive feature layout.
- `features/crm.css`: CRM customers, details, engagement, and follow-ups.
- `features/projects.css`: projects, members, and tasks.
- `features/finance.css`: finance ledger, invoices, collections, and payment UI.
- `features/automation.css`: Automation workspace, connectors, policies, schedules, and run UI.
- `features/workspace-agent.css`: authenticated internal Business Operating Agent and floating drawer.
- `customer-enquiry-agent.css`: external Customer Enquiry Agent inbox and conversation experience.
- `knowledge-management.css`: approved business knowledge management.
- `dashboard-mobile.css`: intentional final mobile overrides for the dashboard and shared shell.
- `globals.css`: shared application UI and feature styles not yet assigned to an extracted MVP stylesheet.

New feature-specific rules belong in the owning feature stylesheet. Shared primitives may remain global until a separately reviewed shared-component phase. Do not move uncertain selectors or update visual baselines without reviewing the rendered pixel diff.
