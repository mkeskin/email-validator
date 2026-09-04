import { validateEmail, type ValidationOptions } from "@email-validator/core";

export type EmailGuardOptions = ValidationOptions & {
  getEmail?: (input: unknown) => string | undefined;
};

/** Creates a Better Auth `before` hook that delegates validation to core. */
export function emailGuard(options: EmailGuardOptions = {}) {
  const getEmail = options.getEmail ?? ((input: unknown) => (input as { email?: string })?.email);

  return {
    id: "email-validator",
    async before(input: unknown) {
      const email = getEmail(input);
      if (!email) return;

      const result = await validateEmail(email, options);
      if (!result.valid) throw new Error(`Email rejected: ${result.reason}`);
    },
  };
}
