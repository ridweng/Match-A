# Auth Documentation

This section documents authentication behavior that complements the generated API contract.

## Flows to maintain

- Sign up
- Sign in
- Session refresh
- Sign out
- Email verification
- Verification resend
- Password reset request and confirm
- Expired-session recovery

## Contract requirements

- All auth responses and failures should be represented in OpenAPI.
- Security schemes must be declared once and reused.
- Protected routes must explicitly declare bearer auth.

