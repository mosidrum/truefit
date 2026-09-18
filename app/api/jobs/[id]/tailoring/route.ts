import type { NextRequest } from "next/server";
import { getAppUser } from "@/lib/session";
import { findTailoringForJobPost, getOrGenerateTailoring } from "@/lib/tailoring";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const record = await findTailoringForJobPost(user.id, id);
  if (!record) {
    return Response.json({ error: "No tailoring generated yet." }, { status: 404 });
  }

  return Response.json({ tailoring: record }, { status: 200 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  let force = false;
  let additionalContext: string | undefined;
  try {
    const body = (await req.json()) as {
      force?: unknown;
      additionalContext?: unknown;
    } | null;
    if (body && typeof body === "object") {
      force = body.force === true;
      if (typeof body.additionalContext === "string" && body.additionalContext.trim()) {
        additionalContext = body.additionalContext.trim();
      }
    }
  } catch {
    // Empty or non-JSON body — treat as a plain generate (no force).
  }

  try {
    const { record, generated } = await getOrGenerateTailoring(user.id, id, {
      force,
      additionalContext,
    });
    return Response.json({ tailoring: record, generated }, { status: 200 });
  } catch (error) {
    console.error("Tailoring generation failed:", error);
    const message = error instanceof Error ? error.message : "Couldn't generate tailoring.";
    const status = message.includes("Upload a CV") || message.includes("not found") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
