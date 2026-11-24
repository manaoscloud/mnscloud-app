export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  count: number;
  action?: ToastAction;
  dismissing?: boolean;
  createdAt: number;
  remainingTime: number;
}
