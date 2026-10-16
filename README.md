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

## Supabase setup

1. Create a Supabase project and copy its project URL, public anon key, and service-role key from the API settings into `.env.local`.
2. Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). It creates the room tables, rate limits, locked-down row-level security, and server-only RPC functions.
3. No table publication setup is needed for this app's Realtime Broadcast channels. They carry room change notifications only; all reads and writes go through server routes. Do not enable Postgres Changes for these tables.
4. In Supabase **Database → Extensions**, enable `pg_cron`, then run this once in the SQL Editor to remove rooms after their seven-day inactivity window:

	 ```sql
	 select cron.schedule(
		 'dovo-cleanup-expired-rooms',
		 '0 * * * *',
		 $$select public.delete_expired_rooms();$$
	 );
	 ```
5. Restart `npm run dev` after changing `.env.local`.

The browser anon key is used only to subscribe to Realtime. Never use the service-role key in a `NEXT_PUBLIC_` variable or expose it in client code. The SQL script grants no direct table access to anonymous or authenticated clients.

## Google AdSense setup

1. Add and verify the production site in AdSense, then wait for site approval.
2. In AdSense **Privacy & messaging**, configure the Google-certified consent message/CMP for the regions where the app is available and publish the required privacy disclosures.
3. Create responsive display ad units for the home and room placements. Put the publisher ID (`ca-pub-…`) in `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` and each unit's numeric slot ID in `NEXT_PUBLIC_ADSENSE_HOME_SLOT` and `NEXT_PUBLIC_ADSENSE_ROOM_SLOT`.
4. Add the `ads.txt` record AdSense provides at the site root after approval.

Ad slots remain hidden until both the publisher and slot IDs are configured. The integration loads the AdSense script after the page becomes interactive; do not click your own live ads.

## Local data and privacy

No account is required. `localStorage` will contain only the language (`en`, `es`, `ar`, or `pt`), the theme (`light` or `dark`), and the name chosen by the person. English is the initial language. Votes and data needed for an active room live in Supabase, not in `localStorage`.

Names are visible to people in the room. The retention policy for rooms and participants must be defined before deployment.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the modules, realtime flow, permission model, internationalization, and storage decisions.
