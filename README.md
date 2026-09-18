# Zabardast Admin Panel

Static administration portal backed by hosted Supabase services.

## Run with Docker

1. Copy `.env.example` to `.env` and set the hosted Supabase URL and publishable browser key.
2. Build and start the service:

   ```sh
   docker compose up --build -d
   ```

3. Open [http://localhost:3000](http://localhost:3000).

The health endpoint is [http://localhost:3000/healthz](http://localhost:3000/healthz). Check status and logs with:

```sh
docker compose ps
docker compose logs -f admin-panel
```

Stop the service with `docker compose down`.

## Runtime configuration

The container requires these environment variables:

- `SUPABASE_URL`: hosted Supabase project URL, using HTTPS.
- `SUPABASE_PUBLISHABLE_KEY`: public browser key. Never use a service-role key here.

At startup the container writes these public values to an in-memory `config.js`. The application image does not contain environment files, database scripts, Supabase functions, or server credentials.

## Linux deployment

Run the Compose service on the host and configure the HTTPS reverse proxy to forward requests to `http://127.0.0.1:3000`. Keep port 3000 firewalled from the public network when the reverse proxy is the public entry point.

To upgrade:

```sh
git pull
docker compose up --build -d
docker image prune
```

## Security requirements

- Rotate the previously exposed Firebase service-account key before production use.
- Keep Firebase credentials and `SUPABASE_SERVICE_ROLE_KEY` in Supabase Edge Function secrets only.
- Purge the revoked private key from Git history before publishing or sharing the repository.
- Enforce authorization with Supabase Row Level Security policies. Browser role checks are not a security boundary.
- Create privileged Admin and Vendor accounts only through a trusted administrative workflow.

The edge function now fails closed when its required managed secrets are missing. Public signup is limited to the Student role.

Run the tracked-file credential check locally with `./Scripts/check-secrets.ps1`. The same check and a production image build run automatically in CI.
