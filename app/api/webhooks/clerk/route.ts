import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import {
  deleteUserByClerkId,
  setSessionStatus,
  upsertSession,
  upsertUserFromWebhook,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    evt = await verifyWebhook(req);
  } catch (error) {
    console.error("Clerk webhook verification failed:", error);
    return new Response("Invalid webhook", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        await upsertUserFromWebhook(evt.data);
        break;
      }
      case "user.deleted": {
        if (evt.data.id) {
          await deleteUserByClerkId(evt.data.id);
        }
        break;
      }
      case "session.created": {
        await upsertSession({
          clerkSessionId: evt.data.id,
          clerkUserId: evt.data.user_id,
          status: evt.data.status ?? "active",
          expiresAt: evt.data.expire_at ?? null,
        });
        break;
      }
      case "session.ended":
      case "session.removed":
      case "session.revoked": {
        await setSessionStatus(evt.data.id, evt.type.replace("session.", ""));
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Clerk webhook handler failed:", error);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
