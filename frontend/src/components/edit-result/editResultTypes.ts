import { TemplateItem } from '../../api/qc.api';
import { ResultDraft } from '../transaction/ResultInputCell';

export type EditResultDetail = {
  id: number;
  template_item_id: number;
  item_code: string;
  item_name: string;
  check_type: string;
  measured_value?: number | string | null;
  measured_text?: string | null;
  result?: string | null;
  remark?: string | null;
  serial_number?: string | null;
  sample_label?: string | null;
};

export type EditResultDraft = ResultDraft & {
  changed: boolean;
};

export function mergeDetailWithTemplate(detail: EditResultDetail, template?: TemplateItem) {
  return {
    ...detail,
    spec_min: template?.spec_min ?? null,
    spec_max: template?.spec_max ?? null,
    unit: template?.unit ?? null,
  };
}

