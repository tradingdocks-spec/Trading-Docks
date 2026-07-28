# JustTCG free-tier setup

1. In Vercel, add `JUSTTCG_API_KEY` to the same project that serves Trading Docks.
2. Enable it for Production and Preview.
3. Redeploy after saving the variable.
4. Open `/api/card-shows/diagnostic` on the new deployment.

Expected response:

```json
{"configured":true,"keyFormatValid":true,"runtime":"server"}
```

The diagnostic never returns the API key.

This version is tuned for free-tier development:

- Searches run only when submitted.
- Identical successful searches are cached for one hour.
- Simultaneous identical searches share one provider request.
- Provider requests are spaced to stay below ten requests per minute.
- Requests time out after eight seconds.
- Saved results remain available for up to 24 hours during a temporary provider failure.
- Missing configuration, invalid credentials, rate limits, shared-host free-tier blocks, timeouts, and provider outages use different messages.
