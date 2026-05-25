import React, { useId } from 'react';

export const Toggle: React.FC<{
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  interactive?: boolean;
}> = ({ id: propId, checked, onChange, disabled, ariaLabel, interactive = true }) => {
  const generatedId = useId();
  const id = propId || generatedId;
  const trackClassName =
    'w-11 h-6 rounded-full transition-colors duration-200 ease-in-out border border-[var(--theme-border-secondary)]';
  const thumbClassName =
    'absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out';

  if (!interactive) {
    return (
      <span className="flex items-center" aria-hidden="true">
        <span className="relative">
          <span
            className={`${trackClassName} block ${checked ? 'bg-[var(--theme-bg-accent)] border-transparent' : 'bg-[var(--theme-bg-tertiary)]'}`}
          />
          <span className={`${thumbClassName} block ${checked ? 'translate-x-5' : ''}`} />
        </span>
      </span>
    );
  }

  return (
    <label htmlFor={id} className={`flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        <div
          className={`${trackClassName} bg-[var(--theme-bg-tertiary)] peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-offset-[var(--theme-bg-secondary)] peer-focus:ring-[var(--theme-border-focus)] peer-checked:bg-[var(--theme-bg-accent)] peer-checked:border-transparent`}
        ></div>
        <div className={`${thumbClassName} peer-checked:translate-x-5`}></div>
      </div>
    </label>
  );
};
