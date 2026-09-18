import { createHash } from "crypto";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import type { ParsedResumeRole } from "@/lib/openai";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isSupportedFile(mimeType: string, fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType === DOCX_MIME ||
    mimeType === "text/plain" ||
    extension === "pdf" ||
    extension === "docx" ||
    extension === "txt"
  );
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (mimeType === "application/pdf" || extension === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === DOCX_MIME || extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "text/plain" || extension === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType || extension}`);
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function findExistingCv(userId: string, fileHash: string) {
  return prisma.cv.findUnique({
    where: { userId_fileHash: { userId, fileHash } },
  });
}

export async function createCv(
  userId: string,
  data: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileHash: string;
    extractedText: string;
    parsedHeadline?: string | null;
    parsedLocation?: string | null;
    parsedYears?: number | null;
    parsedSkills?: string[] | null;
    parsedRoles?: ParsedResumeRole[] | null;
  }
) {
  return prisma.cv.create({
    data: {
      userId,
      ...data,
      parsedSkills: data.parsedSkills ?? undefined,
      parsedRoles: data.parsedRoles ?? undefined,
    },
  });
}

export async function updateCvParsedFields(
  id: string,
  data: {
    parsedHeadline?: string | null;
    parsedLocation?: string | null;
    parsedYears?: number | null;
    parsedSkills?: string[] | null;
    parsedRoles?: ParsedResumeRole[] | null;
  }
) {
  return prisma.cv.update({
    where: { id },
    data: {
      ...data,
      parsedSkills: data.parsedSkills ?? undefined,
      parsedRoles: data.parsedRoles ?? undefined,
    },
  });
}

export type CvSummary = {
  id: string;
  fileName: string;
  createdAt: Date;
};

/** File names + upload dates for the Documents card — no extracted content. */
export async function getCvSummaries(userId: string): Promise<CvSummary[]> {
  return prisma.cv.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, createdAt: true },
  });
}

export type CvRawText = {
  fileName: string;
  extractedText: string;
};

/** Raw extracted text per CV, most recent first — the primary source of
 * truth for tailoring generation (richer than the lossy parsed fields). */
export async function getCvRawTextsForUser(userId: string): Promise<CvRawText[]> {
  return prisma.cv.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { fileName: true, extractedText: true },
  });
}

/** Deletes the given CVs (and their extracted text/parsed data) — scoped to
 * the owning user, so ids that don't belong to them are silently ignored. */
export async function deleteCvs(
  userId: string,
  ids: string[]
): Promise<number> {
  const { count } = await prisma.cv.deleteMany({
    where: { userId, id: { in: ids } },
  });
  return count;
}
