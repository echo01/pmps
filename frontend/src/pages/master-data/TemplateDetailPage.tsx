import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { testTemplatesApi, TemplateItem, TemplateSection } from '../../api/testTemplates.api';
import { BooleanBadge, CheckTypeBadge, TemplateTypeBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { logger } from '../../utils/logger';
import { numberOrNull, numberOrUndefined, textOrNull } from './masterDataUtils';

const emptySectionForm = { section_code: '', section_name: '', seq_no: '1' };
const emptyItemForm = {
  section_id: '',
  seq_no: '1',
  item_code: '',
  item_name: '',
  check_type: 'NUMERIC',
  spec_min: '',
  spec_max: '',
  expect_value: '',
  expect_text: '',
  unit: '',
  mandatory: true,
  active: true,
  remark: '',
};

export function TemplateDetailPage() {
  const { templateId = '' } = useParams();
  const queryClient = useQueryClient();
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<number | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [formError, setFormError] = useState<string | null>(null);

  const template = useQuery({ queryKey: ['test-template-detail', templateId], queryFn: () => testTemplatesApi.getTestTemplateById(templateId) });
  const sections = useQuery({ queryKey: ['template-sections', templateId], queryFn: () => testTemplatesApi.getTemplateSections(templateId) });
  const items = useQuery({ queryKey: ['template-items', templateId], queryFn: () => testTemplatesApi.getTemplateItems(templateId) });

  const saveSection = useMutation({
    mutationFn: async () => {
      if (!sectionForm.section_name.trim()) throw new Error('section_name is required');
      if (Number(sectionForm.seq_no) <= 0) throw new Error('seq_no must be greater than 0');
      const payload = { section_code: textOrNull(sectionForm.section_code), section_name: sectionForm.section_name.trim(), seq_no: Number(sectionForm.seq_no) };
      logger.info('[TEMPLATE][SECTION_SAVE][START]', { templateId, section_name: payload.section_name });
      return editingSectionId ? testTemplatesApi.updateTemplateSection(editingSectionId, payload) : testTemplatesApi.createTemplateSection(templateId, payload);
    },
    onSuccess: (row) => {
      logger.info('[TEMPLATE][SECTION_SAVE][API_SUCCESS]', { sectionId: row.id });
      closeSectionModal();
      queryClient.invalidateQueries({ queryKey: ['template-sections', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-items', templateId] });
    },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!itemForm.item_name.trim()) throw new Error('item_name is required');
      if (Number(itemForm.seq_no) <= 0) throw new Error('seq_no must be greater than 0');
      const specMin = numberOrNull(itemForm.spec_min);
      const specMax = numberOrNull(itemForm.spec_max);
      if (itemForm.check_type === 'NUMERIC' && specMin !== null && specMax !== null && specMin > specMax) {
        throw new Error('spec_min must be less than or equal to spec_max');
      }
      const payload = {
        section_id: numberOrNull(itemForm.section_id),
        seq_no: Number(itemForm.seq_no),
        item_code: textOrNull(itemForm.item_code),
        item_name: itemForm.item_name.trim(),
        check_type: itemForm.check_type as TemplateItem['check_type'],
        spec_min: itemForm.check_type === 'NUMERIC' ? specMin : null,
        spec_max: itemForm.check_type === 'NUMERIC' ? specMax : null,
        expect_value: itemForm.check_type === 'BOOLEAN' ? numberOrUndefined(itemForm.expect_value) : null,
        expect_text: itemForm.check_type !== 'NUMERIC' ? textOrNull(itemForm.expect_text) : null,
        input_unit: itemForm.check_type === 'NUMERIC' ? textOrNull(itemForm.unit) : null,
        mandatory: itemForm.mandatory,
        active: itemForm.active,
        remark: textOrNull(itemForm.remark),
      };
      logger.info('[TEMPLATE][ITEM_SAVE][START]', { templateId, item_name: payload.item_name, check_type: payload.check_type });
      return editingItemId ? testTemplatesApi.updateTemplateItem(editingItemId, payload) : testTemplatesApi.createTemplateItem(templateId, payload);
    },
    onSuccess: (row) => {
      logger.info('[TEMPLATE][ITEM_SAVE][API_SUCCESS]', { itemId: row.id });
      closeItemModal();
      queryClient.invalidateQueries({ queryKey: ['template-items', templateId] });
    },
  });

  const deleteSection = useMutation({
    mutationFn: () => testTemplatesApi.deleteTemplateSection(deleteSectionId || 0),
    onSuccess: () => {
      setDeleteSectionId(null);
      queryClient.invalidateQueries({ queryKey: ['template-sections', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-items', templateId] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: () => testTemplatesApi.deleteTemplateItem(deleteItemId || 0),
    onSuccess: () => {
      setDeleteItemId(null);
      queryClient.invalidateQueries({ queryKey: ['template-items', templateId] });
    },
  });

  function openSection(row?: TemplateSection) {
    setEditingSectionId(row?.id || null);
    setSectionForm(row ? { section_code: row.section_code || '', section_name: row.section_name, seq_no: String(row.seq_no) } : { ...emptySectionForm, seq_no: String((sections.data?.length || 0) + 1) });
    setFormError(null);
    setSectionModalOpen(true);
  }

  function closeSectionModal() {
    setEditingSectionId(null);
    setFormError(null);
    setSectionModalOpen(false);
  }

  function openItem(row?: TemplateItem) {
    setEditingItemId(row?.id || null);
    setItemForm(row ? {
      section_id: row.section_id ? String(row.section_id) : '',
      seq_no: String(row.seq_no),
      item_code: row.item_code || '',
      item_name: row.item_name || row.test_point || '',
      check_type: row.check_type || 'NUMERIC',
      spec_min: row.spec_min === null || row.spec_min === undefined ? '' : String(row.spec_min),
      spec_max: row.spec_max === null || row.spec_max === undefined ? '' : String(row.spec_max),
      expect_value: row.expect_value === null || row.expect_value === undefined ? '' : String(row.expect_value),
      expect_text: row.expect_text || '',
      unit: row.unit || row.input_unit || row.source_unit || '',
      mandatory: row.mandatory,
      active: row.active,
      remark: row.remark || '',
    } : { ...emptyItemForm, seq_no: String((items.data?.length || 0) + 1), section_id: sections.data?.[0]?.id ? String(sections.data[0].id) : '' });
    setFormError(null);
    setItemModalOpen(true);
  }

  function closeItemModal() {
    setEditingItemId(null);
    setFormError(null);
    setItemModalOpen(false);
  }

  function submitSection() {
    if (!sectionForm.section_name.trim()) return setFormError('section_name is required');
    if (Number(sectionForm.seq_no) <= 0) return setFormError('seq_no must be greater than 0');
    setFormError(null);
    saveSection.mutate();
  }

  function submitItem() {
    if (!itemForm.item_name.trim()) return setFormError('item_name is required');
    if (Number(itemForm.seq_no) <= 0) return setFormError('seq_no must be greater than 0');
    const specMin = numberOrNull(itemForm.spec_min);
    const specMax = numberOrNull(itemForm.spec_max);
    if (itemForm.check_type === 'NUMERIC' && specMin !== null && specMax !== null && specMin > specMax) {
      return setFormError('spec_min must be less than or equal to spec_max');
    }
    setFormError(null);
    saveItem.mutate();
  }

  if (template.isLoading) return <LoadingPanel />;
  if (template.error) return <ErrorAlert error={template.error} />;
  if (!template.data) return <EmptyState message="Template not found" />;

  const sectionOptions = (sections.data || []).map((row) => ({ value: row.id, label: `${row.seq_no}. ${row.section_name}` }));
  const groupedItems = (sections.data || []).map((section) => ({
    section,
    items: (items.data || []).find((group) => group.section_id === section.id)?.items || [],
  }));
  const ungroupedItems = (items.data || [])
    .filter((group) => !group.section_id)
    .flatMap((group) => group.items);

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div><Link className="backLink" to="/templates">Back to Templates</Link><h1>{template.data.template_name}</h1></div>
      </div>
      <section className="panel">
        <dl className="kvGrid">
          <div><dt>Assigned Models</dt><dd>{template.data.model_codes?.length ? template.data.model_codes.join(', ') : 'Not assigned'}</dd></div>
          <div><dt>Type</dt><dd><TemplateTypeBadge value={template.data.template_type} /></dd></div>
          <div><dt>Revision</dt><dd>{template.data.revision}</dd></div>
          <div><dt>Active</dt><dd><BooleanBadge value={template.data.active} /></dd></div>
        </dl>
      </section>
      <section className="panel">
        <div className="sectionHeader"><h2>Sections</h2><button className="primaryButton" type="button" onClick={() => openSection()}>Add Section</button></div>
        {sections.isLoading ? <LoadingPanel /> : null}
        {sections.error ? <ErrorAlert error={sections.error} /> : null}
        {sections.data?.length === 0 ? <EmptyState message="No sections found" /> : null}
        {sections.data?.length ? (
          <table><thead><tr><th>Seq</th><th>Code</th><th>Name</th><th>Action</th></tr></thead>
            <tbody>{sections.data.map((row) => <tr key={row.id}><td>{row.seq_no}</td><td>{row.section_code || '-'}</td><td>{row.section_name}</td><td><button className="textButton" onClick={() => openSection(row)}><Edit size={16} /> Edit</button> <button className="textButton dangerText" onClick={() => setDeleteSectionId(row.id)}><Trash2 size={16} /> Delete</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <section className="panel">
        <div className="sectionHeader"><h2>Template Items</h2><button className="primaryButton" type="button" onClick={() => openItem()}>Add Item</button></div>
        {items.isLoading ? <LoadingPanel /> : null}
        {items.error ? <ErrorAlert error={items.error} /> : null}
        {items.data?.length === 0 ? <EmptyState message="No items found" /> : null}
        {groupedItems.map((group) => group.items.length ? <ItemTable key={group.section.id} title={`${group.section.seq_no}. ${group.section.section_name}`} items={group.items} onEdit={openItem} onDelete={setDeleteItemId} /> : null)}
        {ungroupedItems.length ? <ItemTable title="No Section" items={ungroupedItems} onEdit={openItem} onDelete={setDeleteItemId} /> : null}
      </section>
      <MasterDataFormModal open={sectionModalOpen} title={editingSectionId ? 'Edit Section' : 'Add Section'} error={saveSection.error} saving={saveSection.isPending} onClose={closeSectionModal} onSubmit={submitSection}>
        <FormFieldError message={formError} />
        <label>Seq No<input type="number" min="1" value={sectionForm.seq_no} onChange={(event) => setSectionForm({ ...sectionForm, seq_no: event.target.value })} /></label>
        <label>Section Code<input value={sectionForm.section_code} onChange={(event) => setSectionForm({ ...sectionForm, section_code: event.target.value })} /></label>
        <label>Section Name<input value={sectionForm.section_name} onChange={(event) => setSectionForm({ ...sectionForm, section_name: event.target.value })} /></label>
      </MasterDataFormModal>
      <MasterDataFormModal open={itemModalOpen} title={editingItemId ? 'Edit Item' : 'Add Item'} error={saveItem.error} saving={saveItem.isPending} onClose={closeItemModal} onSubmit={submitItem}>
        <FormFieldError message={formError} />
        <div className="formGrid modalGrid">
          <label>Section<select value={itemForm.section_id} onChange={(event) => setItemForm({ ...itemForm, section_id: event.target.value })}><option value="">No section</option>{sectionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Seq No<input type="number" min="1" value={itemForm.seq_no} onChange={(event) => setItemForm({ ...itemForm, seq_no: event.target.value })} /></label>
          <label>Item Code<input value={itemForm.item_code} onChange={(event) => setItemForm({ ...itemForm, item_code: event.target.value })} /></label>
          <label>Item Name<input value={itemForm.item_name} onChange={(event) => setItemForm({ ...itemForm, item_name: event.target.value })} /></label>
          <label>Check Type<select value={itemForm.check_type} onChange={(event) => setItemForm({ ...itemForm, check_type: event.target.value })}><option value="NUMERIC">NUMERIC</option><option value="BOOLEAN">BOOLEAN</option><option value="TEXT">TEXT</option></select></label>
          {itemForm.check_type === 'NUMERIC' ? (
            <>
              <label>Spec Min<input type="number" value={itemForm.spec_min} onChange={(event) => setItemForm({ ...itemForm, spec_min: event.target.value })} /></label>
              <label>Spec Max<input type="number" value={itemForm.spec_max} onChange={(event) => setItemForm({ ...itemForm, spec_max: event.target.value })} /></label>
              <label>Unit<input value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} /></label>
            </>
          ) : null}
          {itemForm.check_type === 'BOOLEAN' ? (
            <>
              <label>Expect Value<input type="number" value={itemForm.expect_value} onChange={(event) => setItemForm({ ...itemForm, expect_value: event.target.value })} /></label>
              <label>Expect Text<input placeholder="OK / NG / YES / NO" value={itemForm.expect_text} onChange={(event) => setItemForm({ ...itemForm, expect_text: event.target.value })} /></label>
            </>
          ) : null}
          {itemForm.check_type === 'TEXT' ? <label>Expect Text<input value={itemForm.expect_text} onChange={(event) => setItemForm({ ...itemForm, expect_text: event.target.value })} /></label> : null}
          <label>Remark<input value={itemForm.remark} onChange={(event) => setItemForm({ ...itemForm, remark: event.target.value })} /></label>
          <label className="checkRow"><input type="checkbox" checked={itemForm.mandatory} onChange={(event) => setItemForm({ ...itemForm, mandatory: event.target.checked })} /> Mandatory</label>
          <label className="checkRow"><input type="checkbox" checked={itemForm.active} onChange={(event) => setItemForm({ ...itemForm, active: event.target.checked })} /> Active</label>
        </div>
      </MasterDataFormModal>
      <ConfirmDialog open={deleteSectionId !== null} title="Delete Section" message="This deletes the section. Items may become ungrouped depending on database constraints." confirming={deleteSection.isPending} onCancel={() => setDeleteSectionId(null)} onConfirm={() => deleteSection.mutate()} />
      <ConfirmDialog open={deleteItemId !== null} title="Delete Item" message="This deletes the template item." confirming={deleteItem.isPending} onCancel={() => setDeleteItemId(null)} onConfirm={() => deleteItem.mutate()} />
    </div>
  );
}

function ItemTable({ title, items, onEdit, onDelete }: { title: string; items: TemplateItem[]; onEdit: (item: TemplateItem) => void; onDelete: (id: number) => void }) {
  return (
    <div className="subPanel">
      <h2>{title}</h2>
      <table><thead><tr><th>Seq</th><th>Code</th><th>Name</th><th>Type</th><th>Spec</th><th>Mandatory</th><th>Active</th><th>Action</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}><td>{item.seq_no}</td><td>{item.item_code || '-'}</td><td>{item.item_name || item.test_point}</td><td><CheckTypeBadge value={item.check_type} /></td><td>{item.check_type === 'NUMERIC' ? `${item.spec_min ?? '-'} - ${item.spec_max ?? '-'} ${item.unit || ''}` : item.expect_text || item.expect_value || '-'}</td><td><BooleanBadge value={item.mandatory} trueLabel="Mandatory" falseLabel="Optional" /></td><td><BooleanBadge value={item.active} /></td><td><button className="textButton" onClick={() => onEdit(item)}><Edit size={16} /> Edit</button> <button className="textButton dangerText" onClick={() => onDelete(item.id)}><Trash2 size={16} /> Delete</button></td></tr>)}</tbody></table>
    </div>
  );
}
