import type { NextRequest } from "next/server";
import { getAppUser } from "@/lib/session";
import {
  createJobPost,
  fetchJobPageText,
  findExistingJobPost,
  hashUrl,
  updateJobPostParsedFields,
} from "@/lib/jobs";
import { parseJobDescription, type ParsedJob } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = body?.url;

  if (typeof url !== "string" || url.trim() === "") {
    return Response.json({ error: "Provide a job posting URL." }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return Response.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }

  const urlHash = hashUrl(url);
  const existing = await findExistingJobPost(user.id, urlHash);

  // Already fetched and successfully enriched — nothing new to do.
  if (existing && existing.parsedRequirements !== null) {
    return Response.json(
      {
        duplicate: true,
        job: {
          id: existing.id,
          sourceUrl: existing.sourceUrl,
          parsedTitle: existing.parsedTitle,
          parsedCompany: existing.parsedCompany,
          createdAt: existing.createdAt,
        },
      },
      { status: 200 }
    );
  }

  let rawText: string;
  try {
    // Re-submitting a URL we've already fetched (parsing just failed last
    // time) doesn't need to hit the network again.
    rawText = existing ? existing.rawText : await fetchJobPageText(url);
  } catch (error) {
    console.error("Job page fetch failed:", error);
    const message = error instanceof Error ? error.message : "Could not read that page.";
    return Response.json({ error: message }, { status: 400 });
  }

  let parsed: ParsedJob | null = null;
  try {
    parsed = await parseJobDescription(rawText);
  } catch (error) {
    // Structured extraction is best-effort — the job post and its raw text
    // are still saved even if parsing fails (e.g. no API key set).
    console.error("Job structured extraction failed:", error);
  }

  const parsedFields = {
    parsedTitle: parsed?.title ?? null,
    parsedCompany: parsed?.company ?? null,
    parsedLocation: parsed?.location ?? null,
    parsedDescription: parsed?.description ?? null,
    parsedRequirements: parsed?.requirements ?? null,
  };

  if (existing) {
    const updated = await updateJobPostParsedFields(existing.id, parsedFields);
    return Response.json(
      {
        duplicate: false,
        reparsed: true,
        enriched: parsed !== null,
        job: {
          id: updated.id,
          sourceUrl: updated.sourceUrl,
          parsedTitle: updated.parsedTitle,
          parsedCompany: updated.parsedCompany,
          createdAt: updated.createdAt,
        },
      },
      { status: 200 }
    );
  }

  const created = await createJobPost(user.id, {
    sourceUrl: url,
    urlHash,
    rawText,
    ...parsedFields,
  });

  return Response.json(
    {
      duplicate: false,
      enriched: parsed !== null,
      job: {
        id: created.id,
        sourceUrl: created.sourceUrl,
        parsedTitle: created.parsedTitle,
        parsedCompany: created.parsedCompany,
        createdAt: created.createdAt,
      },
    },
    { status: 201 }
  );
}
