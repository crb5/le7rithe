import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ImagePlus, LoaderCircle, Upload, X } from 'lucide-react';
import { processAdminBannerImageUpload, requestBannerImageUpload } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/language';

type BannerImageUploaderProps = {
  value: string;
  previewUrl: string;
  onChange: (path: string, previewUrl: string) => void;
  onBusyChange: (busy: boolean) => void;
};

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedImageType = (typeof acceptedTypes)[number];
const isAcceptedImageType = (type: string): type is AcceptedImageType =>
  (acceptedTypes as readonly string[]).includes(type);
const maxBytes = 8_000_000;

export function BannerImageUploader({ value, previewUrl, onChange, onBusyChange }: BannerImageUploaderProps) {
  const { getToken } = useAuth();
  const { t } = useLanguage();
  const [localPreview, setLocalPreview] = useState(previewUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setLocalPreview(previewUrl), [previewUrl]);
  useEffect(() => () => {
    if (localPreview.startsWith('blob:')) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedImageType(file.type)) {
      setError(t('bannerImageInvalidType'));
      return;
    }
    if (file.size <= 0) {
      setError(t('bannerImageInvalidContent'));
      return;
    }
    if (file.size > maxBytes) {
      setError(t('bannerImageTooLarge'));
      return;
    }
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setError('');
    setBusy(true);
    onBusyChange(true);
    try {
      const token = await getToken();
      const requestOptions: RequestInit = {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      const upload = await requestBannerImageUpload({
        name: file.name.slice(0, 255),
        size: file.size,
        contentType: file.type,
      }, requestOptions);
      const uploadResponse = await fetch(upload.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error(t('bannerUploadError'));
      const processed = await processAdminBannerImageUpload(
        { objectPath: upload.objectPath },
        requestOptions,
      );
      onChange(processed.imagePath, preview);
    } catch (uploadError) {
      const status = uploadError && typeof uploadError === 'object' && 'status' in uploadError
        ? Number((uploadError as { status?: unknown }).status)
        : undefined;
      setError(status === 503
        ? t('bannerStorageUnavailable')
        : status === 400
          ? t('bannerImageInvalidContent')
          : t('bannerUploadError'));
      onChange('', preview);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <div className="space-y-3">
      {localPreview ? (
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(154_20%_82%)] bg-[hsl(155_20%_94%)]">
          <img src={localPreview} alt={t('bannerImagePreview')} className="block h-auto max-h-[70vh] w-full object-contain" />
          {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white"><LoaderCircle className="animate-spin" /></div>}
          <button type="button" onClick={() => { setLocalPreview(''); onChange('', ''); }} className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75" aria-label={t('removeBannerImage')}><X size={16} /></button>
        </div>
      ) : (
        <label className="flex aspect-[2.6/1] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(154_20%_72%)] bg-[hsl(155_20%_96%)] text-[hsl(153_12%_43%)] transition hover:border-[hsl(155_33%_35%)] hover:bg-[hsl(155_20%_92%)]">
          <ImagePlus size={26} />
          <span className="text-sm font-bold">{t('uploadBannerImage')}</span>
          <span className="text-[11px]">{t('bannerImageRules')}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </label>
      )}
      {localPreview && !busy && (
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]">
          <Upload size={14} />
          {t('replaceBannerImage')}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </label>
      )}
      {error && <p className="text-xs font-semibold text-[hsl(4_62%_48%)]">{error}</p>}
      {value && !busy && <p className="text-[11px] text-[hsl(153_12%_43%)]">{t('bannerImageReady')}</p>}
    </div>
  );
}