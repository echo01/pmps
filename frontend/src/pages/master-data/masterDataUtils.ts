import { FormEvent } from 'react';
import { logger } from '../../utils/logger';

export type ModalMode = 'create' | 'edit';

export function activeQuery(value: string) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return '';
}

export function textOrNull(value?: string) {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed : null;
}

export function numberOrNull(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' ? parsed : null;
}

export function numberOrUndefined(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' ? parsed : undefined;
}

export function preventDefault(handler: () => void) {
  return (event: FormEvent) => {
    event.preventDefault();
    handler();
  };
}

export function logConflict(prefix: string, error: unknown, detail: Record<string, unknown>) {
  if (error instanceof Error && error.message.toLowerCase().includes('already')) {
    logger.warn(`${prefix}[CONFLICT]`, detail);
  }
}
