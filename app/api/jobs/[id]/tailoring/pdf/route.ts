import type { NextRequest } from "next/server";
import { getAppUser } from "@/lib/session";
import { getJobPostForTailoring } from "@/lib/jobs";
import { findTailoringForJobPost } from "@/lib/tailoring";
import { renderTailoredCvPdf } from "@/lib/cvPdf";

function toFilename(parts: (string | null | undefined)[]): string {
  const base = parts.filter(Boolean).join(" - ") || "tailored-cv";
  return base.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") + ".pdf";
}

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

  const job = await getJobPostForTailoring(user.id, id);

  const buffer = await renderTailoredCvPdf({
    tailoredCv: record.tailoredCv,
    candidateName: user.name,
    candidateEmail: user.email,
    jobTitle: job?.parsedTitle ?? null,
    company: job?.parsedCompany ?? null,
  });

  const filename = toFilename([job?.parsedCompany, job?.parsedTitle]);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
