import type { ComponentChildren } from 'preact';

/** Grid wrapper for laying fields out in 1–3 columns. */
export function FieldGrid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: ComponentChildren }) {
  return <div class={`av-grid av-grid--${cols}`}>{children}</div>;
}

interface TextFieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  autocomplete?: string;
}

export function TextField({ label, value, onInput, type = 'text', placeholder, hint, autocomplete }: TextFieldProps) {
  return (
    <label class="av-field">
      <span class="av-field__label">{label}</span>
      <input
        class="av-input"
        type={type}
        value={value}
        placeholder={placeholder}
        autocomplete={autocomplete ?? 'off'}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      />
      {hint && <span class="av-field__hint">{hint}</span>}
    </label>
  );
}

interface TextAreaProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}

export function TextAreaField({ label, value, onInput, placeholder, rows = 3, hint }: TextAreaProps) {
  return (
    <label class="av-field">
      <span class="av-field__label">{label}</span>
      <textarea
        class="av-input av-textarea"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
      />
      {hint && <span class="av-field__hint">{hint}</span>}
    </label>
  );
}

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Option[];
  onInput: (value: string) => void;
  hint?: string;
}

export function SelectField({ label, value, options, onInput, hint }: SelectFieldProps) {
  return (
    <label class="av-field">
      <span class="av-field__label">{label}</span>
      <select
        class="av-input av-select"
        value={value}
        onChange={(e) => onInput((e.target as HTMLSelectElement).value)}
      >
        {options.map((o) => (
          <option value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <span class="av-field__hint">{hint}</span>}
    </label>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function Toggle({ label, checked, onChange, hint }: ToggleProps) {
  return (
    <label class="av-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      <span class="av-toggle__track" aria-hidden="true"><span class="av-toggle__thumb" /></span>
      <span class="av-toggle__text">
        <span class="av-toggle__label">{label}</span>
        {hint && <span class="av-field__hint">{hint}</span>}
      </span>
    </label>
  );
}
