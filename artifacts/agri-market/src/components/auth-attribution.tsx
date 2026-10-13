// Custom signup uses Clerk's hooks rather than its prebuilt card, so retain
// visible attribution and the development-key notice on that custom surface.
export function AuthAttribution() {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 border-t border-[#edf0ed] pt-4 text-xs text-[#74827a]" dir="ltr">
      <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 no-underline" aria-label="Secured by Clerk">
        <span>Secured by</span>
        <span className="font-bold text-[#536b5e]">Clerk</span>
      </a>
      {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') && (
        <span className="rounded-full border border-[#e2e8e4] bg-white px-2 py-1 text-[10px] leading-[14px]">Development mode</span>
      )}
    </div>
  );
}
