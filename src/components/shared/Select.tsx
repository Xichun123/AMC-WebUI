import React, { useState, useRef, useMemo, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useI18n } from '@/contexts/I18nContext';

interface SelectProps {
  id?: string;
  label: string;
  children: React.ReactNode;
  labelContent?: React.ReactNode;
  value?: string | number;
  onChange: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  layout?: 'vertical' | 'horizontal';
  hideLabel?: boolean;
  wrapperClassName?: string;
  dropdownClassName?: string;
  direction?: 'up' | 'down';
}

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled: boolean | undefined;
};

export const Select: React.FC<SelectProps> = ({
  id,
  label,
  children,
  labelContent,
  value,
  onChange,
  disabled,
  className,
  layout = 'vertical',
  hideLabel = false,
  wrapperClassName,
  dropdownClassName,
  direction = 'down',
}) => {
  const { t } = useI18n();
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isOpenRef = useRef(false);
  const activeIndexRef = useRef(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const setOpenState = (nextIsOpen: boolean) => {
    isOpenRef.current = nextIsOpen;
    setIsOpen(nextIsOpen);
  };

  const setActiveOptionIndex = (nextIndex: number) => {
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  };

  useClickOutside(wrapperRef, () => setOpenState(false), isOpen);

  const options = useMemo<SelectOption[]>(() => {
    return React.Children.toArray(children).flatMap((child) => {
      if (React.isValidElement(child) && child.type === 'option') {
        const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
        return [
          {
            value: String(props.value),
            label: props.children,
            disabled: props.disabled,
          },
        ];
      }
      return [];
    });
  }, [children]);

  const selectedOption = options.find((option) => String(option.value) === String(value));
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value));

  const findEnabledIndex = (startIndex: number, directionStep = 1) => {
    if (options.length === 0) return -1;

    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (startIndex + offset * directionStep + options.length) % options.length;
      if (!options[index].disabled) {
        return index;
      }
    }

    return -1;
  };

  const getInitialActiveIndex = () => {
    if (selectedIndex >= 0 && !options[selectedIndex].disabled) {
      return selectedIndex;
    }

    return findEnabledIndex(0);
  };

  const openWithInitialActiveOption = () => {
    setActiveOptionIndex(getInitialActiveIndex());
    setOpenState(true);
  };

  const closeSelect = () => {
    setOpenState(false);
  };

  const handleSelect = (selectedValue: string) => {
    onChange({ target: { value: selectedValue } });
    closeSelect();
  };

  const handleToggle = () => {
    if (disabled) return;
    if (isOpenRef.current) {
      closeSelect();
      return;
    }

    openWithInitialActiveOption();
  };

  const moveActiveOption = (directionStep: 1 | -1) => {
    const currentIndex = activeIndexRef.current >= 0 ? activeIndexRef.current : getInitialActiveIndex();
    const nextIndex = findEnabledIndex(currentIndex + directionStep, directionStep);
    setActiveOptionIndex(nextIndex);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpenRef.current) {
        openWithInitialActiveOption();
        return;
      }
      moveActiveOption(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpenRef.current) {
        openWithInitialActiveOption();
        return;
      }
      moveActiveOption(-1);
      return;
    }

    if (event.key === 'Home' && isOpenRef.current) {
      event.preventDefault();
      setActiveOptionIndex(findEnabledIndex(0));
      return;
    }

    if (event.key === 'End' && isOpenRef.current) {
      event.preventDefault();
      setActiveOptionIndex(findEnabledIndex(options.length - 1, -1));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpenRef.current) {
        openWithInitialActiveOption();
        return;
      }

      const option = options[activeIndexRef.current];
      if (option && !option.disabled) {
        handleSelect(option.value);
      }
      return;
    }

    if (event.key === 'Escape' && isOpenRef.current) {
      event.preventDefault();
      closeSelect();
    }
  };

  const containerClasses =
    layout === 'horizontal' ? `flex items-center justify-between py-1 ${className || ''}` : className;

  const labelClasses =
    layout === 'horizontal'
      ? 'text-sm font-medium text-[var(--theme-text-primary)] mr-4 flex-shrink-0'
      : 'block text-xs font-medium text-[var(--theme-text-secondary)] mb-1.5';
  const defaultWrapperClasses = layout === 'horizontal' ? 'relative w-full sm:w-64' : 'relative';

  const finalWrapperClasses = wrapperClassName || defaultWrapperClasses;

  const dropdownPositionClass = direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';
  const optionId = (optionIndex: number) => `${listboxId}-option-${optionIndex}`;

  return (
    <div className={containerClasses}>
      {!hideLabel && (
        <label htmlFor={id} className={labelClasses}>
          {labelContent || label}
        </label>
      )}
      {hideLabel && label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <div className={finalWrapperClasses} ref={wrapperRef}>
        <button
          type="button"
          id={id}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-full p-2.5 text-left border rounded-lg flex items-center justify-between transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)] ${disabled ? 'opacity-60 cursor-not-allowed bg-[var(--theme-bg-secondary)]' : 'cursor-pointer bg-[var(--theme-bg-input)] hover:border-[var(--theme-border-focus)]'} border-[var(--theme-border-secondary)] text-[var(--theme-text-primary)] text-sm`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        >
          <div className="truncate mr-2 flex-grow text-left">
            {selectedOption ? (
              selectedOption.label
            ) : (
              <span className="text-[var(--theme-text-tertiary)]">{t('selectPlaceholder')}</span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-[var(--theme-text-tertiary)] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            strokeWidth={1.5}
          />
        </button>

        {isOpen && (
          <div
            className={`absolute ${dropdownPositionClass} left-0 z-50 w-full bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-xl shadow-premium overflow-hidden flex flex-col ${dropdownClassName || 'max-h-[300px]'}`}
          >
            <div id={listboxId} role="listbox" className="overflow-y-auto custom-scrollbar p-1">
              {options.map((option, optionIndex) => {
                const isSelected = String(option.value) === String(value);
                const isActive = activeIndex === optionIndex;

                return (
                  <button
                    key={`${option.value}-${optionIndex}`}
                    id={optionId(optionIndex)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    onClick={() => handleSelect(option.value)}
                    disabled={option.disabled}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] font-medium'
                        : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]/50 hover:text-[var(--theme-text-primary)]'
                    } ${isActive && !isSelected ? 'bg-[var(--theme-bg-tertiary)]/50 text-[var(--theme-text-primary)]' : ''} ${
                      option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <span className="truncate w-full block">{option.label}</span>
                    {isSelected && (
                      <Check size={14} className="text-[var(--theme-text-link)] flex-shrink-0 ml-2" strokeWidth={1.5} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
