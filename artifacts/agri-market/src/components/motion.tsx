import type { ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

type WrapperProps = {
  children: ReactNode;
  className?: string;
};

export function FadeIn({
  children,
  className,
  delay = 0,
  yOffset = 16,
  enabled = true,
}: WrapperProps & { delay?: number; yOffset?: number; enabled?: boolean }) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = enabled && !reduceMotion;

  return (
    <motion.div
      className={className}
      initial={shouldAnimate ? { opacity: 0, y: yOffset } : false}
      whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, amount: 0.12 }}
      transition={shouldAnimate ? { duration: 0.4, ease: 'easeOut', delay } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function PageFade({
  children,
  className,
  enabled = true,
}: WrapperProps & { enabled?: boolean }) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = enabled && !reduceMotion;
  return (
    <motion.div
      className={className}
      initial={shouldAnimate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={shouldAnimate ? { duration: 0.25, ease: 'easeOut' } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

const staggerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function Stagger({
  children,
  className,
  enabled = true,
}: WrapperProps & { enabled?: boolean }) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = enabled && !reduceMotion;
  return (
    <motion.div
      className={className}
      variants={shouldAnimate ? staggerVariants : undefined}
      initial={shouldAnimate ? 'hidden' : false}
      whileInView={shouldAnimate ? 'visible' : undefined}
      viewport={{ once: true, amount: 0.12 }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  interactive = false,
  ...props
}: WrapperProps & { interactive?: boolean } & Omit<HTMLMotionProps<'div'>, 'children' | 'className'>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={itemVariants}
      initial={reduceMotion ? false : undefined}
      whileHover={interactive && !reduceMotion ? { scale: 1.02 } : undefined}
      whileTap={interactive && !reduceMotion ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
