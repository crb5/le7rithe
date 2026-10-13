import { useId, useState } from 'react';
import { useLanguage } from '@/lib/language';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const sealPath = (() => {
  const lobes = 12;
  const points = Array.from({ length: lobes * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / lobes;
    const radius = index % 2 === 0 ? 15.3 : 13.9;
    return {
      x: 16 + Math.cos(angle) * radius,
      y: 16 + Math.sin(angle) * radius,
    };
  });
  const midpoint = (a: (typeof points)[number], b: (typeof points)[number]) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const first = midpoint(points.at(-1)!, points[0]);
  const commands = [`M ${first.x} ${first.y}`];

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const end = midpoint(point, next);
    commands.push(`Q ${point.x} ${point.y} ${end.x} ${end.y}`);
  });

  return `${commands.join(' ')} Z`;
})();

export function VerifiedBadge({
  className = '',
  testId = 'badge-verified',
  variant = 'default',
  display = 'icon',
  size = 'default',
}: {
  className?: string;
  testId?: string;
  variant?: 'default' | 'inverse';
  display?: 'icon' | 'label';
  size?: 'default' | 'compact';
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const gradientId = `verified-seal-${useId().replace(/:/g, '')}`;
  const label = t('verified');

  const seal = (
    <svg
      aria-hidden="true"
      className={`block shrink-0 ${size === 'compact' ? 'h-[14px] w-[14px]' : 'h-[18px] w-[18px]'}`}
      viewBox="0 0 32 32"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5D77A" />
          <stop offset=".52" stopColor="#E9B949" />
          <stop offset="1" stopColor="#C9871D" />
        </linearGradient>
      </defs>
      <path d={sealPath} fill={`url(#${gradientId})`} stroke="#B77B1A" strokeWidth=".55" />
      <path
        d="m10.7 16.1 3.45 3.45 7.1-7.15"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );

  const trigger = (
    <TooltipProvider delayDuration={250}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            data-testid={testId}
            onPointerDown={(event) => {
              if (event.pointerType === 'touch') setOpen(true);
            }}
            className={`inline-flex h-6 w-6 shrink-0 touch-manipulation items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42_87%_61%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] ${className}`}
          >
            {seal}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={5}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (display === 'icon') return trigger;

  return (
    <span
      data-testid={`${testId}-label`}
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 ${className}`}
    >
      {trigger}
      <span className={`text-xs font-semibold leading-none ${variant === 'inverse' ? 'text-white' : 'text-[hsl(var(--foreground))]'}`}>
        {label}
      </span>
    </span>
  );
}
