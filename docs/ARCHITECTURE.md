# Architecture

## Status and goal

This document defines the target architecture for Dovo Planning Poker. The current code is the initial Next.js scaffold; rooms, Supabase, internationalization, and advertising still need to be implemented.

The application lets people create Planning Poker rooms and participate without an account. Supabase is the source of truth for rooms, and Supabase Realtime distributes updates. The browser stores only the language, theme, and chosen name in `localStorage`.

## Stack

- Next.js App Router, React, and TypeScript.
- Supabase Postgres for persistent room state.
- Supabase Realtime to notify connected clients of changes.
- Next.js Route Handlers to validate and execute room operations on the server.
- Google AdSense for monetization, integrated as an isolated module.
- Deployment on a platform compatible with Next.js and server-side environment variables.

The Supabase package and environment configuration are not part of the scaffold yet.

## Principles

- Do not require registration or an account to vote.
- Keep business rules and authorization on the server.
- Use the database as the source of truth; Realtime communicates changes but does not replace persistent state.
- Separate the room, participant, voting, internationalization, and advertising domains.
- Do not persist room data or participant credentials in `localStorage`.
- Design responsively and accessibly, with support for both LTR and RTL writing directions.

## Proposed modules and structure

```text
src/
  app/
    page.tsx                    # Home: create or join a room
    room/[roomId]/page.tsx      # Room experience
    api/                        # Route Handlers for commands and queries
  features/
    rooms/                      # Create, find, join, and manage rooms
    voting/                     # Votes, rounds, reveal, and clear
    participants/               # Members, presence, and host role
    ads/                        # Isolated AdSense integration
  components/                   # Shared visual controls
  i18n/                         # Catalogs, locale, and text direction
  lib/
    supabase/                   # Server and browser clients
    validation/                 # Shared input validation
  styles/                       # Design tokens and global styles
```

This structure is a guide for implementation. Keep the existing App Router and avoid layers without a clear responsibility.

### Responsibilities

- `app`: route and layout composition, without extensive business logic.
- `features/rooms`: room use cases and lifecycle.
- `features/voting`: round rules and card state.
- `features/participants`: member lifecycle and host authorization.
- `features/ads`: ad loading and consent states, without interfering with the room.
- `i18n`: translations, formatting, and `lang`/`dir` attributes.
- `lib/supabase`: client initialization and persistence access, without exposing secrets.
- `components`: reusable visual elements, with no direct table access or permission decisions.

## Product flow

1. At `/`, a person chooses to create a room or join an existing one.
2. To create a room, they provide a name; the server creates the room and registers them as host. The interface offers a link and an invitation code to copy.
3. To join, a person opens the link or enters the code and provides a name.
4. Members select a card for the current topic. Votes stay hidden until the host reveals the round.
5. The host can reveal cards, clear votes to start another round, rename the room or topic, remove members, and transfer the host role.
6. Clients receive updates through Realtime and fetch a snapshot from the server when joining or reconnecting.

## Trust boundaries and permissions

The room code helps people find a room; it is not a password and does not prove that someone is the host. Room identifiers must be random, and join endpoints must rate-limit attempts to reduce enumeration and abuse.

Mutations go through server Route Handlers. The server validates the room, participant, vote format, and required permission before writing to Supabase. Each participant receives a random credential scoped to their room. The server stores only its hash in the database and sends the raw credential in an `HttpOnly`, `SameSite=Lax` session cookie scoped to that room's API. The credential is never available to client JavaScript and is not stored in `localStorage`. The `service_role` key exists only on the server.

The browser can subscribe to the room's Realtime channel, but cannot directly change room state or assign itself the host role. The room identifier must be unpredictable, and Realtime messages must not include credentials. Data published to the channel must be limited to what members of that room are allowed to see. After a mutation, the client accepts the server-confirmed change; on reconnect, it fetches a snapshot to reconcile its state.

A full page reload preserves the participant session through the HTTP-only cookie, so the host does not lose control when refreshing. When the browser session ends, the cookie expires; the person can rejoin through the room link or code as a new membership. A host who permanently leaves should transfer the role first. Define a recovery policy for unexpectedly abandoned hosts before production.

## Initial data model

- `rooms`: identifier, unique code, name, topic, host participant, reveal state, timestamps, and expiration.
- `participants`: identifier, room, display name, credential hash, connection state, and last activity.
- `votes`: room, round, participant, and card value; one vote per participant per round.

Votes remain hidden in server responses until the round is revealed. Host transfer must be an atomic operation that validates the current host and target member. Removing a member invalidates their credential and removes or invalidates their vote in the active round.

Deleting expired rooms and related data requires an explicit retention policy; do not assume temporary rooms are deleted automatically.

## Realtime and room state

- Postgres is the source of truth for rooms, members, and votes.
- Each command is validated and persisted before subscribers are notified.
- Clients apply events or request a fresh snapshot if they detect a gap or reconnect.
- A round has at least two states: voting open and votes revealed.
- The UI never reveals values before receiving confirmation from the server.
- Presence signals are for showing connection status, not granting permissions.

## Internationalization, direction, and theme

Supported languages, with no additional locales:

| Code | Language | Direction |
| --- | --- | --- |
| `en` | English, default | LTR |
| `es` | Spanish | LTR |
| `ar` | Arabic | RTL |
| `pt` | Portuguese | LTR |

All visible text must come from typed catalogs, not strings embedded in components. English is the fallback when a translation is missing. The locale controls `lang`, `dir`, and regional formatting. Prefer logical CSS properties so layouts work in RTL.

There will be only two themes: `light` and `dark`. Do not add an automatic system-preference mode.

`localStorage` is limited to the locale, theme, and participant name. Validate stored values; use English, light theme, and an empty name as initial values. Do not store codes, invitation URLs, votes, room data, member identifiers, or credentials in `localStorage`.

## Advertising and privacy

AdSense must be isolated in `features/ads`, loaded in a controlled way, and must not block room creation, voting, or host controls. Ads must not overlap controls or expose room information. Before production, define consent, the privacy policy, cookie handling, and legal requirements for the territories where the service will be offered. Do not send votes, credentials, or private room content to the advertising platform.

Names are shared with members of their room, and active room data is stored in Supabase. Document the retention period and expiration policy before launch.

## Environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Variables prefixed with `NEXT_PUBLIC_` are visible in the browser and must never contain secrets. `SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not commit real values to the repository.

## Verification

- Test room creation, joining by code and link, hidden votes, reveal, clearing, and all host actions.
- Verify that non-host participants cannot perform host actions, even by manipulating requests.
- Test concurrent changes, reconnection, and snapshot refresh.
- Validate all four languages, the English fallback, Arabic RTL, and both themes.
- Confirm that `localStorage` contains nothing beyond language, theme, and name.
- Validate keyboard navigation, accessible control names, and ad legibility.
