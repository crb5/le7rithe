import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Link } from "wouter";
import { SITE_NAME } from "@/lib/brand";
import { useLanguage } from "@/lib/language";

export type Lang = "AR" | "FR" | "EN";

const LANGS: { code: Lang; label: string }[] = [
  { code: "AR", label: "العربية" },
  { code: "FR", label: "Français" },
  { code: "EN", label: "English" },
];

type Props = {
  language: Lang;
  onLanguageChange: (language: Lang) => void;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  languageMenuOpen: boolean;
  onLanguageMenuOpenChange: (open: boolean) => void;
  menuLabel: string;
};

function LanguageFlag({ language, testId }: { language: Lang; testId?: string }) {
  return (
    <svg
      className="sh-flag"
      viewBox="0 0 36 30"
      aria-hidden="true"
      focusable="false"
      data-language-flag={language.toLowerCase()}
      data-testid={testId}
    >
      {language === "AR" ? (
        <>
          <rect width="36" height="30" fill="#2E9B4F" />
          <rect width="36" height="4.5" fill="#C8372D" />
          <rect y="25.5" width="36" height="4.5" fill="#C8372D" />
          <path d="M10 13.5Q18 24 26 13.5Q18 19 10 13.5Z" fill="#F2C94C" />
          <path d="M18 8.2l1 2.4 2.5.1-2 1.6.7 2.5-2.2-1.4-2.2 1.4.7-2.5-2-1.6 2.5-.1z" fill="#F2C94C" />
        </>
      ) : language === "FR" ? (
        <>
          <rect width="12" height="30" fill="#0055A4" />
          <rect x="12" width="12" height="30" fill="#FFFFFF" />
          <rect x="24" width="12" height="30" fill="#EF4135" />
        </>
      ) : (
        <>
          <rect width="36" height="30" fill="#FFFFFF" />
          <path
            fill="#B22234"
            d="M0 0h36v2.31H0zm0 4.62h36v2.31H0zm0 4.61h36v2.31H0zm0 4.62h36v2.31H0zm0 4.61h36v2.31H0zm0 4.62h36v2.31H0zm0 4.61h36V30H0z"
          />
          <rect width="14.4" height="16.15" fill="#3C3B6E" />
          <g fill="#FFFFFF">
            <circle cx="2.2" cy="2.2" r=".65" />
            <circle cx="5.5" cy="2.2" r=".65" />
            <circle cx="8.8" cy="2.2" r=".65" />
            <circle cx="12.1" cy="2.2" r=".65" />
            <circle cx="3.85" cy="4.7" r=".65" />
            <circle cx="7.15" cy="4.7" r=".65" />
            <circle cx="10.45" cy="4.7" r=".65" />
            <circle cx="2.2" cy="7.2" r=".65" />
            <circle cx="5.5" cy="7.2" r=".65" />
            <circle cx="8.8" cy="7.2" r=".65" />
            <circle cx="12.1" cy="7.2" r=".65" />
            <circle cx="3.85" cy="9.7" r=".65" />
            <circle cx="7.15" cy="9.7" r=".65" />
            <circle cx="10.45" cy="9.7" r=".65" />
            <circle cx="2.2" cy="12.2" r=".65" />
            <circle cx="5.5" cy="12.2" r=".65" />
            <circle cx="8.8" cy="12.2" r=".65" />
            <circle cx="12.1" cy="12.2" r=".65" />
            <circle cx="3.85" cy="14.7" r=".65" />
            <circle cx="7.15" cy="14.7" r=".65" />
            <circle cx="10.45" cy="14.7" r=".65" />
          </g>
        </>
      )}
    </svg>
  );
}

