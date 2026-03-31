# Error Format

The server should expose machine-readable error codes in a consistent envelope.

## Standard shape

```json
{
  "error": "INVALID_SIGN_IN_PAYLOAD",
  "message": "Optional human-readable detail",
  "issues": {}
}
```

## Rules

- `error` is required and stable.
- `message` is optional and human-readable.
- `issues` is present for validation failures when field-level detail is available.
- Routes should document expected auth, validation, conflict, and internal errors.

