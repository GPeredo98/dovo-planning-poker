# Dovo Planning Poker

Real-time Planning Poker for teams. Anyone can create or join a room without creating an account, choose a display name, and vote on the current topic.

> Status: this repository contains the initial Next.js scaffold and product documentation. Supabase integration and Planning Poker features are not implemented yet.

## Product experience

- The home screen offers two actions: create a room or join a room.
- When creating a room, the person chooses a name and receives a link and a code to invite the team.
- Other people can join through the link or code and choose a name as well.
- Votes update in real time. Cards remain hidden until the host reveals them.
- The host can reveal or clear the cards, rename the room or topic, remove members, and transfer the host role.
- The interface will support English (the default language), Spanish, Arabic, and Portuguese. Arabic uses right-to-left (RTL) text direction.
- Users can choose between light and dark themes.
- The application plans to support Google AdSense without blocking voting controls.

## Local development

Requirements: Node.js compatible with the project's Next.js version and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The scripts currently available are:

```bash
npm run lint
npm run build
```

## Planned stack

- Next.js App Router, React, and TypeScript.
- Supabase Postgres for rooms, participants, and rounds.
- Supabase Realtime to broadcast room updates.
- Next.js Route Handlers as the trust boundary for creating rooms, joining, voting, and host actions.
- Google AdSense for advertising, subject to account setup, consent, and applicable privacy requirements.

Supabase is not configured in this scaffold yet. The planned environment variables are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must stay on the server and must never be exposed to the browser.

## Local data and privacy

No account is required. `localStorage` will contain only the language (`en`, `es`, `ar`, or `pt`), the theme (`light` or `dark`), and the name chosen by the person. English is the initial language. Votes and data needed for an active room live in Supabase, not in `localStorage`.

Names are visible to people in the room. The retention policy for rooms and participants must be defined before deployment.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the modules, realtime flow, permission model, internationalization, and storage decisions.
