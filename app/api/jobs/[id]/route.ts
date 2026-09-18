import type { NextRequest } from "next/server";
import { deleteJobPost } from "@/lib/jobs";
import { getAppUser } from "@/lib/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const { deleted } = await deleteJobPost(user.id, id);
  if (!deleted) {
    return Response.json({ error: "Job posting not found." }, { status: 404 });
  }

  return Response.json({ deleted: true }, { status: 200 });
}
