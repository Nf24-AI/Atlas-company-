# Security boundaries

This prototype deliberately binds to `127.0.0.1` and is **not** safe for internet exposure. Authentication, authorization, rate limits and hardened input controls are not yet implemented.

- Don't publish `.env`, `data/state.json`, private meeting transcripts, provider API keys or customer details.
- Never enable remote public access to the local backend or commit a workaround that bypasses these restrictions.
- The GitHub Pages deployment is **static simulated AI only**.
- Changes involving API keys, auth or public deployment require CEO review and tests.
- When finding a security issue, avoid publishing the exploit details in a public issue; contact the project owner privately.