import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { syncSignedInUser } from "@/lib/db";

export type AppUser = {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  initials: string;
  imageUrl: string | null;
};

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/**
 * Returns the signed-in user from Clerk, upserted into the local database
 * (with the current session row when available).
 */
export async function getAppUser(): Promise<AppUser | null> {
  const user = await clerkCurrentUser();
  if (!user) return null;

  const { sessionId } = await auth();
  const dbUser = await syncSignedInUser(user, sessionId);

  const name = dbUser.name ?? "Account";
  const email = dbUser.email ?? "";

  return {
    id: dbUser.id,
    clerkUserId: dbUser.clerkUserId,
    name,
    email,
    initials: initialsFromName(name),
    imageUrl: dbUser.imageUrl,
  };
}
