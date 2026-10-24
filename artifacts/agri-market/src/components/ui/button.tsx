import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-normal rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border border-primary-border shadow-sm hover:shadow-md hover:brightness-95 active:shadow-none',
        destructive:
          'bg-destructive text-destructive-foreground border-destructive-border shadow-sm hover:shadow-md hover:brightness-95 active:shadow-none',
        outline:
          // Shows the background color of whatever card/sidebar/accent background it sits on; inherits the current text color.
          ' border [border-color:var(--button-outline)] shadow-xs hover:bg-secondary/60 active:shadow-none ',
        secondary:
          'border bg-secondary text-secondary-foreground border border-secondary-border hover:brightness-95 ',
        ghost: 'border border-transparent hover:bg-secondary/60',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-9 px-4 py-2',
        sm: 'min-h-8 px-3 text-xs',
        lg: 'min-h-10 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

// Preserve the established Button prop API while using Motion for its visual states.
type AnimatedButtonProps = ButtonProps & Pick<HTMLMotionProps<'button'>, 'whileHover' | 'whileTap' | 'transition'>;
const MotionButton = motion.button as unknown as React.ForwardRefExoticComponent<
  AnimatedButtonProps & React.RefAttributes<HTMLButtonElement>
>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      );
    }
    return (
      <MotionButton
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // Marks this as using Framer Motion for hover/press scale, so the global
        // `.grain button` CSS scale rules (src/motion.css) skip it instead of compounding.
        data-motion-scale=""
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
