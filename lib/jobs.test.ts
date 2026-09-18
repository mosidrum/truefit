import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchJobPageText, hashUrl, htmlToText } from "@/lib/jobs";

describe("hashUrl", () => {
  it("is deterministic for the same URL", () => {
    expect(hashUrl("https://example.com/jobs/1")).toBe(
      hashUrl("https://example.com/jobs/1")
    );
  });

  it("differs for different URLs", () => {
    expect(hashUrl("https://example.com/jobs/1")).not.toBe(
      hashUrl("https://example.com/jobs/2")
    );
  });

  it("returns a 64-character hex sha256 digest", () => {
    expect(hashUrl("https://example.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("htmlToText", () => {
  it("strips script and style blocks entirely", () => {
    const html = "<html><head><style>.a{color:red}</style></head><body><script>alert(1)</script>Hello</body></html>";
    const text = htmlToText(html);
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).toContain("Hello");
  });

  it("strips HTML comments", () => {
    expect(htmlToText("<p>Before<!-- a comment -->After</p>")).not.toContain("a comment");
  });

  it("converts block-level closing tags into newlines", () => {
    const text = htmlToText("<p>First paragraph</p><p>Second paragraph</p>");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines).toContain("First paragraph");
    expect(lines).toContain("Second paragraph");
  });

  it("decodes common HTML entities", () => {
    const text = htmlToText("<p>Design &amp; Engineering &gt; &lt;Team&gt; &quot;core&quot; &amp; &#39;extended&#39;</p>");
    expect(text).toContain("Design & Engineering > <Team> \"core\" & 'extended'");
  });

  it("collapses repeated whitespace and blank lines", () => {
    const text = htmlToText("<p>A</p>\n\n\n<p>   B    C  </p>");
    expect(text).not.toMatch(/\n{2,}/);
    expect(text).toContain("B C");
  });

  it("strips remaining tags, leaving only text content", () => {
    const text = htmlToText('<div class="job"><h1>Engineer</h1><span>Remote</span></div>');
    expect(text).not.toContain("<");
    expect(text).toContain("Engineer");
    expect(text).toContain("Remote");
  });
});

describe("fetchJobPageText", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  function htmlResponse(body: string, init: Partial<{ status: number; contentType: string }> = {}) {
    return new Response(body, {
      status: init.status ?? 200,
      headers: { "content-type": init.contentType ?? "text/html" },
    });
  }

  it("rejects a non-http(s) URL before ever calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    await expect(fetchJobPageText("ftp://example.com")).rejects.toThrow(
      "Only http(s) URLs are supported."
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an unparsable URL", async () => {
    await expect(fetchJobPageText("not a url")).rejects.toThrow(
      "That doesn't look like a valid URL."
    );
  });

  it("returns extracted text on a successful fetch", async () => {
    global.fetch = vi.fn().mockResolvedValue(htmlResponse("<p>Senior Engineer at Acme</p>"));
    const text = await fetchJobPageText("https://example.com/job");
    expect(text).toContain("Senior Engineer at Acme");
  });

  it("retries on a 503 and succeeds once the page recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse("", { status: 503 }))
      .mockResolvedValueOnce(htmlResponse("<p>Recovered posting</p>"));
    global.fetch = fetchMock;

    const promise = fetchJobPageText("https://example.com/job");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toContain("Recovered posting");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404 and fails immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse("", { status: 404 }));
    global.fetch = fetchMock;

    await expect(fetchJobPageText("https://example.com/missing")).rejects.toThrow(
      "That page returned an error (status 404)."
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a network error and eventually throws once exhausted", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    global.fetch = fetchMock;

    const promise = fetchJobPageText("https://example.com/job");
    const assertion = expect(promise).rejects.toThrow("Could not reach that URL.");
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects a non-HTML content type", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(htmlResponse("binary", { contentType: "application/pdf" }));
    await expect(fetchJobPageText("https://example.com/file.pdf")).rejects.toThrow(
      "That URL doesn't point to a readable web page."
    );
  });
});
