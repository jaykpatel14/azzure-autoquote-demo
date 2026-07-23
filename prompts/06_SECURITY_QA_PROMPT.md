# Phase 6 — Security and QA Prompt

Perform a release-readiness review.

Security:
- tenant isolation;
- authentication and authorization;
- CSRF;
- rate limiting;
- upload validation;
- private storage;
- secret handling;
- dependency audit;
- secure headers;
- Stripe webhook signature verification;
- SQL injection and XSS protection;
- audit logs;
- data retention and deletion;
- OpenAI data-control settings.

Testing:
- unit;
- integration;
- end-to-end;
- concurrency;
- billing webhooks;
- quota boundaries;
- tenant isolation;
- failed third-party services;
- database backup restoration;
- production smoke tests.

Deliver:
1. findings ranked Critical, High, Medium, Low;
2. fixes for Critical and High findings;
3. automated tests preventing regressions;
4. release checklist;
5. go/no-go recommendation supported by evidence.

Never mark the release ready while a known tenant-isolation, billing, secret-exposure, or unrestricted-upload issue remains.
