# API Conventions

## Source of truth

- OpenAPI generated from NestJS code is the canonical API contract.
- Markdown explains behavior and policy; it does not override the generated contract.

## Coverage rules

- Every endpoint must have a tag, summary, and success response.
- Every auth-protected route must declare security.
- Every error-producing route must document standard errors.
- Every non-trivial DTO field should include a description or example.
- Every paginated or filterable route should document query semantics and examples.

## Contract policy

- Target OpenAPI 3.1 where the active toolchain remains smooth in this repo.
- Keep operation IDs stable.
- Prefer bounded-context tags: `auth`, `viewer`, `discovery`, `media`, `health`.
- Use shared error envelopes instead of ad hoc error payloads.
- The Nest Swagger CLI plugin is an optional later optimization, not a starting requirement.
- Start with one generated specification for the server, and split into multiple specs only if public and internal visibility genuinely diverge later.

## Viewer policy

- Scalar is the primary API reference viewer.
- Swagger UI is the internal debugging viewer.
- Both viewers must use the same generated OpenAPI document.
