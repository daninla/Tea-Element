'use client';
import { useId, useState } from 'react';

export interface DeliverySuggestion {
  id: string;
  label: string;
}
export function DeliverySuggestions({
  label,
  value,
  selected,
  options,
  status,
  more,
  change,
  select,
}: {
  label: string;
  value: string;
  selected: boolean;
  options: DeliverySuggestion[];
  status?: string;
  more?: { label: string; disabled: boolean; load: () => void };
  change: (value: string) => void;
  select: (option: DeliverySuggestion) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const show = open && !selected && (options.length > 0 || !!status);
  function choose(option: DeliverySuggestion) {
    select(option);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div
      className="delivery-suggestions"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="commerce-field" htmlFor={id}>
        {label}
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={show && options.length > 0}
          aria-controls={show && options.length ? id + '-options' : undefined}
          aria-activedescendant={show && options[active] ? id + '-' + active : undefined}
          value={value}
          autoComplete="off"
          maxLength={100}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            change(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setActive(-1);
            }
            if (
              options.length &&
              !selected &&
              (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            ) {
              event.preventDefault();
              const delta = event.key === 'ArrowDown' ? 1 : -1;
              const next = Math.max(0, Math.min(options.length - 1, active + delta));
              setOpen(true);
              setActive(next);
              document.getElementById(id + '-' + next)?.scrollIntoView?.({ block: 'nearest' });
            }
            if (event.key === 'Enter' && show && options[active]) {
              event.preventDefault();
              choose(options[active]);
            }
          }}
        />
      </label>
      {show && (
        <div className="delivery-suggestion-menu">
          {options.length > 0 && (
            <div
              className="delivery-suggestion-list"
              role="listbox"
              id={id + '-options'}
              aria-label={label}
            >
              {options.map((option, index) => (
                <button
                  type="button"
                  tabIndex={-1}
                  key={option.id}
                  role="option"
                  id={id + '-' + index}
                  aria-selected={index === active}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {status && <p role="status">{status}</p>}
          {more && (
            <button type="button" disabled={more.disabled} onClick={more.load}>
              {more.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
