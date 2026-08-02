# Firebase setup for KYRO v4

The checked-in rules are the source of truth for development and review. Do not deploy them from an unreviewed migration branch.

## Local emulators

Install `firebase-tools`, authenticate against a non-production project and run:

```sh
firebase emulators:start --only auth,firestore,storage
```

Use `.env.local` to point the v4 application at a development Firebase web app. Production identifiers are public fallbacks for compatibility; credentials and debug tokens must never be committed.

## Required verification before deployment

- owners can read/write only `users/{uid}/data/**` and `users/{uid}/photos/**`;
- users cannot create themselves as admin or blocked;
- granted admins can change only `blocked`, never `isAdmin`;
- only the super-admin can grant/revoke admin;
- shared exercise writes require admin;
- anonymous access and all unknown paths are denied;
- photo uploads reject non-JPEG content and files over 3 MiB.

Deployment of rules, Hosting or GitHub Pages is intentionally outside this migration phase.
