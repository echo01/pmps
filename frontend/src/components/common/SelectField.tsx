type SelectOption = {
  value: string | number;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string | number;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
};

export function SelectField({ label, value, options, placeholder = 'All', onChange }: SelectFieldProps) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
