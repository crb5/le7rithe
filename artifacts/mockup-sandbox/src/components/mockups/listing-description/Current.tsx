import './_group.css';

const description = `هذا إعلان لجرار زراعي بحالة ممتازة، خضع للصيانة الدورية ويعمل بكفاءة في مختلف الأعمال الزراعية. تم استخدامه في حراثة الأرض وتجهيزها للموسم، وهو جاهز للعمل مباشرة بعد المعاينة.

يتضمن السعر الجرار فقط، ويمكن للمشتري معاينته في نواكشوط والتواصل مع البائع لمزيد من المعلومات.`;

export function Current() {
  return (
    <main className="listing-description-showcase p-5 sm:p-8" dir="rtl">
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="mt-5 text-base font-bold text-[hsl(var(--primary))]">الوصف</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-8 text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      </div>
    </main>
  );
}
