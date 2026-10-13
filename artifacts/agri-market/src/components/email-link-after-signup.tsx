import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation, useSearch } from "wouter";
import { AccountEmailLink } from "./account-email-link";
import { useLanguage } from "@/lib/language";
import { clearPendingSignupContact, readPendingSignupContact, signupReturnPath } from "@/lib/signup-contact-flow";

export function EmailLinkAfterSignup() {
  const { user } = useUser();
  const { t, language, meta } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [email] = useState(() => readPendingSignupContact("email"));
  const [alreadyLinked] = useState(() => Boolean(user?.primaryEmailAddress));
  const returnPath = signupReturnPath(search);
  const continueToMarket = () => {
    clearPendingSignupContact();
    setLocation(returnPath, { replace: true });
  };

  return (
    <main className="px-4 py-8 sm:py-12" dir={meta[language].dir}>
      <div className="mx-auto max-w-[28rem] space-y-4">
        <h1 className="text-lg font-bold text-[#173d32]">{t("signupEmailOptional")}</h1>
        {alreadyLinked ? <p className="text-sm text-[#1f5948]">{t("emailLinkVerified")}</p>
          : <AccountEmailLink initialEmail={email} autoSend onComplete={continueToMarket} />}
        <button type="button" onClick={continueToMarket}
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d9dfd7] bg-white px-4 text-sm font-semibold text-[#1f5948]"
          data-testid="button-skip-email-link">{t(alreadyLinked ? "continue" : "skipPhoneLink")}</button>
      </div>
    </main>
  );
}
