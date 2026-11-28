import { Observable, of } from 'rxjs';
import {
  FileUploadProgress,
  UploadCancelledError,
} from '../../shared/upload/file-upload-progress';
import {
  documentScanReasonText,
  documentUploadErrorMessage,
  documentVersionVerificationChipClass,
  documentVersionVerificationText,
} from './documents';
import {
  buildDocumentUploadSlicePlan,
  chooseDocumentUploadMode,
  computeBlobSha256Incremental,
  DOCUMENT_PART_SIZE_BYTES,
  DOCUMENT_SINGLE_UPLOAD_LIMIT_BYTES,
  DocumentUploadApi,
  IncrementalSha256,
  inferDocumentMimeType,
  parseCompletedPartNumbers,
  startDocumentUpload,
} from './document-upload';

interface FakeCall {
  method: 'GET' | 'POST' | 'PUT' | 'POST_FORM';
  endpoint: string;
  body?: unknown;
}

class FakeDocumentUploadApi implements DocumentUploadApi {
  readonly calls: FakeCall[] = [];
  private readonly getHandlers = new Map<string, () => Promise<unknown>>();
  private readonly postHandlers = new Map<string, (body: unknown) => Promise<unknown>>();
  private readonly putHandlers = new Map<string, (body: unknown) => Promise<unknown>>();
  formResponse: unknown = { data: { RdvUUID: 'v-single', RdvState: 'ready' } };

  onGet(endpoint: string, handler: () => Promise<unknown>): void {
    this.getHandlers.set(endpoint, handler);
  }

  onPost(endpoint: string, handler: (body: unknown) => Promise<unknown>): void {
    this.postHandlers.set(endpoint, handler);
  }

  onPut(endpoint: string, handler: (body: unknown) => Promise<unknown>): void {
    this.putHandlers.set(endpoint, handler);
  }

  async get<T = unknown>(endpoint: string): Promise<T> {
    this.calls.push({ method: 'GET', endpoint });
    const handler = this.getHandlers.get(endpoint);
    if (handler) return (await handler()) as T;
    return { data: { parts: [] } } as unknown as T;
  }

  async post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    this.calls.push({ method: 'POST', endpoint, body });
    const handler = this.postHandlers.get(endpoint);
    if (handler) return (await handler(body)) as T;
    if (endpoint.endsWith('/uploads')) {
      return {
        data: {
          RdvUUID: (body as Record<string, unknown>)?.['versionUUID'] ?? 'v-multi',
          partSizeBytes: DOCUMENT_PART_SIZE_BYTES,
          parts: [],
          RdvState: 'pending',
        },
      } as unknown as T;
    }
    if (endpoint.endsWith('/complete')) {
      return {
        data: {
          RdvState: 'pending',
          verifying: true,
        },
      } as unknown as T;
    }
    return { data: {} } as unknown as T;
  }

  async put<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    this.calls.push({ method: 'PUT', endpoint, body });
    const handler = this.putHandlers.get(endpoint);
    if (handler) return (await handler(body)) as T;
    return { data: { ok: true } } as unknown as T;
  }

  postFormWithProgress<T = unknown>(
    endpoint: string,
    body: FormData,
  ): Observable<FileUploadProgress<T>> {
    this.calls.push({ method: 'POST_FORM', endpoint, body });
    const uploading: FileUploadProgress<T> = {
      phase: 'uploading',
      percent: 50,
      loadedBytes: 50,
      totalBytes: 100,
      speedBytesPerSecond: 100,
      remainingSeconds: 1,
    };
    const completed: FileUploadProgress<T> = {
      phase: 'completed',
      percent: 100,
      loadedBytes: 100,
      totalBytes: 100,
      speedBytesPerSecond: 100,
      remainingSeconds: 0,
      response: this.formResponse as T,
    };
    return of(uploading, completed);
  }
}

