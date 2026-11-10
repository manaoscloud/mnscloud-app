import { ConfigurableCrudOption } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/** Finding priorities shared by the vulnerability (V3) and external exposure (V7) pages. */
export const priorities: ConfigurableCrudOption[] = [
  { value: 'P0', label: 'cyberSecurity.vuln.priority.P0' },
  { value: 'P1', label: 'cyberSecurity.vuln.priority.P1' },
  { value: 'P2', label: 'cyberSecurity.vuln.priority.P2' },
  { value: 'P3', label: 'cyberSecurity.vuln.priority.P3' },
  { value: 'info', label: 'cyberSecurity.vuln.priority.info' },
];

export const priorityTone = (value: unknown) => {
  switch (String(value ?? '')) {
    case 'P0':
      return 'chip-failed';
    case 'P1':
      return 'chip-warning';
    case 'P2':
      return 'chip-queued';
    case 'P3':
      return 'chip-running';
    default:
      return 'chip-skipped';
  }
};
