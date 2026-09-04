import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { validateEmail, type ValidationOptions } from "@email-validator/core";

export type EmailGuardOptions = ValidationOptions & {
  getEmail?: (input: unknown) => string | undefined;
};

/** Creates a Better Auth `before` hook that delegates validation to core. */
export function emailValidator(options: EmailGuardOptions = {}) {
  const getEmail = options.getEmail ?? ((input: unknown) => (input as { email?: string })?.email);

  return {
    id: "email-validator",
    hooks: {
      before: [
        {
          matcher: (context) =>
            context.path === "/sign-up/email" || context.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            const email = getEmail(ctx.body);
            if (!email) return;

            const result = await validateEmail(email, options);
            if (!result.valid) {
              throw new APIError("BAD_REQUEST", {
                message: `Email rejected: ${result.reason}`,
              });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
