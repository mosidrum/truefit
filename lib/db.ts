import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export type SyncedUser = {
  id: string;
  clerkUserId: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}): string {
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ");
  if (fromParts) return fromParts;
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0] ?? "Account";
  return "Account";
}

function clerkToDate(value: number | string | null | undefined): Date | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  // Clerk timestamps are milliseconds since epoch.
  return new Date(value < 1_000_000_000_000 ? value * 1000 : value);
}

export function clerkUserFields(user: ClerkUser) {
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  return {
    clerkUserId: user.id,
    email,
    name: displayName({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email,
    }),
    imageUrl: user.imageUrl ?? null,
  };
}

/** Upsert the Clerk user into the local database. */
export async function upsertUserFromClerk(
  user: ClerkUser
): Promise<SyncedUser> {
  const fields = clerkUserFields(user);

  return prisma.user.upsert({
    where: { clerkUserId: fields.clerkUserId },
    create: fields,
    update: {
      email: fields.email,
      name: fields.name,
      imageUrl: fields.imageUrl,
    },
  });
}

/** Upsert from Clerk webhook user payloads (snake_case). */
export async function upsertUserFromWebhook(data: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  email_addresses?: Array<{ email_address: string }>;
}): Promise<SyncedUser> {
  const email = data.email_addresses?.[0]?.email_address ?? null;
  const name = displayName({
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    username: data.username ?? null,
    email,
  });

  return prisma.user.upsert({
    where: { clerkUserId: data.id },
    create: {
      clerkUserId: data.id,
      email,
      name,
      imageUrl: data.image_url ?? null,
    },
    update: {
      email,
      name,
      imageUrl: data.image_url ?? null,
    },
  });
}

export async function deleteUserByClerkId(clerkUserId: string) {
  await prisma.user.deleteMany({ where: { clerkUserId } });
}

/** Record or refresh a Clerk session row; returns early if the user is unknown. */
export async function upsertSession(input: {
  clerkSessionId: string;
  clerkUserId: string;
  status?: string;
  expiresAt?: number | string | Date | null;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId: input.clerkUserId },
  });
  if (!user) return;

  const status = input.status ?? "active";
  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt
      : clerkToDate(input.expiresAt ?? null);

  await prisma.session.upsert({
    where: { clerkSessionId: input.clerkSessionId },
    create: {
      clerkSessionId: input.clerkSessionId,
      userId: user.id,
      status,
      expiresAt,
      lastActiveAt: new Date(),
    },
    update: {
      status,
      expiresAt,
      lastActiveAt: new Date(),
    },
  });
}

export async function setSessionStatus(
  clerkSessionId: string,
  status: string
) {
  await prisma.session.updateMany({
    where: { clerkSessionId },
    data: { status, lastActiveAt: new Date() },
  });
}

/** Persist the signed-in Clerk user and optional active session. */
export async function syncSignedInUser(
  user: ClerkUser,
  clerkSessionId: string | null | undefined
): Promise<SyncedUser> {
  const dbUser = await upsertUserFromClerk(user);

  if (clerkSessionId) {
    await upsertSession({
      clerkSessionId,
      clerkUserId: user.id,
      status: "active",
    });
  }

  return dbUser;
}
