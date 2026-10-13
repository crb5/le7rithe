import { SiWhatsapp } from 'react-icons/si';

type WhatsAppIconProps = {
  size?: number;
  className?: string;
};

export function WhatsAppIcon({ size = 18, className = '' }: WhatsAppIconProps) {
  return (
    <SiWhatsapp
      size={size}
      className={`shrink-0 align-middle ${className}`}
      aria-hidden="true"
      focusable="false"
    />
  );
}