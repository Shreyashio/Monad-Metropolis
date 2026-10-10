/**
 * Authentication: resolve the caller of a request to a row in `users`.
 *
 * Two modes:
 *   - DEV (`DEV_AUTH_BYPASS=true`, refused in production): the caller is
 *     identified by the `x-dev-user-id` header, which must be a UUID that
 *     matches an existing user row. (ASSUMPTIONS A5/A6)
 *   - Production: a Privy access token is verified and the user is looked up
 *     (and created on first login, ASSUMPTIONS A4) by Privy DID.
 *
 * NOTE (OPEN_QUESTIONS OQ1–OQ3): the Privy server-auth SDK is not wired up
 * yet. `verifyPrivyToken` is an isolated stub so the rest of the auth surface
 * (DEV mode, role guards, provisioning) is testable today.
 */

import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getSupabase } from "@/lib/db/supabase";
import { AuthError } from "@/lib/auth/errors";
import type { UserRole, UserStatus } from "@/src/types/api";

export interface AuthUser {
  id: string;
  privy_did: string | null;
  wallet_address: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface PrivyClaims {
  privyDid: string;
  walletAddress?: string | null;
  email?: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate the `x-dev-user-id` header value. */
export function parseDevUserId(raw: string | null): string {
  const id = raw?.trim();
  if (!id) {
    throw new AuthError(
      "UNAUTHORIZED",
      "Missing x-dev-user-id header (DEV_AUTH_BYPASS is enabled)",
    );
  }
  if (!UUID_RE.test(id)) {
    throw new AuthError("UNAUTHORIZED", "x-dev-user-id is not a valid UUID");
  }
  return id;
}

/** Extract the bearer token from an Authorization header value. */
export function parseBearerToken(raw: string | null): string {
  if (!raw) {
    throw new AuthError("UNAUTHORIZED", "Missing Authorization header");
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  if (!match) {
    throw new AuthError(
      "UNAUTHORIZED",
      "Authorization header must be 'Bearer <token>'",
    );
  }
  return match[1].trim();
}

/** Resolve the authenticated user for a request. */
export async function resolveUser(req: NextRequest): Promise<AuthUser> {
  const env = getEnv();

  if (env.DEV_AUTH_BYPASS === "true") {
    const id = parseDevUserId(req.headers.get("x-dev-user-id"));
    return loadUserById(id);
  }

  const token = parseBearerToken(req.headers.get("authorization"));
  const claims = await verifyPrivyToken(
    token,
    env.PRIVY_APP_ID ?? "",
    env.PRIVY_APP_SECRET ?? "",
  );
  return loadOrCreateUserByPrivyDid(claims);
}

async function loadUserById(id: string): Promise<AuthUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load user: ${error.message}`);
  if (!data) throw new AuthError("UNAUTHORIZED", "User not found");
  if (data.status === "suspended") {
    throw new AuthError("FORBIDDEN", "User is suspended");
  }
  return data as AuthUser;
}

async function loadOrCreateUserByPrivyDid(
  claims: PrivyClaims,
): Promise<AuthUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("privy_did", claims.privyDid)
    .maybeSingle();
  if (error) throw new Error(`Failed to load user: ${error.message}`);
  if (data) {
    if (data.status === "suspended") {
      throw new AuthError("FORBIDDEN", "User is suspended");
    }
    return data as AuthUser;
  }

  // First login: create a contributor by default (ASSUMPTIONS A4).
  const { data: created, error: createError } = await supabase
    .from("users")
    .insert({
      privy_did: claims.privyDid,
      wallet_address: claims.walletAddress ?? null,
      email: claims.email ?? null,
      role: "contributor",
    })
    .select("*")
    .single();
  if (createError) throw new Error(`Failed to create user: ${createError.message}`);
  return created as AuthUser;
}

/**
 * Verify a Privy access token and return its claims.
 *
 * TODO(OQ1–OQ3): implement with the Privy server-auth SDK. The exact package,
 * method name, and claim field names are still to be confirmed, so this throws
 * until the provider is chosen. See docs/OPEN_QUESTIONS.md.
 */
async function verifyPrivyToken(
  token: string,
  appId: string,
  appSecret: string,
): Promise<PrivyClaims> {
  // Prevent "unused parameter" warnings until the SDK call is wired in.
  void token;
  void appId;
  void appSecret;
  throw new AuthError(
    "UNAUTHORIZED",
    "Privy token verification is not configured",
  );
}
