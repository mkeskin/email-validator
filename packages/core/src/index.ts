/** Describes why the validator rejected an email address. */
export type CheckReason = "invalid" | "disposable" | "mx" | "blocked" | "not-allowed" | string;

/** The result of an email validation attempt. */
export type ValidationResult =
  | { valid: true; normalizedEmail: string; domain: string; checks: string[] }
  | {
      valid: false;
      normalizedEmail: string;
      domain: string;
      reason: CheckReason;
      checks: string[];
    };

/** Resolves whether a domain publishes at least one usable MX record. */
export type MxResolver = (domain: string, signal?: AbortSignal) => Promise<boolean>;

/** Runs one application-defined validation rule. Return a reason to reject the address. */
export type EmailCheck = (input: {
  email: string;
  domain: string;
  signal?: AbortSignal;
}) => Promise<CheckReason | undefined>;

/** Supplies disposable domains as a static collection or a dynamic lookup. */
export type DisposableCheck =
  | Iterable<string>
  | ((domain: string, signal?: AbortSignal) => boolean | Promise<boolean>);

/** Configures the checks that `validateEmail` runs. */
export type ValidationOptions = {
  disposable?: DisposableCheck;
  mx?: boolean;
  resolver?: MxResolver;
  allowlist?: Iterable<string>;
  blocklist?: Iterable<string>;
  blacklist?: Iterable<string>;
  checks?: EmailCheck[];
  signal?: AbortSignal;
};

/**
 * Normalizes an email address and returns its address and domain components.
 *
 * The function trims surrounding whitespace, lowercases the value, and rejects
 * addresses with an invalid or whitespace-containing structure.
 */
export function normalizeEmail(email: string): { email: string; domain: string } | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");

  if (at <= 0 || at === normalized.length - 1 || normalized.indexOf("@") !== at) return null;

  const domain = normalized.slice(at + 1);
  if (!domain.includes(".") || /\s/.test(normalized)) return null;

  return { email: normalized, domain };
}

/**
 * Validates an email address with the checks that the caller enables.
 *
 * The function runs checks in this order: normalization, exact-address
 * blacklist, domain allowlist/blocklist, disposable lookup, MX lookup, and
 * custom checks. It does not perform network or DNS I/O by itself.
 *
 * @param email The address to validate.
 * @param options The caller-owned validation configuration.
 * @returns A normalized success result or a failure result with a reason.
 * @throws {Error} If `mx` is enabled without a `resolver`.
 *
 * @example
 * ```ts
 * const result = await validateEmail("user@example.com", {
 *   disposable: ["tempmail.com"],
 *   blacklist: ["blocked@example.com"],
 * });
 * ```
 */
export async function validateEmail(
  email: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const parsed = normalizeEmail(email);

  // Stop before any domain-based check when the address has an invalid shape.
  if (!parsed) {
    return {
      valid: false,
      normalizedEmail: email.trim().toLowerCase(),
      domain: "",
      reason: "invalid",
      checks: ["normalization"],
    };
  }

  const normalized = { ...parsed, normalizedEmail: parsed.email };

  const checks: string[] = ["normalization"],
    allow = new Set([...(options.allowlist ?? [])].map((d) => d.toLowerCase())),
    block = new Set([...(options.blocklist ?? [])].map((d) => d.toLowerCase())),
    blacklist = new Set(
      [...(options.blacklist ?? [])].map((address) => address.trim().toLowerCase()),
    );

  // Reject one exact address without blocking the rest of its domain.
  if (blacklist.has(parsed.email)) {
    return { valid: false, ...normalized, reason: "blacklisted", checks: [...checks, "blacklist"] };
  }

  // Restrict access to the configured domains when the allowlist is non-empty.
  if (allow.size && !allow.has(parsed.domain)) {
    return { valid: false, ...normalized, reason: "not-allowed", checks };
  }

  // Reject every address that belongs to a blocked domain.
  if (block.has(parsed.domain)) {
    return { valid: false, ...normalized, reason: "blocked", checks: [...checks, "blocklist"] };
  }

  // Let the caller decide whether a domain is disposable.
  if (options.disposable) {
    const isDisposable =
      typeof options.disposable === "function"
        ? await options.disposable(parsed.domain, options.signal)
        : new Set([...options.disposable].map((domain) => domain.trim().toLowerCase())).has(
            parsed.domain,
          );

    // Stop when the caller's disposable-domain source identifies this domain.
    if (isDisposable) {
      return {
        valid: false,
        ...normalized,
        reason: "disposable",
        checks: [...checks, "disposable"],
      };
    }
  }

  // Ask the injected resolver for an MX record only when the caller enables it.
  if (options.mx) {
    checks.push("mx");

    // Fail fast because core cannot perform DNS lookups without an adapter.
    if (!options.resolver) throw new Error("An MX resolver is required when mx is enabled");

    // Treat a missing MX record as a validation failure.
    if (!(await options.resolver(parsed.domain, options.signal)))
      return { valid: false, ...normalized, reason: "mx", checks };
  }

  for (const check of options.checks ?? []) {
    const reason = await check({ ...parsed, signal: options.signal });

    // Return the custom check's reason so callers can explain the rejection.
    if (reason) return { valid: false, ...normalized, reason, checks: [...checks, "custom"] };
  }

  return { valid: true, ...normalized, checks };
}