export function HeaderBrand({
  variant = "header",
  direction,
}: {
  variant?: "header" | "sidebar";
  direction?: "rtl" | "ltr";
}) {
  const { language, meta } = useLanguage();
  const brandDirection = direction ?? meta[language].dir;
  const fadeId = `sh-fade-${useId().replaceAll(":", "")}`;

  return (
    <Link
      className={`sh-logo ${variant === "sidebar" ? "sh-logo-sidebar" : ""}`}
      dir={brandDirection}
      href="/"
      aria-label={SITE_NAME}
      data-testid={variant === "sidebar" ? "link-sidebar-brand" : "link-header-brand"}
    >
      <span className="sh-wordmark" dir="ltr">
        <span className="sh-spacer" aria-hidden="true" />
        <svg className="sh-mark" aria-hidden="true">
          <defs>
            <linearGradient
              id={fadeId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="100%"
              y2="0"
            >
              <stop offset="0" stopColor="#C2516B" />
              <stop offset=".45" stopColor="#C2516B" />
              <stop offset="1" stopColor="#C2516B" stopOpacity=".12" />
            </linearGradient>
          </defs>
          <svg
            x="0"
            y="0"
            width="1.0303em"
            height="1.7em"
            viewBox="9 0 40 66"
            fill="#C2516B"
            overflow="visible"
          >
            <path
              d="M26 18V54Q26 64 36 64H49"
              stroke="#C2516B"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <ellipse cx="26" cy="9" rx="4" ry="8" />
            <ellipse cx="19" cy="20" rx="4" ry="8" transform="rotate(-32 19 20)" />
            <ellipse cx="33" cy="20" rx="4" ry="8" transform="rotate(32 33 20)" />
            <ellipse cx="18" cy="33" rx="4" ry="8" transform="rotate(-32 18 33)" />
            <ellipse cx="34" cy="33" rx="4" ry="8" transform="rotate(32 34 33)" />
            <ellipse cx="19" cy="46" rx="3.4" ry="6.5" transform="rotate(-32 19 46)" opacity=".7" />
            <ellipse cx="33" cy="46" rx="3.4" ry="6.5" transform="rotate(32 33 46)" opacity=".7" />
          </svg>
          <line
            x1="1em"
            y1="1.6485em"
            x2="100%"
            y2="1.6485em"
            stroke={`url(#${fadeId})`}
            style={{ strokeWidth: ".0618em" }}
          />
        </svg>
        <span className="sh-word" dir="ltr">
          Le<b>7</b>rithe<small>.com</small>
        </span>
      </span>
    </Link>
  );
}

type LanguageSwitcherProps = Pick<
  Props,
  "language" | "onLanguageChange" | "languageMenuOpen" | "onLanguageMenuOpenChange"
>;

export function HeaderLanguageSwitcher({
  language,
  onLanguageChange,
  languageMenuOpen,
  onLanguageMenuOpenChange,
}: LanguageSwitcherProps) {
  const textDirection = language === "AR" ? "rtl" : "ltr";
  const boxRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        onLanguageMenuOpenChange(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onLanguageMenuOpenChange(false);
        languageButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageMenuOpen, onLanguageMenuOpenChange]);

  const pickLanguage = (code: Lang) => {
    onLanguageChange(code);
    onLanguageMenuOpenChange(false);
    languageButtonRef.current?.focus();
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(
      boxRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? [],
    );
    const currentIndex = options.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length;
    options[nextIndex]?.focus();
  };

  return (
    <div
      className={`sh-lang sh-lang--${textDirection}`}
      ref={boxRef}
      data-open={languageMenuOpen}
      dir={textDirection}
    >
      <button
        ref={languageButtonRef}
        type="button"
        className="sh-lang-btn"
        aria-haspopup="listbox"
        aria-expanded={languageMenuOpen}
        aria-label={`Language: ${LANGS.find((item) => item.code === language)?.label ?? language} (${language})`}
        data-language={language.toLowerCase()}
        onClick={() => onLanguageMenuOpenChange(!languageMenuOpen)}
        data-testid="select-language"
      >
        <span className="sh-lang-display" dir="ltr">
          <span data-testid="language-code">{language}</span>
          <LanguageFlag language={language} testId={`language-flag-${language.toLowerCase()}`} />
        </span>
        <svg className="sh-chev" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {languageMenuOpen && (
        <ul
          className={`sh-menu sh-menu--${textDirection}`}
          role="listbox"
          aria-label="Choose language"
          dir={textDirection}
        >
          {LANGS.map((item) => (
            <li key={item.code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={item.code === language}
                aria-label={`${item.label} (${item.code})`}
                tabIndex={0}
                onClick={() => pickLanguage(item.code)}
                onKeyDown={handleOptionKeyDown}
                data-testid={`language-option-${item.code.toLowerCase()}`}
              >
                <span className="sh-lang-display" dir="ltr">
                  <span>{item.code}</span>
                  <LanguageFlag
                    language={item.code}
                    testId={`language-option-flag-${item.code.toLowerCase()}`}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function useHeaderLocaleTransition(
  direction: "rtl" | "ltr",
  identityRef: RefObject<HTMLElement | null>,
  controlsRef: RefObject<HTMLElement | null>,
) {
  const previousGroupPositions = useRef<{
    identityLeft: number;
    controlsLeft: number;
    viewportWidth: number;
  } | null>(null);

  useLayoutEffect(() => {
    const identity = identityRef.current;
    const controls = controlsRef.current;
    if (!identity || !controls) return;

    const identityLeft = identity.getBoundingClientRect().left;
    const controlsLeft = controls.getBoundingClientRect().left;
    const previous = previousGroupPositions.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (previous && previous.viewportWidth === window.innerWidth && !reducedMotion) {
      const animateFromPreviousPosition = (element: HTMLElement, previousLeft: number, nextLeft: number) => {
        const offset = previousLeft - nextLeft;
        if (Math.abs(offset) < 1) return;

        const animation = element.animate(
          [{ transform: `translateX(${offset}px)` }, { transform: "translateX(0)" }],
          { duration: 260, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
        animation.onfinish = () => animation.cancel();
      };

      animateFromPreviousPosition(identity, previous.identityLeft, identityLeft);
      animateFromPreviousPosition(controls, previous.controlsLeft, controlsLeft);
    }

    previousGroupPositions.current = {
      identityLeft,
      controlsLeft,
      viewportWidth: window.innerWidth,
    };
  }, [direction, identityRef, controlsRef]);

  useEffect(() => {
    let frame = 0;
    const syncPositionsAfterResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const identity = identityRef.current;
        const controls = controlsRef.current;
        if (!identity || !controls) return;

        previousGroupPositions.current = {
          identityLeft: identity.getBoundingClientRect().left,
          controlsLeft: controls.getBoundingClientRect().left,
          viewportWidth: window.innerWidth,
        };
      });
    };

    window.addEventListener("resize", syncPositionsAfterResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPositionsAfterResize);
    };
  }, [identityRef, controlsRef]);
}

export default function Header({
  language,
  onLanguageChange,
  menuOpen,
  onMenuOpen,
  languageMenuOpen,
  onLanguageMenuOpenChange,
  menuLabel,
}: Props) {
  const textDirection = language === "AR" ? "rtl" : "ltr";
  const identityRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  useHeaderLocaleTransition(textDirection, identityRef, controlsRef);

  return (
    <header className={`sh sh--${textDirection}`} dir="ltr" data-testid="site-header">
      <div
        ref={identityRef}
        className="sh-identity"
        data-testid="header-identity"
      >
        <HeaderBrand direction={textDirection} />
      </div>
      <div
        ref={controlsRef}
        className={`sh-controls sh-controls--${textDirection}`}
        data-testid="header-tools"
      >
        <HeaderLanguageSwitcher
          language={language}
          onLanguageChange={onLanguageChange}
          languageMenuOpen={languageMenuOpen}
          onLanguageMenuOpenChange={onLanguageMenuOpenChange}
        />
        <button
          type="button"
          className="sh-menu-trigger"
          aria-label={menuLabel}
          aria-expanded={menuOpen}
          aria-controls="marketplace-navigation-drawer"
          onClick={() => onMenuOpen(!menuOpen)}
          data-testid="button-open-menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}