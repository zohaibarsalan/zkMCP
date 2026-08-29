# Public docs deployment — Vercel

## Current production deployment

```text
Primary domain    https://zkmcp.zohaibarsalan.me
Vercel fallback   https://zkmcp.vercel.app
Mode              recorded proof documentation
Status            deployed and verified
```

The custom domain is the canonical URL for GitHub and Devpost. The Vercel fallback should redirect to the custom domain.

The public deployment is intentionally **recorded-mode documentation only**. It does not run the Midnight node, proof server, wallet, or demo API on Vercel.

## Import the GitHub repository

Create a new Vercel project from:

```text
zohaibarsalan/zkMCP
```

Use these project settings:

```text
Framework Preset     Next.js
Root Directory       apps/web
Build Command        leave default (`npm run build`)
Output Directory     leave default (`.next`)
Install Command      leave default
Node.js              24.x (22+ is supported by the repo)
```

The web app has no runtime dependency on `@zkmcp/gateway` or `@zkmcp/midnight`; live proving is accessed only through the optional local demo HTTP bridge.

## Environment variables

For the public Devpost deployment, set **none**.

In particular, do **not** set:

```text
NEXT_PUBLIC_ZKMCP_API_URL
```

Without that variable the playground stays in self-contained recorded mode and uses receipts from the final verified local MCP + Midnight run.

The production client bundle was checked before submission packaging and contains no configured `localhost:8787` / `127.0.0.1:8787` API endpoint. The docs contain those addresses only as explanatory local-development text.

## Verify after deployment

Open these routes:

```text
/                                  redirects to /docs
/docs                              introduction
/docs/architecture                 architecture + zoomable diagrams
/docs/playground                   recorded proof inspector
/docs/development/verification     final proof evidence
/docs/security/privacy-model       privacy matrix
/api-reference                     Scalar reference
/openapi.json                      OpenAPI 3.1 document
```

Also verify:

- search opens and returns results;
- the playground says `Recorded proof run`;
- the payment-under-limit example shows transaction `00b4a29f8503…` from the final verification run;
- the payment-above-maximum example says the upstream tool was never invoked;
- there are no browser console/network errors;
- diagram click-to-zoom works.

## After the deployment is live

Use the resulting production URL for:

1. GitHub repository homepage;
2. Devpost **Try it out** URL;
3. Devpost gallery context;
4. the public link shown at the end of the demo video if desired.

Do not describe the public Vercel deployment as a live Midnight deployment. It is the developer documentation + recorded proof inspector. The video/local demo demonstrates fresh live proving.
