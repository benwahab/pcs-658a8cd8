// `fetch` cannot report how much of a request body has been sent; XMLHttpRequest can.
// This tiny transport exists only so the citizen can see the real upload progress
// (the slowest step of a report on a weak mobile connection).

export interface FormUploadRequest {
  url: string;
  headers: Record<string, string>;
  body: FormData;
  /** Called with the fraction of the body already sent, between 0 and 1. */
  onProgress?: (ratio: number) => void;
}

export interface FormUploadResponse {
  status: number;
  /** Parsed JSON body, or null when the response is empty or not JSON. */
  data: unknown;
}

export function postFormWithProgress(request: FormUploadRequest): Promise<FormUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onProgress = request.onProgress;

    xhr.open("POST", request.url);
    // No Content-Type: the browser sets the multipart boundary itself.
    for (const [name, value] of Object.entries(request.headers)) xhr.setRequestHeader(name, value);
    xhr.responseType = "text";

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(1, event.loaded / event.total));
        }
      };
    }

    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Empty or non-JSON body: the status code alone is reported.
      }
      resolve({ status: xhr.status, data });
    };
    const fail = () => reject(new Error("Réseau indisponible."));
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.onabort = fail;

    xhr.send(request.body);
  });
}
