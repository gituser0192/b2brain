# Stylesheet ownership

Global styles are imported only by the root App Router layout in this order:

1. `foundations/tokens.css`
2. `foundations/reset.css`
3. `foundations/typography.css`
4. `layouts/auth.css`
5. `layouts/dashboard-shell.css`
6. `../globals.css`
7. `features/finance.css`
8. `features/projects.css`
9. `features/crm.css`
10. Existing feature stylesheets

`globals.css` temporarily retains feature-specific and interdependent responsive rules until their owning roadmap phase. Shared component styles should live beside the shared component or in a clearly named shared stylesheet. Feature styles belong with their feature rather than returning to `globals.css`; page-specific rules belong with the owning page or feature.

Preserve stylesheet import order when moving rules because the cascade is part of the current UI contract. Verify changes with the full Playwright journey and visual-regression suite at all approved viewports. Screenshot baselines must never be updated merely to make a failing test pass; every intended visual change requires explicit visual review first.
