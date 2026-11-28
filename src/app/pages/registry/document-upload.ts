import { firstValueFrom, Observable } from 'rxjs';
import {
  createCancelledFileUploadProgress,
  createFailedFileUploadProgress,
  createInitialFileUploadProgress,
  FileUploadPhase,
  FileUploadProgress,
  runFileUploadExecution,
  UploadCancelledError,
} from '../../shared/upload/file-upload-progress';

/** Files up to 10 MB use the single-request multipart upload; larger files use 8 MiB parts. */
export const DOCUMENT_SINGLE_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DOCUMENT_PART_SIZE_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_PART_MAX_RETRIES = 3;

export const DOCUMENT_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
] as const;

export const DOCUMENT_ACCEPT_ATTRIBUTE =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/tiff,.pdf,.jpg,.jpeg,.png,.webp,.heic,.tif,.tiff';

export const DOCUMENT_CAMERA_ACCEPT_ATTRIBUTE =
  'image/jpeg,image/png,image/webp,image/heic,image/tiff';

export type DocumentUploadMode = 'single' | 'parts';

export interface DocumentUploadSlice {
  number: number;
  start: number;
  end: number;
  sizeBytes: number;
}

export interface DocumentMultipartPartDescriptor {
  number: number;
  sizeBytes: number;
}

export interface DocumentMultipartStartResponse {
  RdvUUID: string;
  partSizeBytes: number;
  parts: readonly DocumentMultipartPartDescriptor[];
  RdvState: string;
}

export interface DocumentMultipartPartsResponse {
  RdvUUID?: string;
  partSizeBytes?: number;
  parts?: readonly (number | { number: number; sizeBytes?: number })[];
  uploadedParts?: readonly (number | { number: number; sizeBytes?: number })[];
}

export interface DocumentMultipartCompleteResponse {
  RdvState: string;
  verifying?: boolean;
}

export interface DocumentUploadApi {
  post<T = unknown>(endpoint: string, body: unknown): Promise<T>;
  put<T = unknown>(endpoint: string, body: unknown): Promise<T>;
  get<T = unknown>(endpoint: string): Promise<T>;
  postFormWithProgress<T = unknown>(
    endpoint: string,
    body: FormData,
  ): Observable<FileUploadProgress<T>>;
}

export interface DocumentUploadOptions {
  api: DocumentUploadApi;
  endpoint: string;
  file: Blob & { readonly name?: string };
  versionUUID: string;
  revision?: unknown;
  resume?: boolean;
  partSizeBytes?: number;
  singleLimitBytes?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onProgress?: (progress: FileUploadProgress<unknown>) => void;
  signal?: AbortSignal;
}

export interface DocumentUploadExecution<T = unknown> {
  done: Promise<T>;
  cancel: () => void;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * Small incremental SHA-256 implementation so large files can be hashed over 8 MiB slices in the
 * browser without loading the whole file into memory at once (Web Crypto `crypto.subtle.digest`
 * does not support streaming).
 */
export class IncrementalSha256 {
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly buffer = new Uint8Array(64);
  private readonly schedule = new Uint32Array(64);
  private buffered = 0;
  private totalBytes = 0;
  private finalized = false;

  update(chunk: Uint8Array): this {
    if (this.finalized) throw new Error('SHA-256 state is already finalized.');
    let offset = 0;
    let remaining = chunk.byteLength;
    this.totalBytes += remaining;

    if (this.buffered > 0) {
      const take = Math.min(64 - this.buffered, remaining);
      this.buffer.set(chunk.subarray(0, take), this.buffered);
      this.buffered += take;
      offset += take;
      remaining -= take;
      if (this.buffered === 64) {
        this.processBlock(this.buffer, 0);
        this.buffered = 0;
      }
    }

    while (remaining >= 64) {
      this.processBlock(chunk, offset);
      offset += 64;
      remaining -= 64;
    }

    if (remaining > 0) {
      this.buffer.set(chunk.subarray(offset, offset + remaining), 0);
      this.buffered = remaining;
    }

    return this;
  }

