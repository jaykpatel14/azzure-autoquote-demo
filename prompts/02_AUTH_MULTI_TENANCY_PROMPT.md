# Phase 2 — Authentication and Multi-Tenancy Prompt

Implement production-grade authentication and tenant authorization.

Requirements:
1. Use Auth.js with secure session cookies.
2. Support email/password initially; structure code so magic-link or SSO can be added later.
3. Add sign-up, sign-in, sign-out, forgot-password, reset-password, and email-verification flows.
4. On onboarding, create a company and OWNER membership transactionally.
5. Add OWNER, ADMIN, ESTIMATOR, and VIEWER authorization.
6. Remove `DEFAULT_COMPANY_ID`.
7. Derive company context from the authenticated membership.
8. Add a company switcher for users belonging to multiple companies.
9. Enforce `companyId` in every server query, action, and route.
10. Add tests proving one company cannot read or modify another company's data.
11. Add an audit log for security-sensitive actions.

Do not proceed if any route trusts a browser-supplied company ID without verifying membership.
