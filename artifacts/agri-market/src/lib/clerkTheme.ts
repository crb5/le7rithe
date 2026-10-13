import { shadcn } from '@clerk/themes';
import { arSA, enUS, frFR } from '@clerk/localizations';

// Provider-wide baseline preserved for other Clerk screens. Page-specific
// auth refinements and the custom signup tokens live in this same file.
export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  variables: {
    colorPrimary: '#1f5948', colorForeground: '#173d32',
    colorMutedForeground: '#6f7f77', colorDanger: '#b94b3e',
    colorBackground: '#fffefa', colorInput: '#ffffff',
    colorInputForeground: '#173d32', colorNeutral: '#d9dfd7',
    fontFamily: 'IBM Plex Sans Arabic, sans-serif', borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-[1.5rem] border border-[#e5e1d7] w-[440px] max-w-full overflow-hidden shadow-[0_20px_56px_rgba(23,61,50,0.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#173d32] text-2xl font-bold',
    headerSubtitle: 'text-[#6f7f77] text-sm leading-6',
    socialButtonsBlockButtonText: '!text-[#173d32]',
    formFieldLabel: 'text-[#173d32]', footerActionLink: 'text-[#1f5948]',
    footerActionText: 'text-[#6f7f77]', dividerText: 'text-[#6f7f77]',
    identityPreviewEditButton: 'text-[#1f5948]', formFieldSuccessText: 'text-[#1f5948]',
    alertText: 'text-[#b94b3e]', logoBox: 'hidden',
    socialButtonsBlockButton: 'border-[#d9dfd7] !bg-white !text-[#173d32] hover:!bg-[#f8faf8]',
    formButtonPrimary: 'bg-[#1f5948] !text-[#ffffff] hover:bg-[#174536]',
    formFieldInput: 'border-[#d9dfd7] bg-white text-[#173d32]',
    footerAction: 'text-[#6f7f77]', dividerLine: 'bg-[#d9dfd7]',
    alert: 'border-[#f0c6bf] bg-[#fff6f3]', otpCodeFieldInput: 'border-[#d9dfd7] bg-white',
    formFieldRow: 'mb-4', main: 'gap-4',
  },
};

// Shared auth visual tokens. Clerk element keys follow Clerk's runtime
// `cl-*` element names (socialButtonsBlockButton, formButtonPrimary, ...).
export const authControlClass =
  'min-h-[48px] h-12 w-full rounded-xl box-border';
export const authCardClass =
  'mx-auto w-full max-w-[28rem] rounded-[20px] border border-[#e6e1d8] bg-white p-5 shadow-[0_4px_16px_rgba(23,61,50,0.04)] sm:p-7';
export const authOutlineButtonClass =
  `${authControlClass} flex items-center justify-center gap-3 border border-[#d2dbd5] bg-white px-4 text-sm font-semibold text-[#173d32] transition-colors hover:bg-[#f8faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9b949]/70 disabled:cursor-not-allowed disabled:opacity-60`;
export const authInputClass =
  `${authControlClass} border border-[#d2dbd5] bg-white px-3.5 text-base text-[#173d32] outline-none transition-colors focus:border-[#1f5948] focus:ring-4 focus:ring-[#1f5948]/10`;
export const authPolicyLinkClass =
  'font-normal text-[#1f5948] no-underline hover:underline underline-offset-2';
export const authNavLinkClass =
  'font-bold text-[#1f5948] no-underline hover:no-underline';

export const clerkSharedAuthAppearance = {
  variables: { colorBackground: '#ffffff', borderRadius: '0.75rem' },
  elements: {
    cardBox: '!bg-white !rounded-[20px] !border !border-[#e6e1d8] w-[440px] max-w-full !overflow-visible !shadow-[0_4px_16px_rgba(23,61,50,0.04)]',
    card: '!p-5 sm:!p-7 !gap-3',
    headerTitle: { fontSize: '25px', fontWeight: 700, lineHeight: '32px' },
    headerSubtitle: { fontSize: '14px', color: '#6f7f77', lineHeight: '24px' },
    footerActionLink: '!font-bold !text-[#1f5948] !no-underline hover:!no-underline',
    footerActionText: '!text-[#6f7f77]',
    socialButtonsBlockButton: 'relative min-h-[48px] h-12 border border-[#d2dbd5] !bg-white !text-[#173d32] hover:!bg-[#f8faf8]',
    formButtonPrimary: 'min-h-[48px] h-12 bg-[#1f5948] !text-[#ffffff] hover:bg-[#174536]',
    formFieldInput: 'h-12 min-h-[48px] !border-[#d2dbd5] rounded-xl bg-white text-[#173d32]',
    dividerLine: 'bg-[#d4dbd6]',
    main: '!gap-3',
  },
};

// Module-level constants: selecting one never remounts Clerk.
export const clerkLocalizationByLanguage = {
  ar: {
    ...arSA,
    socialButtonsBlockButton: 'المتابعة مع {{provider|titleize}}',
    formFieldInputPlaceholder__emailAddress: 'أدخل عنوان بريدك الإلكتروني',
  },
  fr: {
    ...frFR,
    formFieldInputPlaceholder__signUpPassword: 'Créez un mot de passe',
  },
  en: enUS,
} as const;

export const authCopyByLanguage = {
  ar: {
    continueWithGoogle: 'المتابعة مع Google',
    continueWithPhone: 'المتابعة برقم الهاتف',
    continueWithEmail: 'المتابعة بالبريد الإلكتروني',
    signUpSubtitle: 'أنشئ حسابك للمتابعة إلى Le7rithe',
  },
  fr: {
    continueWithGoogle: 'Continuer avec Google',
    continueWithPhone: 'Continuer avec le téléphone',
    continueWithEmail: "Continuer avec l'e-mail",
    signUpSubtitle: 'Créez votre compte pour continuer sur Le7rithe',
  },
  en: {
    continueWithGoogle: 'Continue with Google',
    continueWithPhone: 'Continue with phone',
    continueWithEmail: 'Continue with email',
    signUpSubtitle: 'Create your account to continue to Le7rithe',
  },
} as const;