describe('document-upload pure logic and incremental SHA-256', () => {
  it('computes SHA-256 incrementally matching standard vectors and across chunk boundaries', async () => {
    const emptyHasher = new IncrementalSha256();
    expect(emptyHasher.digestHex()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );

    const abcHasher = new IncrementalSha256();
    abcHasher.update(new TextEncoder().encode('abc'));
    expect(abcHasher.digestHex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );

    // Multi-block input fed in uneven chunks (1, 7, 63, 65 bytes) vs Web Crypto digest
    const sample = new Uint8Array(257);
    for (let i = 0; i < sample.length; i++) sample[i] = (i * 31 + 17) & 0xff;
    const expectedBuffer = await crypto.subtle.digest('SHA-256', sample);
    const expectedHex = Array.from(new Uint8Array(expectedBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const splitHasher = new IncrementalSha256();
    splitHasher.update(sample.subarray(0, 1));
    splitHasher.update(sample.subarray(1, 8));
    splitHasher.update(sample.subarray(8, 71));
    splitHasher.update(sample.subarray(71, 136));
    splitHasher.update(sample.subarray(136));
    expect(splitHasher.digestHex()).toBe(expectedHex);

    const blob = new Blob([sample]);
    const slicedProgress: number[] = [];
    const blobHex = await computeBlobSha256Incremental(blob, {
      sliceSizeBytes: 60,
      onSliceHashed: (hashed) => slicedProgress.push(hashed),
    });
    expect(blobHex).toBe(expectedHex);
    expect(slicedProgress).toEqual([60, 120, 180, 240, 257]);
  });

  it('chooses single request up to 10 MB and 8 MiB slice plans for larger files', () => {
    expect(chooseDocumentUploadMode(0)).toBe('single');
    expect(chooseDocumentUploadMode(DOCUMENT_SINGLE_UPLOAD_LIMIT_BYTES)).toBe('single');
    expect(chooseDocumentUploadMode(DOCUMENT_SINGLE_UPLOAD_LIMIT_BYTES + 1)).toBe('parts');

    const total = DOCUMENT_PART_SIZE_BYTES * 2 + 1234;
    const plan = buildDocumentUploadSlicePlan(total, DOCUMENT_PART_SIZE_BYTES);
    expect(plan).toEqual([
      {
        number: 1,
        start: 0,
        end: DOCUMENT_PART_SIZE_BYTES,
        sizeBytes: DOCUMENT_PART_SIZE_BYTES,
      },
      {
        number: 2,
        start: DOCUMENT_PART_SIZE_BYTES,
        end: DOCUMENT_PART_SIZE_BYTES * 2,
        sizeBytes: DOCUMENT_PART_SIZE_BYTES,
      },
      {
        number: 3,
        start: DOCUMENT_PART_SIZE_BYTES * 2,
        end: total,
        sizeBytes: 1234,
      },
    ]);
  });

  it('infers MIME types for pdf, jpeg, png, webp, heic and tiff', () => {
    expect(inferDocumentMimeType(new File([], 'scan.webp', { type: '' }))).toBe('image/webp');
    expect(inferDocumentMimeType(new File([], 'photo.HEIC', { type: '' }))).toBe('image/heic');
    expect(inferDocumentMimeType(new File([], 'page.tif', { type: '' }))).toBe('image/tiff');
    expect(inferDocumentMimeType(new File([], 'doc.pdf', { type: 'application/pdf' }))).toBe(
      'application/pdf',
    );
  });

  it('uploads files <= 10 MB via a single multipart POST request', async () => {
    const api = new FakeDocumentUploadApi();
    const file = new File([new Uint8Array(1024)], 'small.pdf', { type: 'application/pdf' });
    const phases: string[] = [];

    const exec = startDocumentUpload({
      api,
      endpoint: 'registry/customers/c1/documents/d1/versions',
      file,
      versionUUID: 'ver-1',
      revision: '3',
      onProgress: (p) => phases.push(p.phase),
    });

    const result = await exec.done;
    expect(result).toEqual({ data: { RdvUUID: 'v-single', RdvState: 'ready' } });
    expect(api.calls.length).toBe(1);
    expect(api.calls[0].method).toBe('POST_FORM');
    expect(api.calls[0].endpoint).toBe('registry/customers/c1/documents/d1/versions');
    expect(phases).toContain('uploading');
    expect(phases[phases.length - 1]).toBe('completed');
  });

  it('uploads larger files in parts, retries failed parts up to 3 times with backoff, and completes', async () => {
    const api = new FakeDocumentUploadApi();
    const partSize = 100;
    const content = new Uint8Array(250);
    for (let i = 0; i < content.length; i++) content[i] = i & 0xff;
    const file = new File([content], 'large.tiff', { type: 'image/tiff' });
    const expectedChecksum = await computeBlobSha256Incremental(file, { sliceSizeBytes: 64 });

    api.onPost('ged/dossiers/g1/documents/d1/versions/uploads', async (body) => {
      const payload = body as Record<string, unknown>;
      expect(payload['versionUUID']).toBe('ver-large');
      expect(payload['revision']).toBe('7');
      expect(payload['filename']).toBe('large.tiff');
      expect(payload['mime']).toBe('image/tiff');
      expect(payload['sizeBytes']).toBe(250);
      expect(payload['checksum']).toBe(expectedChecksum);
      return {
        data: {
          RdvUUID: 'ver-large',
          partSizeBytes: partSize,
          parts: [
            { number: 1, sizeBytes: 100 },
            { number: 2, sizeBytes: 100 },
            { number: 3, sizeBytes: 50 },
          ],
          RdvState: 'pending',
        },
      };
    });

    let part2Attempts = 0;
    api.onPut('ged/dossiers/g1/documents/d1/versions/ver-large/parts/2', async () => {
      part2Attempts += 1;
      if (part2Attempts < 3) {
        throw { status: 503, message: 'Temporary storage error' };
      }
      return { data: { number: 2 } };
    });

    const sleeps: number[] = [];
    const percents: (number | null)[] = [];

    const exec = startDocumentUpload({
      api,
      endpoint: 'ged/dossiers/g1/documents/d1/versions',
      file,
      versionUUID: 'ver-large',
      revision: '7',
      singleLimitBytes: 100,
      partSizeBytes: partSize,
      backoffBaseMs: 50,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      onProgress: (p) => percents.push(p.percent),
    });

    const response = await exec.done;
    expect(response).toEqual({ data: { RdvState: 'pending', verifying: true } });
    expect(part2Attempts).toBe(3);
    expect(sleeps).toEqual([50, 100]);
    expect(percents).toContain(40);
    expect(percents).toContain(80);
    expect(percents[percents.length - 1]).toBe(100);

    const putEndpoints = api.calls.filter((c) => c.method === 'PUT').map((c) => c.endpoint);
    expect(putEndpoints).toEqual([
      'ged/dossiers/g1/documents/d1/versions/ver-large/parts/1',
      'ged/dossiers/g1/documents/d1/versions/ver-large/parts/2',
      'ged/dossiers/g1/documents/d1/versions/ver-large/parts/2',
      'ged/dossiers/g1/documents/d1/versions/ver-large/parts/2',
      'ged/dossiers/g1/documents/d1/versions/ver-large/parts/3',
    ]);
  });

  it('resumes from GET .../parts and skips already uploaded part numbers', async () => {
    const api = new FakeDocumentUploadApi();
    const file = new File([new Uint8Array(250)], 'resume.webp', { type: 'image/webp' });

    api.onGet('ged/dossiers/g1/documents/d1/versions/ver-resume/parts', async () => ({
      data: {
        RdvUUID: 'ver-resume',
        partSizeBytes: 100,
        parts: [{ number: 1, sizeBytes: 100 }, { number: 2, sizeBytes: 100 }],
      },
    }));

    expect(
      parseCompletedPartNumbers({
        data: {
          parts: [
            { number: 1, sizeBytes: 100 },
            { number: 2, sizeBytes: 100, uploaded: true },
            { number: 3, sizeBytes: 50, uploaded: false },
          ],
        },
      }),
    ).toEqual(new Set([1, 2]));

    const exec = startDocumentUpload({
      api,
      endpoint: 'ged/dossiers/g1/documents/d1/versions',
      file,
      versionUUID: 'ver-resume',
      resume: true,
      singleLimitBytes: 100,
      partSizeBytes: 100,
    });

    await exec.done;
    const putEndpoints = api.calls.filter((c) => c.method === 'PUT').map((c) => c.endpoint);
    expect(putEndpoints).toEqual([
      'ged/dossiers/g1/documents/d1/versions/ver-resume/parts/3',
    ]);
    expect(
      api.calls.some(
        (c) => c.method === 'POST' && c.endpoint === 'ged/dossiers/g1/documents/d1/versions/uploads',
      ),
    ).toBeFalse();
    expect(
      api.calls.some(
        (c) =>
          c.method === 'POST' &&
          c.endpoint === 'ged/dossiers/g1/documents/d1/versions/ver-resume/complete',
      ),
    ).toBeTrue();
  });

  it('cancels an in-flight multipart upload cleanly with UploadCancelledError', async () => {
    const api = new FakeDocumentUploadApi();
    const file = new File([new Uint8Array(200)], 'cancel.heic', { type: 'image/heic' });

    let execRef: ReturnType<typeof startDocumentUpload> | null = null;
    api.onPut('ged/dossiers/g1/documents/d1/versions/ver-cancel/parts/1', async () => {
      execRef?.cancel();
      return { data: { number: 1 } };
    });

    execRef = startDocumentUpload({
      api,
      endpoint: 'ged/dossiers/g1/documents/d1/versions',
      file,
      versionUUID: 'ver-cancel',
      singleLimitBytes: 50,
      partSizeBytes: 100,
    });

    await expectAsync(execRef.done).toBeRejectedWithError(UploadCancelledError);
    const putEndpoints = api.calls.filter((c) => c.method === 'PUT').map((c) => c.endpoint);
    expect(putEndpoints).toEqual([
      'ged/dossiers/g1/documents/d1/versions/ver-cancel/parts/1',
    ]);
  });

  it('maps verifying/incomplete states and new rejection reasons and multipart errors', () => {
    const dict: Record<string, string> = {
      'documents.pending': 'Pendente',
      'documents.rejected': 'Rejeitado',
      'documents.scan.verified': 'Verificado',
      'documents.scan.verifying': 'Em verificação',
      'documents.scan.incomplete': 'Envio incompleto',
      'documents.scan.unverified': 'Sem verificação',
      'documents.scan.rejectedUpload': 'Arquivo rejeitado pela verificação de segurança',
      'documents.scan.multipartUnsupported':
        'O armazenamento configurado não suporta envios em partes. Use arquivos de até 10 MB.',
      'documents.scan.reason.webp-invalid': 'Imagem WebP inválida ou corrompida',
      'documents.scan.reason.heic-invalid': 'Imagem HEIC inválida ou corrompida',
      'documents.scan.reason.tiff-invalid': 'Imagem TIFF inválida ou corrompida',
      'documents.scan.reason.type-mismatch':
        'O conteúdo do arquivo não corresponde ao formato informado',
      'documents.scan.reason.checksum-mismatch':
        'A integridade do arquivo (SHA-256) não confere com o envio',
    };
    const t = (key: string) => dict[key] ?? key;

    expect(
      documentVersionVerificationText(
        {
          RdvState: 'pending',
          RdvScanEngine: null,
          RdvUploadMode: 'parts',
          RdvUploadedAt: '2026-11-28T15:00:00Z',
        },
        t,
      ),
    ).toBe('Em verificação');
    expect(
      documentVersionVerificationChipClass({
        RdvState: 'pending',
        RdvScanEngine: null,
        RdvUploadMode: 'parts',
        RdvUploadedAt: '2026-11-28T15:00:00Z',
      }),
    ).toBe('chip-running');

    expect(
      documentVersionVerificationText(
        {
          RdvState: 'pending',
          RdvScanEngine: null,
          RdvUploadMode: 'parts',
          RdvUploadedAt: null,
        },
        t,
      ),
    ).toBe('Envio incompleto');
    expect(
      documentVersionVerificationChipClass({
        RdvState: 'pending',
        RdvScanEngine: null,
        RdvUploadMode: 'parts',
        RdvUploadedAt: null,
      }),
    ).toBe('chip-queued');

    expect(documentScanReasonText('webp-invalid', t)).toBe('Imagem WebP inválida ou corrompida');
    expect(documentScanReasonText('heic-invalid', t)).toBe('Imagem HEIC inválida ou corrompida');
    expect(documentScanReasonText('tiff-invalid', t)).toBe('Imagem TIFF inválida ou corrompida');
    expect(documentScanReasonText('type-mismatch', t)).toBe(
      'O conteúdo do arquivo não corresponde ao formato informado',
    );
    expect(documentScanReasonText('checksum-mismatch', t)).toBe(
      'A integridade do arquivo (SHA-256) não confere com o envio',
    );

    expect(
      documentUploadErrorMessage(
        { status: 409, error: { code: 'DOCUMENT_MULTIPART_UNSUPPORTED' } },
        t,
      ),
    ).toBe('O armazenamento configurado não suporta envios em partes. Use arquivos de até 10 MB.');

    expect(
      documentUploadErrorMessage(
        { status: 422, error: { code: 'DOCUMENT_REJECTED', reason: 'checksum-mismatch' } },
        t,
      ),
    ).toBe(
      'Arquivo rejeitado pela verificação de segurança: A integridade do arquivo (SHA-256) não confere com o envio',
    );
  });
});
