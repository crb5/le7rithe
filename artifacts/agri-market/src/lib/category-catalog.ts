export type DynamicFieldType = 'text' | 'number' | 'date' | 'select' | 'tel';

export type DynamicField = {
  key: string;
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export const regions = ['روصو', 'كرمسين', 'اركيز', 'انتيكان', 'بوگي', 'لكصيب', 'آخر'];
export const LAND_CATEGORY_SLUG = 'land';
export const LAND_ONLY_FIELD_KEYS = [
  'landCondition',
  'region',
  'customRegion',
  'ownershipType',
  'area',
  'waterAvailable',
  'electricityAvailable',
] as const;

const saleTypes = [
  { value: 'sale', label: 'للبيع' },
  { value: 'rent', label: 'للإيجار' },
];

const conditions = [
  { value: 'new', label: 'جديد' },
  { value: 'used', label: 'مستعمل' },
];

export function dynamicFieldsForCategory(slug: string): DynamicField[] {
  if (slug === LAND_CATEGORY_SLUG) {
    return [
      { key: 'saleType', label: 'نوع الإعلان', type: 'select', options: saleTypes },
      { key: 'landCondition', label: 'حالة الأرض', type: 'select', options: [{ value: 'reclaimed', label: 'مستصلحة' }, { value: 'unreclaimed', label: 'غير مستصلحة' }] },
      { key: 'customRegion', label: 'اكتب المنطقة', type: 'text', placeholder: 'اسم المنطقة' },
      { key: 'ownershipType', label: 'نوع الملكية', type: 'text', placeholder: 'ملكية خاصة، مشاع...' },
      { key: 'area', label: 'المساحة بالهكتار', type: 'number' },
      { key: 'waterAvailable', label: 'توفر المياه', type: 'select', options: [{ value: 'yes', label: 'متوفر' }, { value: 'no', label: 'غير متوفر' }] },
      { key: 'electricityAvailable', label: 'توفر الكهرباء', type: 'select', options: [{ value: 'yes', label: 'متوفر' }, { value: 'no', label: 'غير متوفر' }] },
    ];
  }
  if (slug === 'tractors') {
    return [
      { key: 'saleType', label: 'نوع الإعلان', type: 'select', options: saleTypes },
      { key: 'manufacturer', label: 'الشركة المصنعة', type: 'text' },
      { key: 'model', label: 'الموديل', type: 'text' },
      { key: 'year', label: 'سنة الصنع', type: 'number' },
      { key: 'condition', label: 'الحالة', type: 'select', options: conditions },
      { key: 'hours', label: 'عدد ساعات العمل', type: 'number' },
    ];
  }
  if (slug === 'seeds') {
    return [
      { key: 'productName', label: 'اسم المنتج', type: 'text' },
      { key: 'reference', label: 'REF / Reference', type: 'text' },
      { key: 'brand', label: 'الشركة / العلامة التجارية', type: 'text' },
      { key: 'quantity', label: 'الكمية', type: 'number' },
      { key: 'productionDate', label: 'تاريخ الإنتاج', type: 'date' },
      { key: 'expiryDate', label: 'تاريخ انتهاء الصلاحية', type: 'date' },
    ];
  }
  if (slug === 'fertilizers') {
    return [
      { key: 'productName', label: 'اسم السماد', type: 'text' },
      { key: 'productType', label: 'نوع السماد', type: 'text' },
      { key: 'brand', label: 'الشركة المصنعة', type: 'text' },
      { key: 'composition', label: 'التركيبة', type: 'text' },
      { key: 'packageSize', label: 'الوزن / الحجم', type: 'text' },
    ];
  }
  if (slug === 'parts') {
    return [
      { key: 'partName', label: 'اسم قطعة الغيار', type: 'text' },
      { key: 'compatibleMachine', label: 'نوع الآلية المتوافقة', type: 'text' },
      { key: 'manufacturer', label: 'الشركة المصنعة', type: 'text' },
      { key: 'model', label: 'الموديل', type: 'text' },
      { key: 'reference', label: 'REF / Reference', type: 'text' },
      { key: 'condition', label: 'الحالة', type: 'select', options: conditions },
    ];
  }
  if (slug === 'products') {
    return [
      { key: 'productName', label: 'اسم المنتج', type: 'text' },
      { key: 'quantity', label: 'الكمية', type: 'number' },
      { key: 'unit', label: 'الوحدة', type: 'select', options: [{ value: 'kg', label: 'kg' }, { value: 'ton', label: 'طن' }, { value: 'other', label: 'أخرى' }] },
      { key: 'quality', label: 'الجودة / النوع', type: 'text' },
    ];
  }
  if (slug === 'services') {
    return [
      { key: 'serviceName', label: 'الاسم', type: 'text' },
      { key: 'specialization', label: 'التخصص', type: 'text' },
      { key: 'experience', label: 'الخبرة', type: 'text' },
      { key: 'contactPhone', label: 'رقم التواصل', type: 'tel' },
      { key: 'servicePrice', label: 'السعر إن وجد', type: 'number' },
    ];
  }
  return [];
}

export function formFieldsForCategory(slug: string): DynamicField[] {
  const duplicateFields = slug === LAND_CATEGORY_SLUG
    ? new Set(['region'])
    : slug === 'services'
      ? new Set(['contactPhone', 'servicePrice'])
      : new Set<string>();

  return dynamicFieldsForCategory(slug).filter((field) => !duplicateFields.has(field.key));
}

export function dynamicFiltersForCategory(slug: string): DynamicField[] {
  return dynamicFieldsForCategory(slug).filter((field) =>
    ['saleType', 'landCondition', 'reference', 'brand', 'productType', 'condition', 'manufacturer', 'model', 'year'].includes(field.key),
  );
}
