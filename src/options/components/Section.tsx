import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface SectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** 'sensitive' styles the EEO/voluntary section distinctly. */
  tone?: 'default' | 'sensitive';
  children: ComponentChildren;
}

export function Section({ title, subtitle, defaultOpen = true, tone = 'default', children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section class={`av-section ${tone === 'sensitive' ? 'av-section--sensitive' : ''}`}>
      <button
        type="button"
        class="av-section__header"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span class="av-section__chevron" data-open={String(open)}>▸</span>
        <span class="av-section__title">{title}</span>
        {subtitle && <span class="av-section__subtitle">{subtitle}</span>}
      </button>
      {open && <div class="av-section__body">{children}</div>}
    </section>
  );
}
