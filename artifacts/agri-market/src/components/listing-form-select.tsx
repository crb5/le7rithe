import { useState } from 'react';
import type { ReactNode } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, X } from 'lucide-react';
import './listing-form-select.css';

export type ListingSelectOption = {
  value: string;
  label: ReactNode;
};

type ListingFormSelectProps = {
  value: string;
  options: ListingSelectOption[];
  placeholder: string;
  direction: 'rtl' | 'ltr';
  onValueChange: (value: string) => void;
  clearable?: boolean;
  clearLabel?: string;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaDisabled?: boolean;
  attention?: boolean;
  onUnavailableClick?: () => void;
  testId?: string;
};

export function ListingFormSelect({
  value,
  options,
  placeholder,
  direction,
  onValueChange,
  clearable = false,
  clearLabel,
  required = false,
  ariaInvalid,
  ariaDescribedBy,
  ariaDisabled = false,
  attention = false,
  onUnavailableClick,
  testId,
}: ListingFormSelectProps) {
  const [open, setOpen] = useState(false);
  const unavailable = ariaDisabled || options.length === 0;

  return (
    <SelectPrimitive.Root
      dir={direction}
      value={value}
      open={open && !unavailable}
      onOpenChange={(nextOpen) => {
        if (nextOpen && unavailable) {
          onUnavailableClick?.();
          return;
        }
        setOpen(nextOpen);
      }}
      onValueChange={onValueChange}
    >
      <div dir={direction} className="relative mt-[.45rem]">
        <SelectPrimitive.Trigger
          className={`group flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-[.8rem] py-3 text-base font-normal text-[hsl(var(--foreground))] outline-none transition-[border-color,box-shadow] focus:border-[hsl(var(--primary))] focus:shadow-[0_0_0_3px_hsl(var(--primary)/.1)] data-[placeholder]:text-[hsl(var(--muted-foreground))] disabled:cursor-not-allowed disabled:opacity-50 ${unavailable ? 'cursor-not-allowed opacity-60' : ''} ${attention ? 'listing-form-select-attention' : ''}`}
          aria-required={required || undefined}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          aria-disabled={unavailable || undefined}
          data-testid={testId}
          onClick={(event) => {
            if (!unavailable) return;
            event.preventDefault();
            event.stopPropagation();
            onUnavailableClick?.();
          }}
          onKeyDown={(event) => {
            if (!unavailable || !['Enter', ' ', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            onUnavailableClick?.();
          }}
        >
          <SelectPrimitive.Value
            className={`min-w-0 flex-1 text-start ${clearable && value !== '' ? 'pe-9' : ''}`}
            placeholder={placeholder}
          />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        {clearable && value !== '' && (
          <button
            type="button"
            aria-label={clearLabel}
            data-testid={testId ? `${testId}-clear` : undefined}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onValueChange('');
            }}
            className="absolute end-9 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(153_35%_92%)] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          dir={direction}
          position="popper"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          data-body-scroll-lock-allow=""
          className="listing-form-select-content z-[100] overflow-hidden rounded-[14px] border border-[hsl(var(--input))] bg-white text-[hsl(var(--foreground))] shadow-[0_12px_32px_rgba(21,58,44,.18)]"
          style={{
            width: 'var(--radix-select-trigger-width)',
            maxHeight: 'min(var(--radix-select-content-available-height), 50vh)',
          }}
        >
          <SelectPrimitive.Viewport className="listing-form-select-viewport mobile-popup-scroll-region max-h-[min(50vh,var(--radix-select-content-available-height))] overflow-y-auto overscroll-contain p-1.5">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-11 w-full cursor-pointer select-none items-center rounded-lg py-2 text-base text-[hsl(var(--foreground))] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[hsl(153_35%_92%)] data-[highlighted]:text-[hsl(154_26%_15%)] data-[state=checked]:bg-[hsl(153_35%_92%)] data-[state=checked]:font-semibold"
              >
                <SelectPrimitive.ItemText className="w-full px-3 pe-10 text-start">
                  {option.label}
                </SelectPrimitive.ItemText>
                <span className="absolute end-3 flex h-4 w-4 items-center justify-center text-[hsl(var(--primary))]">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}