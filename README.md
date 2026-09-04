# email-validator

`email-validator` helps applications validate email addresses before users sign up or sign in. The project provides framework-agnostic validation primitives and a Better Auth adapter.

## Packages

- `@email-validator/core` normalizes addresses, checks user-supplied domain lists, calls MX resolvers, and runs custom checks.
- `@email-validator/better-auth` connects the core validator to a Better Auth `before` hook.
- `@email-validator/data` provides an optional generated disposable-domain list.

The core package never downloads or owns a disposable-domain list. Each application supplies its own list or lookup function.

The repository includes an optional generated union of two public lists at [`packages/data/disposable-domains.txt`](packages/data/disposable-domains.txt). The validator never loads this file automatically, so applications can ignore it or provide their own data.

Use `blocklist` to reject entire domains and `blacklist` to reject specific email addresses:

```ts
const result = await validateEmail(email, {
  blocklist: ["blocked.example"],
  blacklist: ["abuse@example.com", "former-user@example.com"],
});
```

The validator normalizes blacklist entries before it compares them, so email comparisons ignore surrounding whitespace and letter case.

## Install

```sh
npm add @email-validator/core
```

Install the Better Auth adapter only when you use Better Auth:

```sh
npm add @email-validator/better-auth
```

Install the optional disposable-domain dataset only when you want to use the repository's merged list:

```sh
npm add @email-validator/data
```

## Quick Start

```ts
import { validateEmail } from "@email-validator/core";

const result = await validateEmail("user@example.com", {
  disposable: ["tempmail.com", "10minutemail.com"],
});

if (!result.valid) {
  console.error(`Reject ${result.normalizedEmail}: ${result.reason}`);
}
```

The validator skips disposable checks when you omit `disposable`. You can pass a static list or an async lookup function:

```ts
const result = await validateEmail(email, {
  disposable: async (domain) => myDomainStore.has(domain),
});
```

To use the optional dataset, read its installed file and pass the resulting array to `disposable`:

```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const dataPath = join(
  dirname(require.resolve("@email-validator/data/package.json")),
  "disposable-domains.txt",
);
const domains = (await readFile(dataPath, "utf8"))
  .split("\n")
  .filter(Boolean);

const result = await validateEmail(email, { disposable: domains });
```

## MX Validation

The core package does not perform DNS I/O. Your application must inject an `MxResolver` when it enables MX validation:

```ts
const result = await validateEmail(email, {
  mx: true,
  resolver: (domain, signal) => resolveMx(domain, signal),
});
```

Your resolver should enforce a timeout and honor the supplied `AbortSignal`.

## Node.js

Use your preferred Node.js DNS library as the resolver:

```ts
import { validateEmail } from "@email-validator/core";

const result = await validateEmail("user@example.com", {
  disposable: ["tempmail.com"],
  mx: true,
  resolver: async (domain, signal) => resolveMxWithNode(domain, signal),
});
```

## Next.js with Better Auth

Add the adapter to your Better Auth server configuration:

```ts
import { emailValidator } from "@email-validator/better-auth";

export const auth = betterAuth({
  plugins: [
    emailValidator({
      disposable: ["tempmail.com", "mail.example"],
      mx: true,
      resolver: resolveMxWithNode,
    }),
  ],
});
```

The adapter reads the email from the hook input, calls `validateEmail`, and rejects invalid addresses. The adapter does not duplicate validation rules.

## Cloudflare Workers

Cloudflare Workers does not provide Node.js's `node:dns` API. Use DNS-over-HTTPS instead: the resolver sends the MX query through an HTTP request, and the Worker can perform that request with the standard `fetch` API. This approach keeps `@email-validator/core` runtime-agnostic and avoids Node.js-only dependencies.

Wrangler must load the optional domain list as a text module. Add this rule to `wrangler.jsonc`:

```jsonc
{
  "rules": [
    {
      "type": "Text",
      "globs": ["**/*.txt"]
    }
  ]
}
```

Then install `@email-validator/data` and import the list:

```ts
import domainsText from "@email-validator/data/disposable-domains.txt";

const disposableDomains = domainsText.split("\n").filter(Boolean);
```

TypeScript projects may also need this declaration:

```ts
declare module "*.txt" {
  const content: string;
  export default content;
}
```

Inject a DNS-over-HTTPS resolver:

```ts
import { validateEmail } from "@email-validator/core";

const result = await validateEmail(email, {
  disposable: ["tempmail.com", "mail.example"],
  mx: true,
  resolver: async (domain, signal) => {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`,
      { headers: { accept: "application/dns-json" }, signal },
    );
    const data = (await response.json()) as { Answer?: unknown[] };
    return Array.isArray(data.Answer) && data.Answer.length > 0;
  },
});
```

## Development

```sh
npm install
npm run build
npm run typecheck
npm test
npm run lint:tslint
```

The workspace keeps package code under `packages/`. Rollup bundles each package's JavaScript entry point, and TypeScript emits declarations. Biome and TSLint check source quality. GitHub Actions runs these checks on every push and pull request.

## Roadmap

1. Stabilize the validation result and error contracts.
2. Add maintained Node.js and Workers resolver helpers.
3. Add role-account, typo, and provider checks as independent core checks.
4. Publish packages with Changesets and npm provenance.

## Release Strategy

Changesets manages package versions and changelogs. GitHub Actions publishes packages from `main` after the project merges a release changeset. Consumers own and update their disposable-domain data.
