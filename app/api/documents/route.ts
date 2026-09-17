import type { NextRequest } from "next/server";
import { getAppUser } from "@/lib/session";
import {
  createCv,
  deleteCvs,
  extractText,
  findExistingCv,
  hashBuffer,
  isSupportedFile,
  updateCvParsedFields,
} from "@/lib/cvs";
import { parseResumeText, type ParsedResume } from "@/lib/openai";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isSupportedFile(file.type, file.name)) {
    return Response.json(
      { error: "Unsupported file type. Upload a PDF, DOCX, or TXT file." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File is too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = hashBuffer(buffer);

  const existing = await findExistingCv(user.id, fileHash);

  // Already uploaded and successfully enriched — nothing new to do.
  if (existing && existing.parsedRoles !== null) {
    return Response.json({ duplicate: true }, { status: 200 });
  }

  let extractedText: string;
  try {
    // Re-uploading a file we've already extracted (parsing just failed last
    // time) doesn't need to go through extraction again.
    extractedText = existing
      ? existing.extractedText
      : await extractText(buffer, file.type, file.name);
  } catch (error) {
    console.error("CV text extraction failed:", error);
    return Response.json(
      { error: "Could not read this file. Try a different file." },
      { status: 400 }
    );
  }

  let parsed: ParsedResume | null = null;
  try {
    parsed = await parseResumeText(extractedText);
  } catch (error) {
    // Profile enrichment is best-effort — the CV and its extracted text are
    // still saved even if structured parsing fails (e.g. no API key set).
    console.error("Resume structured extraction failed:", error);
  }

  const parsedFields = {
    parsedHeadline: parsed?.headline ?? null,
    parsedLocation: parsed?.location ?? null,
    parsedYears: parsed?.yearsOfExperience ?? null,
    parsedSkills: parsed?.skills ?? null,
    parsedRoles: parsed?.roles ?? null,
  };

  if (existing) {
    await updateCvParsedFields(existing.id, parsedFields);
    return Response.json(
      { duplicate: false, reparsed: true, enriched: parsed !== null },
      { status: 200 }
    );
  }

  await createCv(user.id, {
    fileName: file.name,
    fileType: file.type || "unknown",
    fileSize: file.size,
    fileHash,
    extractedText,
    ...parsedFields,
  });

  return Response.json(
    { duplicate: false, enriched: parsed !== null },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return Response.json(
      { error: "Provide a non-empty array of document ids." },
      { status: 400 }
    );
  }

  const deletedCount = await deleteCvs(user.id, ids);
  return Response.json({ deletedCount }, { status: 200 });
}
