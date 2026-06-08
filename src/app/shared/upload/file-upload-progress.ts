export type FileUploadPhase =
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface FileUploadProgress<T = unknown> {
  phase: FileUploadPhase;
  percent: number | null;
  loadedBytes: number;
  totalBytes: number | null;
  speedBytesPerSecond: number | null;
  remainingSeconds: number | null;
  errorMessage?: string;
  response?: T;
}

export interface FileUploadViewModel {
  title: string;
  detail: string;
  percentLabel: string;
  progressValue: number;
  progressMode: 'determinate' | 'indeterminate';
  busy: boolean;
}

export class UploadCancelledError extends Error {
  constructor(message = 'Upload cancelled by user.') {
    super(message);
    this.name = 'UploadCancelledError';
  }
}

export function createInitialFileUploadProgress<T = unknown>(
  totalBytes: number | null = null,
): FileUploadProgress<T> {
  return {
    phase: 'preparing',
    percent: 0,
    loadedBytes: 0,
    totalBytes,
    speedBytesPerSecond: null,
    remainingSeconds: null,
  };
}

export function createFailedFileUploadProgress<T = unknown>(
  current: FileUploadProgress<T> | null,
  errorMessage: string,
  totalBytes: number | null = null,
): FileUploadProgress<T> {
  return {
    phase: 'failed',
    percent: current?.percent ?? null,
    loadedBytes: current?.loadedBytes ?? 0,
    totalBytes: current?.totalBytes ?? totalBytes,
    speedBytesPerSecond: null,
    remainingSeconds: null,
    errorMessage,
  };
}

export function createCancelledFileUploadProgress<T = unknown>(
  current: FileUploadProgress<T> | null,
): FileUploadProgress<T> {
  return {
    phase: 'cancelled',
    percent: current?.percent ?? null,
    loadedBytes: current?.loadedBytes ?? 0,
    totalBytes: current?.totalBytes ?? null,
    speedBytesPerSecond: null,
    remainingSeconds: null,
  };
}

export function buildFileUploadViewModel<T = unknown>(
  progress: FileUploadProgress<T> | null,
  active = false,
): FileUploadViewModel {
  if (!progress) {
    return {
      title: 'Ready to upload',
      detail: 'Select a file and save to begin.',
      percentLabel: '',
      progressValue: 0,
      progressMode: 'determinate',
      busy: false,
    };
  }

  const effectivePhase = effectivePhaseForView(progress, active);
  const percentLabel =
    progress.percent === null || progress.percent === undefined ? '' : `${progress.percent}%`;

  return {
    title: titleForPhase(effectivePhase),
    detail: detailForProgress(progress, effectivePhase),
    percentLabel,
    progressValue: progress.percent ?? 0,
    progressMode: progress.percent === null && active ? 'indeterminate' : 'determinate',
    busy: active || effectivePhase === 'processing',
  };
}

export function formatUploadBytes(value: number | null | undefined): string {
  if (!Number.isFinite(value) || !value || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

export function formatUploadDuration(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return 'less than 1s';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.ceil(seconds % 60);
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

function titleForPhase(phase: FileUploadPhase): string {
  if (phase === 'preparing') return 'Preparing upload';
  if (phase === 'uploading') return 'Uploading file';
  if (phase === 'processing') return 'Processing uploaded file';
  if (phase === 'completed') return 'Upload completed';
  if (phase === 'cancelled') return 'Upload cancelled';
  return 'Upload failed';
}

function effectivePhaseForView<T = unknown>(
  progress: FileUploadProgress<T>,
  active: boolean,
): FileUploadPhase {
  if (active && progress.phase === 'uploading' && progress.percent === 100) {
    return 'processing';
  }
  return progress.phase;
}

function detailForProgress<T = unknown>(
  progress: FileUploadProgress<T>,
  effectivePhase: FileUploadPhase,
): string {
  const loaded = formatUploadBytes(progress.loadedBytes);
  const total = progress.totalBytes ? formatUploadBytes(progress.totalBytes) : null;
  const speed = progress.speedBytesPerSecond
    ? `${formatUploadBytes(progress.speedBytesPerSecond)}/s`
    : null;
  const eta =
    progress.remainingSeconds !== null ? formatUploadDuration(progress.remainingSeconds) : null;

  if (effectivePhase === 'processing') {
    return 'Upload finished. Waiting for the server to finish processing.';
  }
  if (effectivePhase === 'completed') {
    return total ? `${total} uploaded successfully.` : 'File uploaded successfully.';
  }
  if (effectivePhase === 'failed') {
    return progress.errorMessage || 'The file upload failed.';
  }
  if (effectivePhase === 'cancelled') {
    return 'The upload was cancelled before completion.';
  }
  if (effectivePhase === 'uploading') {
    return [
      total ? `${loaded} of ${total}` : `${loaded} sent`,
      speed,
      eta ? `${eta} remaining` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return 'Opening secure upload stream.';
}
