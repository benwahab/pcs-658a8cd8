import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postFormWithProgress } from "../../src/pcs/lib/uploadWithProgress";
import { expectCode } from "../support/code";

class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  responseType = "";
  responseText = "";
  status = 0;
  sent: unknown = null;
  upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.sent = body;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("postFormWithProgress", () => {
  it("posts the form without Content-Type and reports progress between 0 and 1", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const body = new FormData();
    const ratios: number[] = [];
    const promise = postFormWithProgress({
      url: "https://x.test/fn",
      headers: { apikey: "k", Authorization: "Bearer t" },
      body,
      onProgress: (r) => ratios.push(r),
    });
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe("POST");
    expect(xhr.sent).toBe(body);
    expect(xhr.headers).toEqual({ apikey: "k", Authorization: "Bearer t" });

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 50, total: 0 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 120, total: 100 });
    expect(ratios).toEqual([0.25, 1]);

    xhr.status = 200;
    xhr.responseText = JSON.stringify({ success: true });
    xhr.onload?.();
    await expect(promise).resolves.toEqual({ status: 200, data: { success: true } });
  });

  it("returns null data for a non-JSON response and keeps the status", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = postFormWithProgress({ url: "u", headers: {}, body: new FormData() });
    FakeXhr.last.status = 502;
    FakeXhr.last.responseText = "<html>";
    FakeXhr.last.onload?.();
    await expect(promise).resolves.toEqual({ status: 502, data: null });
  });

  it("rejects when the network fails", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = postFormWithProgress({ url: "u", headers: {}, body: new FormData() });
    FakeXhr.last.onerror?.();
    await expect(promise).rejects.toThrow("Réseau indisponible.");
  });
});

describe("report submission wiring", () => {
  const reports = readFileSync(resolve(process.cwd(), "src/pcs/lib/reports.ts"), "utf8");
  const form = readFileSync(resolve(process.cwd(), "src/pcs/pages/ReportForm.tsx"), "utf8");

  it("sends the report through the progress transport on the same endpoint", () => {
    expectCode(reports).toContain("/functions/v1/citizen-report-submit");
    expectCode(reports).toContain("onProgress: onUploadProgress,");
    expectCode(reports).toContain("if (response.status < 200 || response.status >= 300) {");
  });

  it("shows a progressbar while saving and clears it afterwards", () => {
    expectCode(form).toContain('role="progressbar"');
    expectCode(form).toContain("setUploadProgress(null);");
  });
});
