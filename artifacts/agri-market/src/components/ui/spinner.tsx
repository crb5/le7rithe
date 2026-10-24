import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      {...props}
      role="status"
      aria-label="جارٍ التحميل"
      className={cn(
        'inline-block size-10 shrink-0 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-[#E8CCD4] border-t-[#1B5E4F]',
        className,
      )}
    />
  );
}

export { Spinner };
