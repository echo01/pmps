export type CheckType = 'NUMERIC' | 'BOOLEAN' | 'TEXT' | string;
export type PreviewResult = 'PASS' | 'FAIL' | 'N/A';

export type ResultPreviewItem = {
  check_type?: CheckType | null;
  spec_min?: number | string | null;
  spec_max?: number | string | null;
  measured_value?: number | string | null;
  measured_text?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculatePreviewResult(item: ResultPreviewItem): PreviewResult {
  const checkType = (item.check_type || '').toUpperCase();

  if (checkType === 'NUMERIC') {
    const value = toNumber(item.measured_value);
    if (value === null) return 'N/A';

    const min = toNumber(item.spec_min);
    const max = toNumber(item.spec_max);

    if (min !== null && value < min) return 'FAIL';
    if (max !== null && value > max) return 'FAIL';
    return 'PASS';
  }

  if (checkType === 'BOOLEAN') {
    const text = (item.measured_text || '').trim().toUpperCase();
    if (['OK', 'PASS', 'YES', 'TRUE'].includes(text)) return 'PASS';
    if (['NG', 'FAIL', 'NO', 'FALSE'].includes(text)) return 'FAIL';
    return 'N/A';
  }

  if ((item.measured_text || '').trim()) return 'PASS';
  return 'N/A';
}

export function calculateOverallResult(results: PreviewResult[]): PreviewResult {
  if (!results.length || results.every((result) => result === 'N/A')) return 'N/A';
  return results.includes('FAIL') ? 'FAIL' : 'PASS';
}

export function normalizeMeasuredValue(value: string) {
  return value.trim() === '' ? null : Number(value);
}

export function normalizeMeasuredText(value: string) {
  return value.trim() === '' ? null : value.trim();
}
