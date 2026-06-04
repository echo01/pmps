import { Plus, Search } from 'lucide-react';
import { FormEvent, ReactNode } from 'react';

type MasterDataToolbarProps = {
  search?: string;
  active?: string;
  addLabel: string;
  children?: ReactNode;
  onSearchChange?: (value: string) => void;
  onActiveChange?: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onAdd: () => void;
};

export function MasterDataToolbar({
  search = '',
  active = '',
  addLabel,
  children,
  onSearchChange,
  onActiveChange,
  onSubmit,
  onAdd,
}: MasterDataToolbarProps) {
  return (
    <form className="filters masterFilters" onSubmit={onSubmit}>
      {onSearchChange ? (
        <label>
          Search
          <input value={search} placeholder="All" onChange={(event) => onSearchChange(event.target.value)} />
        </label>
      ) : null}
      {onActiveChange ? (
        <label>
          Active
          <select value={active} onChange={(event) => onActiveChange(event.target.value)}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      ) : null}
      {children}
      <button className="primaryButton" type="submit"><Search size={16} /> Search</button>
      <button className="textButton" type="button" onClick={onAdd}><Plus size={16} /> {addLabel}</button>
    </form>
  );
}
