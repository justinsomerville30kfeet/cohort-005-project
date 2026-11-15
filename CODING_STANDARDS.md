# Coding standards

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

The one returned shape is a form error the person can fix — a Note that is
too long, an empty Comment. That comes back as `{ ok: false, error }` for the
form to show beside its field.

## Re-check access in every action intent

Each intent in an action calls the access check it needs —
`requireContentAccess`, `requireStaff` — itself. A loader guard protects the
page, not the action: a request can post to the action without ever loading
the page.

## Put domain rules in a service module with its test

A rule about the domain (who may do what, what a value may hold, what a
change leaves behind) lives in `app/lib/<topic>.server.ts`, with
`<topic>.server.test.ts` beside it. Routes parse input, check access and call
the service.

A service module follows the shape the existing ones share:

- every function takes the database first and the rest positionally, so a
  test hands in an in-memory database;
- each module declares its own `type Db = BetterSQLite3Database<typeof
  schema>`;
- user-correctable failures return `{ ok: false, error }`.

This shape is the convention, not duplication — leave it as it is.

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Do not read `formData.get("x") as string`. The cast
is a lie the type checker believes.

## Do not write `any`, and do not write `!`

Both switch the type checker off at the exact point you are least sure. If a
value can be missing, narrow it with a check. If you cannot name the type,
the shape is wrong — fix the shape.
