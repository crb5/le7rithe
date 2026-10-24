import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      {...props}
      role="status"
      aria-label="جارٍ التحميل"
      className={cn(
        'inline-block size-10 shrink-0 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-[#F4BF3A] border-t-[#173D32]',
        className,
      )}
    />
  );
}

export { Spinner };
