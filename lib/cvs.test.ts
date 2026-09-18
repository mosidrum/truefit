import { describe, expect, it, vi, beforeEach } from "vitest";

const getTextMock = vi.fn();
const destroyMock = vi.fn();
const pdfParseConstructor = vi.fn();

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation((...args: unknown[]) => {
    pdfParseConstructor(...args);
    return { getText: getTextMock, destroy: destroyMock };
  }),
}));

const extractRawTextMock = vi.fn();
vi.mock("mammoth", () => ({
  extractRawText: extractRawTextMock,
}));

const { isSupportedFile, hashBuffer, extractText } = await import("@/lib/cvs");

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("isSupportedFile", () => {
  it("accepts a PDF by mime type", () => {
    expect(isSupportedFile("application/pdf", "resume")).toBe(true);
  });

  it("accepts a PDF by extension when the mime type is generic", () => {
    expect(isSupportedFile("application/octet-stream", "resume.pdf")).toBe(true);
  });

  it("accepts a docx by mime type", () => {
    expect(isSupportedFile(DOCX_MIME, "resume")).toBe(true);
  });

  it("accepts a docx by extension", () => {
    expect(isSupportedFile("application/octet-stream", "resume.docx")).toBe(true);
  });

  it("accepts plain text by mime type or extension", () => {
    expect(isSupportedFile("text/plain", "resume")).toBe(true);
    expect(isSupportedFile("application/octet-stream", "resume.txt")).toBe(true);
  });

  it("rejects unsupported file types", () => {
    expect(isSupportedFile("image/png", "resume.png")).toBe(false);
  });

  it("is case-insensitive on the extension", () => {
    expect(isSupportedFile("application/octet-stream", "RESUME.PDF")).toBe(true);
  });
});

describe("hashBuffer", () => {
  it("is deterministic for identical content", () => {
    const a = Buffer.from("hello world");
    const b = Buffer.from("hello world");
    expect(hashBuffer(a)).toBe(hashBuffer(b));
  });

  it("differs for different content", () => {
    expect(hashBuffer(Buffer.from("a"))).not.toBe(hashBuffer(Buffer.from("b")));
  });

  it("returns a 64-character hex sha256 digest", () => {
    expect(hashBuffer(Buffer.from("x"))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractText", () => {
  beforeEach(() => {
    getTextMock.mockReset().mockResolvedValue({ text: "Parsed PDF resume text" });
    destroyMock.mockReset().mockResolvedValue(undefined);
    extractRawTextMock.mockReset().mockResolvedValue({ value: "Parsed DOCX resume text", messages: [] });
    pdfParseConstructor.mockReset();
  });

  it("parses a .txt file directly from the buffer, without any library", async () => {
    const text = await extractText(Buffer.from("Plain text résumé content"), "text/plain", "resume.txt");
    expect(text).toBe("Plain text résumé content");
  });

  it("parses a PDF via pdf-parse and unwraps result.text", async () => {
    const buffer = Buffer.from("%PDF-1.4 fake");
    const text = await extractText(buffer, "application/pdf", "resume.pdf");

    expect(text).toBe("Parsed PDF resume text");
    expect(pdfParseConstructor).toHaveBeenCalledWith({ data: buffer });
    expect(getTextMock).toHaveBeenCalledTimes(1);
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("still destroys the PDF parser if getText throws", async () => {
    getTextMock.mockRejectedValue(new Error("corrupt PDF"));
    await expect(
      extractText(Buffer.from("bad"), "application/pdf", "resume.pdf")
    ).rejects.toThrow("corrupt PDF");
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("parses a .docx via mammoth and unwraps result.value", async () => {
    const buffer = Buffer.from("fake docx bytes");
    const text = await extractText(buffer, DOCX_MIME, "resume.docx");

    expect(text).toBe("Parsed DOCX resume text");
    expect(extractRawTextMock).toHaveBeenCalledWith({ buffer });
  });

  it("dispatches on file extension when the mime type is generic", async () => {
    const text = await extractText(Buffer.from("fake"), "application/octet-stream", "resume.docx");
    expect(text).toBe("Parsed DOCX resume text");
  });

  it("throws for an unsupported type", async () => {
    await expect(
      extractText(Buffer.from("x"), "image/png", "photo.png")
    ).rejects.toThrow("Unsupported file type");
  });
});