  digestHex(): string {
    if (this.finalized) throw new Error('SHA-256 state is already finalized.');
    this.finalized = true;

    const totalBitsLow = (this.totalBytes * 8) >>> 0;
    const totalBitsHigh = Math.floor((this.totalBytes * 8) / 0x100000000) >>> 0;

    this.buffer[this.buffered++] = 0x80;
    if (this.buffered > 56) {
      this.buffer.fill(0, this.buffered, 64);
      this.processBlock(this.buffer, 0);
      this.buffered = 0;
    }
    this.buffer.fill(0, this.buffered, 56);

    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, 64);
    view.setUint32(56, totalBitsHigh, false);
    view.setUint32(60, totalBitsLow, false);
    this.processBlock(this.buffer, 0);

    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += (this.state[i] >>> 0).toString(16).padStart(8, '0');
    }
    return hex;
  }

  private processBlock(block: Uint8Array, offset: number): void {
    const w = this.schedule;
    const view = new DataView(block.buffer, block.byteOffset + offset, 64);
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = (((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)) >>> 0;
      const s1 = (((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = this.state;
    for (let i = 0; i < 64; i++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    this.state[0] = (this.state[0] + a) >>> 0;
    this.state[1] = (this.state[1] + b) >>> 0;
    this.state[2] = (this.state[2] + c) >>> 0;
    this.state[3] = (this.state[3] + d) >>> 0;
    this.state[4] = (this.state[4] + e) >>> 0;
    this.state[5] = (this.state[5] + f) >>> 0;
    this.state[6] = (this.state[6] + g) >>> 0;
    this.state[7] = (this.state[7] + h) >>> 0;
  }
}

/**
 * Computes the SHA-256 hex digest of a Blob/File incrementally over 8 MiB slices, never holding
 * more than one slice in memory at a time.
 */
export async function computeBlobSha256Incremental(
  blob: Blob,
  options: {
    sliceSizeBytes?: number;
    signal?: AbortSignal;
    onSliceHashed?: (hashedBytes: number, totalBytes: number) => void;
  } = {},
): Promise<string> {
  const sliceSize = Math.max(1, options.sliceSizeBytes ?? DOCUMENT_PART_SIZE_BYTES);
  const hasher = new IncrementalSha256();
  const total = blob.size;
  let offset = 0;

  while (offset < total) {
    if (options.signal?.aborted) throw new UploadCancelledError();
    const end = Math.min(offset + sliceSize, total);
    const slice = blob.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    if (options.signal?.aborted) throw new UploadCancelledError();
    hasher.update(new Uint8Array(buffer));
    offset = end;
    options.onSliceHashed?.(offset, total);
  }

  return hasher.digestHex();
}

/** Chooses `'single'` for files up to 10 MB (unless resuming a multipart version) and `'parts'` for larger files. */
export function chooseDocumentUploadMode(
  sizeBytes: number,
  singleLimitBytes = DOCUMENT_SINGLE_UPLOAD_LIMIT_BYTES,
): DocumentUploadMode {
  return sizeBytes <= singleLimitBytes ? 'single' : 'parts';
}

/** Builds the 1-indexed slice plan for a file of `totalBytes` in `partSizeBytes` chunks (default 8 MiB). */
export function buildDocumentUploadSlicePlan(
  totalBytes: number,
  partSizeBytes = DOCUMENT_PART_SIZE_BYTES,
): DocumentUploadSlice[] {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return [];
  const step = Math.max(1, Math.floor(partSizeBytes));
  const slices: DocumentUploadSlice[] = [];
  let start = 0;
  let number = 1;
  while (start < totalBytes) {
    const end = Math.min(start + step, totalBytes);
    slices.push({
      number,
      start,
      end,
      sizeBytes: end - start,
    });
    start = end;
    number += 1;
  }
  return slices;
}

/** Infers the canonical MIME type from the File's type or extension for the multipart initiate call. */
export function inferDocumentMimeType(file: Blob & { readonly name?: string }): string {
  const declared = (file.type || '').trim().toLowerCase();
  if (declared === 'image/jpg') return 'image/jpeg';
  if (declared === 'image/x-tiff') return 'image/tiff';
  if (declared === 'image/heif') return 'image/heic';
  if (declared) return declared;
  const name = (file.name || '').trim().toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff';
  return 'application/octet-stream';
}

/** Extracts the set of already-uploaded 1-indexed part numbers from a `GET .../parts` response. */
export function parseCompletedPartNumbers(response: unknown): Set<number> {
  const body = unwrapData<DocumentMultipartPartsResponse & Record<string, unknown>>(response);
  const completed = new Set<number>();
  if (!body || typeof body !== 'object') return completed;

  const list = Array.isArray(body.uploadedParts)
    ? body.uploadedParts
    : Array.isArray(body.parts)
      ? body.parts
      : [];
  for (const entry of list) {
    if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 1) {
      completed.add(entry);
    } else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const num = Number(record['number'] ?? record['partNumber']);
      const uploaded =
        record['uploaded'] !== false &&
        record['completed'] !== false &&
        record['state'] !== 'pending';
      if (Number.isInteger(num) && num >= 1 && uploaded) {
        completed.add(num);
      }
    }
  }
  return completed;
}

function unwrapData<T>(response: unknown): T | null {
  if (!response || typeof response !== 'object') return null;
  const record = response as Record<string, unknown>;
  if (record['data'] && typeof record['data'] === 'object') {
    return record['data'] as T;
  }
  return record as unknown as T;
}

function isNonRetryablePartError(error: unknown): boolean {
  if (error instanceof UploadCancelledError) return true;
  const status = Number((error as { status?: unknown } | null)?.status ?? 0);
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Starts a cancellable single-request or resumable multipart document version upload.
 *
 * - Files up to 10 MB use `POST <endpoint>` (multipart form with `file`, `versionUUID`, `revision`).
 * - Larger files compute the SHA-256 incrementally over 8 MiB slices, initiate (or resume via
 *   `GET <endpoint>/:versionUUID/parts`), upload missing slices via
 *   `PUT <endpoint>/:versionUUID/parts/:number` with up to 3 retries with backoff, and finalize via
 *   `POST <endpoint>/:versionUUID/complete`.
 */
export function startDocumentUpload(
  options: DocumentUploadOptions,
): DocumentUploadExecution<unknown> {
  const controller = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let currentProgress: FileUploadProgress<unknown> = createInitialFileUploadProgress(
    options.file.size,
  );
  const emitProgress = (next: FileUploadProgress<unknown>) => {
    currentProgress = next;
    options.onProgress?.(next);
  };

  const done = runDocumentUploadInternal(options, controller.signal, emitProgress, () => currentProgress);

  return {
    done,
    cancel: () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    },
  };
}

/** Convenience Observable wrapper around `startDocumentUpload` for `runManagedFileUpload`. */
export function documentUploadObservable(
  options: Omit<DocumentUploadOptions, 'onProgress' | 'signal'>,
): Observable<FileUploadProgress<unknown>> {
  return new Observable<FileUploadProgress<unknown>>((subscriber) => {
    const execution = startDocumentUpload({
      ...options,
      onProgress: (progress) => subscriber.next(progress),
    });
    execution.done.then(
      (response) => {
        subscriber.next({
          phase: 'completed',
          percent: 100,
          loadedBytes: options.file.size,
          totalBytes: options.file.size,
          speedBytesPerSecond: null,
          remainingSeconds: 0,
          response,
        });
        subscriber.complete();
      },
      (error: unknown) => {
        if (!(error instanceof UploadCancelledError)) {
          subscriber.error(error);
        }
      },
    );
    return () => execution.cancel();
  });
}

async function runDocumentUploadInternal(
  options: DocumentUploadOptions,
  signal: AbortSignal,
  emitProgress: (progress: FileUploadProgress<unknown>) => void,
  getCurrentProgress: () => FileUploadProgress<unknown>,
): Promise<unknown> {
  const {
    api,
    endpoint,
    file,
    versionUUID,
    revision,
    singleLimitBytes = DOCUMENT_SINGLE_UPLOAD_LIMIT_BYTES,
    maxRetries = DOCUMENT_PART_MAX_RETRIES,
    backoffBaseMs = 200,
    sleep = defaultSleep,
    now = () => performance.now(),
  } = options;

  const assertNotCancelled = () => {
    if (signal.aborted) {
      emitProgress(createCancelledFileUploadProgress(getCurrentProgress()));
      throw new UploadCancelledError();
    }
  };

  assertNotCancelled();
  emitProgress(createInitialFileUploadProgress(file.size));

  const mode = chooseDocumentUploadMode(file.size, singleLimitBytes);
  if (mode === 'single') {
    const form = new FormData();
    form.append('versionUUID', versionUUID);
    if (revision !== undefined && revision !== null && revision !== '') {
      form.append('revision', String(revision));
    }
    const filename = file.name || 'document';
    form.append('file', file, filename);

    let lastSingleProgress: FileUploadProgress<unknown> = createInitialFileUploadProgress(file.size);
    const singleExec = runFileUploadExecution<unknown>({
      fileSize: file.size,
      source: api.postFormWithProgress<unknown>(endpoint, form),
      setProgress: (progress) => {
        lastSingleProgress = progress;
        if (!signal.aborted) emitProgress(progress);
      },
      currentProgress: () => lastSingleProgress,
      errorMessage: (error) =>
        (error as { message?: string } | null)?.message || 'The file upload failed.',
    });
    const onAbort = () => singleExec.cancel();
    if (signal.aborted) {
      singleExec.cancel();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    try {
      await singleExec.done;
      assertNotCancelled();
      return lastSingleProgress.response;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  // Multipart resumable upload (> 10 MB)
  let partSizeBytes = options.partSizeBytes ?? DOCUMENT_PART_SIZE_BYTES;
  const completedParts = new Set<number>();

  if (options.resume) {
    assertNotCancelled();
    try {
      const partsResponse = await api.get<unknown>(
        `${endpoint}/${encodeURIComponent(versionUUID)}/parts`,
      );
      const unwrapped = unwrapData<DocumentMultipartPartsResponse>(partsResponse);
      if (
        unwrapped &&
        typeof unwrapped.partSizeBytes === 'number' &&
        unwrapped.partSizeBytes > 0
      ) {
        partSizeBytes = unwrapped.partSizeBytes;
      }
      for (const num of parseCompletedPartNumbers(partsResponse)) {
        completedParts.add(num);
      }
    } catch (error) {
      const status = Number((error as { status?: unknown } | null)?.status ?? 0);
      if (status !== 404) throw error;
    }
  }

  const checksum = await computeBlobSha256Incremental(file, {
    sliceSizeBytes: partSizeBytes,
    signal,
  });
  assertNotCancelled();

  if (!options.resume || completedParts.size === 0) {
    const startResponse = await api.post<unknown>(`${endpoint}/uploads`, {
      versionUUID,
      ...(revision !== undefined && revision !== null && revision !== ''
        ? { revision }
        : {}),
      filename: file.name || 'document',
      mime: inferDocumentMimeType(file),
      sizeBytes: file.size,
      checksum,
    });
    assertNotCancelled();
    const started = unwrapData<DocumentMultipartStartResponse>(startResponse);
    if (started && typeof started.partSizeBytes === 'number' && started.partSizeBytes > 0) {
      partSizeBytes = started.partSizeBytes;
    }
    if (options.resume && completedParts.size === 0) {
      try {
        const partsResponse = await api.get<unknown>(
          `${endpoint}/${encodeURIComponent(versionUUID)}/parts`,
        );
        for (const num of parseCompletedPartNumbers(partsResponse)) {
          completedParts.add(num);
        }
      } catch {
        // Fresh session has no uploaded parts yet.
      }
    }
  }

  const slices = buildDocumentUploadSlicePlan(file.size, partSizeBytes);
  const totalBytes = file.size;
  let loadedBytes = slices
    .filter((slice) => completedParts.has(slice.number))
    .reduce((sum, slice) => sum + slice.sizeBytes, 0);

  let lastMeasuredAt = now();
  let currentSpeed: number | null = null;

  const emitPartProgress = (phase: FileUploadPhase) => {
    const percent =
      totalBytes > 0 ? Math.min(100, Math.max(0, Math.round((loadedBytes / totalBytes) * 100))) : 100;
    const remainingSeconds =
      phase === 'uploading' && currentSpeed && currentSpeed > 0
        ? Math.max(0, Math.ceil((totalBytes - loadedBytes) / currentSpeed))
        : phase === 'completed'
          ? 0
          : null;
    emitProgress({
      phase,
      percent: phase === 'completed' ? 100 : percent,
      loadedBytes: phase === 'completed' ? totalBytes : loadedBytes,
      totalBytes,
      speedBytesPerSecond: currentSpeed,
      remainingSeconds,
    });
  };

  emitPartProgress('uploading');

  for (const slice of slices) {
    assertNotCancelled();
    if (completedParts.has(slice.number)) continue;

    const partBlob = file.slice(slice.start, slice.end, 'application/octet-stream');
    let attempt = 0;
    while (true) {
      assertNotCancelled();
      const attemptStartedAt = now();
      try {
        await api.put<unknown>(
          `${endpoint}/${encodeURIComponent(versionUUID)}/parts/${slice.number}`,
          partBlob,
        );
        assertNotCancelled();
        const elapsedSeconds = Math.max((now() - attemptStartedAt) / 1000, 0.001);
        const instantSpeed = Math.max(slice.sizeBytes / elapsedSeconds, 0);
        currentSpeed =
          currentSpeed === null ? instantSpeed : currentSpeed * 0.7 + instantSpeed * 0.3;
        lastMeasuredAt = now();
        loadedBytes += slice.sizeBytes;
        completedParts.add(slice.number);
        emitPartProgress('uploading');
        break;
      } catch (error) {
        assertNotCancelled();
        attempt += 1;
        if (isNonRetryablePartError(error) || attempt > maxRetries) {
          const message =
            (error as { message?: string } | null)?.message || 'The file upload failed.';
          emitProgress(createFailedFileUploadProgress(getCurrentProgress(), message, totalBytes));
          throw error;
        }
        const delayMs = backoffBaseMs * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
    }
  }

  assertNotCancelled();
  void lastMeasuredAt;
  emitPartProgress('processing');

  const completeResponse = await api.post<unknown>(
    `${endpoint}/${encodeURIComponent(versionUUID)}/complete`,
    {},
  );
  assertNotCancelled();

  emitProgress({
    phase: 'completed',
    percent: 100,
    loadedBytes: totalBytes,
    totalBytes,
    speedBytesPerSecond: currentSpeed,
    remainingSeconds: 0,
    response: completeResponse,
  });

  return completeResponse;
}

export { firstValueFrom };
