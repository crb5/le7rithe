import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { LoaderCircle, Upload, ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/language';

type PaymentOptions = {
  packages: Array<{ id: number; name: string; description: string; price: string; currency: string; durationDays: number; features: string[] }>;
  methods: Array<{ id: number; name: string; accountNumber: string; accountName: string; instructions: string; currency: string }>;
};

const maxPaymentProofBytes = 1_800_000;
const paymentProofContentTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

const isValidPaymentProofFile = (file: File) =>
  file.name.trim().length > 0 &&
  file.size > 0 &&
  file.size <= maxPaymentProofBytes &&
  paymentProofContentTypes.has(file.type);

export function PaymentConfirmationPanel({ listingId, onDone }: { listingId: number; onDone: () => void }) {
  const { t, language, meta, formatMoney } = useLanguage();
  const { getToken } = useAuth();
  const [packageId, setPackageId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountHolderName, setAccountHolderName] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const options = useQuery<PaymentOptions>({
    queryKey: ['payment-options'],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/payment-options', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(t('serverConnectionError'));
      return response.json();
    },
  });
  const selectedPackage = options.data?.packages.find((item) => String(item.id) === packageId);
  const selectedMethod = options.data?.methods.find((item) => String(item.id) === methodId);

  const handleProof = (file?: File) => {
    if (!file) return;
    if (!isValidPaymentProofFile(file)) {
      setProofFile(null);
      setError(t('paymentProofInvalid'));
      return;
    }
    setError('');
    setProofFile(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPackage || !selectedMethod || !proofFile) {
      setError(t('paymentFieldsRequired'));
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      if (!isValidPaymentProofFile(proofFile)) {
        setError(t('paymentProofInvalid'));
        return;
      }
      const token = await getToken();
      const authorization: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const uploadResponse = await fetch('/api/payment-proof/uploads/request-url', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify({
          name: proofFile.name,
          size: proofFile.size,
          contentType: proofFile.type,
        }),
      });
      const uploadBody = await uploadResponse.json().catch(() => ({}));
      if (uploadResponse.status === 400 && uploadBody.error === 'Invalid payment proof file') {
        throw new Error(t('paymentProofInvalid'));
      }
      if (!uploadResponse.ok || typeof uploadBody.uploadURL !== 'string' || typeof uploadBody.objectPath !== 'string') {
        throw new Error(uploadBody.error || t('paymentSubmitError'));
      }
      const uploadURL = new URL(uploadBody.uploadURL, window.location.origin);
      const fileResponse = await fetch(uploadBody.uploadURL, {
        method: 'PUT',
        headers: {
          'Content-Type': proofFile.type,
          ...(uploadURL.origin === window.location.origin ? authorization : {}),
        },
        body: proofFile,
      });
      if (!fileResponse.ok) throw new Error(t('paymentSubmitError'));
      const response = await fetch('/api/payments', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify({
          listingId,
          packageId: selectedPackage.id,
          paymentMethodId: selectedMethod.id,
          amount: Number(selectedPackage.price),
          transactionReference,
          transactionDate,
          accountHolderName,
          proofObjectPath: uploadBody.objectPath,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('paymentSubmitError'));
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('paymentSubmitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const price = useMemo(() => selectedPackage ? formatMoney(Number(selectedPackage.price), selectedPackage.currency) : '—', [formatMoney, selectedPackage]);

  return (
    <div
      dir={meta[language].dir}
      className="mx-auto max-w-4xl"
      data-testid="payment-confirmation-panel"
      data-listing-id={listingId}
    >
      <div className="mb-7 flex items-start gap-3">
        <ShieldCheck className="mt-1 text-[hsl(var(--primary))]" size={22} />
        <div><h1 className="text-2xl font-bold text-[hsl(var(--primary))]">{t('paymentConfirmationTitle')}</h1><p className="mt-2 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{t('paymentConfirmationDescription')}</p></div>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7">
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {options.isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">{t('paymentPackage')} *<select required value={packageId} onChange={(event) => setPackageId(event.target.value)} className="field-input" data-testid="select-payment-package"><option value="">{t('selectPackage')}</option>{options.data?.packages.map((item) => <option key={item.id} value={item.id}>{item.name} — {formatMoney(Number(item.price), item.currency)}</option>)}</select></label>
              <label className="field-label">{t('paymentMethod')} *<select required value={methodId} onChange={(event) => setMethodId(event.target.value)} className="field-input" data-testid="select-payment-method"><option value="">{t('selectPaymentMethod')}</option>{options.data?.methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </div>
            {selectedMethod && <div className="my-5 rounded-xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.08)] p-4 text-sm"><p className="font-bold">{selectedMethod.name}</p><p className="mt-2" dir="ltr">{selectedMethod.accountNumber}</p><p>{selectedMethod.accountName}</p>{selectedMethod.instructions && <p className="mt-2 whitespace-pre-wrap text-xs leading-6">{selectedMethod.instructions}</p>}</div>}
            <div className="mb-5 rounded-xl bg-[hsl(var(--secondary)/.45)] p-4"><span className="text-xs text-[hsl(var(--muted-foreground))]">{t('paymentAmount')}</span><strong className="ms-3 text-lg text-[hsl(var(--primary))]" dir="ltr">{price}</strong></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">{t('paymentTransactionNumber')} *<input required value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} className="field-input" dir="ltr" data-testid="input-payment-reference" /></label>
              <label className="field-label">{t('paymentDate')} *<input required type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="field-input" dir="ltr" data-testid="input-payment-date" /></label>
              <label className="field-label sm:col-span-2">{t('paymentAccountHolder')} *<input required value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} className="field-input" data-testid="input-payment-account-holder" /></label>
              <label className="field-label sm:col-span-2">{t('paymentProof')} *<span className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] bg-white px-4 py-3 text-sm"><Upload size={17} /><span>{proofFile ? t('paymentProofSelected') : t('paymentProofChoose')}</span><input required type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleProof(event.target.files?.[0])} className="sr-only" data-testid="input-payment-proof" /></span></label>
            </div>
             <button type="submit" disabled={isSubmitting || options.isLoading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-submit-payment">{isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t('submitPaymentConfirmation')}</button>
          </>
        )}
      </form>
    </div>
  );
}