import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3MB of HTML is already generous
const USER_AGENT =
  "Mozilla/5.0 (compatible; TrueFitBot/1.0; +https://truefit.app)";

/**
 * Fetches a job posting page server-side and returns its readable text,
 * stripped of scripts/styles/markup. This is the "web fetch tool" step — it
 * does no structured parsing, only turns HTML into plain text.
 */
export async function fetchJobPageText(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out fetching that page.");
    }
    throw new Error("Could not reach that URL.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`That page returned an error (status ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("text/plain")
  ) {
    throw new Error("That URL doesn't point to a readable web page.");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("That page is too large to read.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("That page is too large to read.");
  }

  const text = htmlToText(buffer.toString("utf-8"));

  if (!text.trim()) {
    throw new Error("Could not find any readable text on that page.");
  }

  return text;
}

/** Strips a raw HTML document down to plain text via regex only (no DOM/parser dependency). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export async function findExistingJobPost(userId: string, urlHash: string) {
  return prisma.jobPost.findUnique({
    where: { userId_urlHash: { userId, urlHash } },
  });
}

export async function createJobPost(
  userId: string,
  data: {
    sourceUrl: string;
    urlHash: string;
    rawText: string;
    parsedTitle?: string | null;
    parsedCompany?: string | null;
    parsedLocation?: string | null;
    parsedDescription?: string | null;
    parsedRequirements?: string[] | null;
  }
) {
  return prisma.jobPost.create({
    data: {
      userId,
      ...data,
      parsedRequirements: data.parsedRequirements ?? undefined,
    },
  });
}

export async function updateJobPostParsedFields(
  id: string,
  data: {
    parsedTitle?: string | null;
    parsedCompany?: string | null;
    parsedLocation?: string | null;
    parsedDescription?: string | null;
    parsedRequirements?: string[] | null;
  }
) {
  return prisma.jobPost.update({
    where: { id },
    data: {
      ...data,
      parsedRequirements: data.parsedRequirements ?? undefined,
    },
  });
}

export type JobSummary = {
  id: string;
  sourceUrl: string;
  parsedTitle: string | null;
  parsedCompany: string | null;
  createdAt: Date;
};

/** One row per saved job posting for the sidebar's tailoring history. */
export async function getJobSummaries(userId: string): Promise<JobSummary[]> {
  return prisma.jobPost.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sourceUrl: true,
      parsedTitle: true,
      parsedCompany: true,
      createdAt: true,
    },
  });
}
