import './_group.css';
import './Redesign.css';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Filter,
  FlaskConical,
  LandPlot,
  Leaf,
  MapPin,
  Menu,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Sprout,
  Tractor,
  Wheat,
  Wrench,
  X,
} from 'lucide-react';

type Language = 'ar' | 'fr' | 'en';
type Listing = { id: number; title: string; category: string; location: string; price: string; featured?: boolean; icon: 'tractor' | 'land' | 'seed' | 'pump' | 'fertilizer' | 'parts' };

const listings: Listing[] = [
  { id: 1, title: 'جرار زراعي حديث بحالة ممتازة', category: 'الآليات الزراعية', location: 'نواكشوط', price: '1,250,000 MRU', featured: true, icon: 'tractor' },
  { id: 2, title: 'أرض زراعية خصبة للبيع', category: 'الأراضي الزراعية', location: 'روصو', price: '850,000 MRU', featured: true, icon: 'land' },
  { id: 3, title: 'بذور قمح عالية الجودة', category: 'البذور', location: 'أطار', price: '12,500 MRU', featured: true, icon: 'seed' },
  { id: 4, title: 'مضخة مياه للري الزراعي', category: 'الآليات الزراعية', location: 'بوتلميت', price: '95,000 MRU', icon: 'pump' },
  { id: 5, title: 'أسمدة عضوية للمحاصيل', category: 'الأسمدة', location: 'كيفه', price: '18,000 MRU', icon: 'fertilizer' },
  { id: 6, title: 'قطع غيار أصلية للجرارات', category: 'قطع الغيار', location: 'نواكشوط', price: '32,000 MRU', icon: 'parts' },
];

const categories = [
  { slug: 'tractors', label: 'الآليات الزراعية', count: 24, icon: Tractor },
  { slug: 'land', label: 'الأراضي الزراعية', count: 18, icon: LandPlot },
  { slug: 'seeds', label: 'البذور', count: 12, icon: Sprout },
  { slug: 'fertilizers', label: 'الأسمدة', count: 9, icon: FlaskConical },
  { slug: 'parts', label: 'قطع الغيار', count: 16, icon: Wrench },
  { slug: 'products', label: 'المنتجات الزراعية', count: 31, icon: Package },
  { slug: 'services', label: 'الموارد البشرية', count: 8, icon: Compass },
  { slug: 'divers', label: 'Divers', count: 6, icon: Leaf },
];

const copy = {
  ar: {
    direction: 'rtl' as const, brand: 'لحريثه', tagline: 'السوق الزراعي الموريتاني', home: 'الرئيسية', listings: 'الإعلانات', add: 'أضف إعلاناً', login: 'تسجيل الدخول', lang: 'اللغة',
    kicker: 'أدوات الموسم، من أهل البلد', title: 'كل ما تحتاجه\\nلأرضك.', intro: 'أرض، معدات، بذور ومدخلات زراعية — ابحث وقارن وتواصل مع البائعين في موريتانيا.', search: 'ابحث عن أرض، معدة أو منتج', searchButton: 'ابحث الآن', location: 'كل المناطق', categories: 'تصفح السوق', categoryIntro: 'كل ما تحتاجه للموسم الزراعي، في مكان واحد.', all: 'جميع الفئات', count: 'إعلان', featured: 'إعلانات تستحق المشاهدة', featuredSub: 'عروض اختيرت بعناية من السوق', latest: 'أحدث العروض', latestSub: 'أضيفت حديثاً إلى السوق', seeAll: 'عرض جميع الإعلانات', details: 'عرض الإعلان', posted: 'نُشر قبل يوم', town: 'موريتانيا', trusted: 'تجارة محلية موثوقة', trustedSub: 'تواصل مباشرة مع أصحاب الإعلانات في مختلف ولايات موريتانيا.', cta: 'لديك شيء يحتاجه المزارعون؟', ctaSub: 'اعرض معداتك أو منتجاتك على مجتمع الزراعة في موريتانيا.', ctaButton: 'أضف إعلاناً', footer: 'لحريثه — منصة تجمع أهل الأرض بما يحتاجونه.', more: 'اكتشف السوق', allResults: 'كل الإعلانات', noResults: 'لا توجد إعلانات مطابقة', reset: 'مسح البحث', menu: 'القائمة', quick: 'اختيارات رائجة', searchHint: 'جرّب: جرار، أرض، قطع غيار', heroBadge: 'السوق الزراعي في موريتانيا', locations: ['نواكشوط', 'روصو', 'أطار', 'بوتلميت', 'كيفه'],
    adCategories: ['الآليات الزراعية', 'الأراضي الزراعية', 'البذور', 'الآليات الزراعية', 'الأسمدة', 'قطع الغيار'], see: 'شاهد الإعلان',
  },
  fr: {
    direction: 'ltr' as const, brand: 'لحريثه', tagline: 'Le marché agricole mauritanien', home: 'Accueil', listings: 'Annonces', add: 'Déposer une annonce', login: 'Connexion', lang: 'Langue',
    kicker: 'Les outils de la saison, près de chez vous', title: 'Tout pour\\nvotre terre.', intro: 'Terres, matériel, semences et intrants — trouvez et contactez des vendeurs partout en Mauritanie.', search: 'Terre, matériel ou produit', searchButton: 'Rechercher', location: 'Toutes les régions', categories: 'Explorer le marché', categoryIntro: 'Tout pour votre saison agricole, au même endroit.', all: 'Toutes les catégories', count: 'annonces', featured: 'À découvrir', featuredSub: 'Des offres sélectionnées sur le marché', latest: 'Dernières offres', latestSub: 'Récemment publiées sur le marché', seeAll: 'Toutes les annonces', details: 'Voir l’annonce', posted: 'Publié hier', town: 'Mauritanie', trusted: 'Des échanges locaux fiables', trustedSub: 'Contactez directement les vendeurs dans les régions mauritaniennes.', cta: 'Un produit utile aux agriculteurs ?', ctaSub: 'Présentez votre matériel ou vos produits à la communauté agricole.', ctaButton: 'Déposer une annonce', footer: 'لحريثه — le marché des gens de la terre.', more: 'Explorer le marché', allResults: 'Toutes les annonces', noResults: 'Aucune annonce correspondante', reset: 'Effacer la recherche', menu: 'Menu', quick: 'Recherches populaires', searchHint: 'Essayez : tracteur, terrain, pièces', heroBadge: 'Le marché agricole en Mauritanie', locations: ['Nouakchott', 'Rosso', 'Atar', 'Boutilimit', 'Kaédi'],
    adCategories: ['Matériel agricole', 'Terrains agricoles', 'Semences', 'Matériel agricole', 'Engrais', 'Pièces détachées'], see: 'Voir l’annonce',
  },
  en: {
    direction: 'ltr' as const, brand: 'لحريثه', tagline: 'Mauritania’s agricultural marketplace', home: 'Home', listings: 'Listings', add: 'Post an ad', login: 'Sign in', lang: 'Language',
    kicker: 'Season-ready tools, from local sellers', title: 'Everything for\\nyour land.', intro: 'Land, machinery, seeds and farm inputs — find and contact sellers across Mauritania.', search: 'Search land, machinery or supplies', searchButton: 'Search', location: 'All locations', categories: 'Explore the market', categoryIntro: 'What you need for the growing season, in one place.', all: 'All categories', count: 'listings', featured: 'Worth a closer look', featuredSub: 'Selected offers from across the marketplace', latest: 'Latest offers', latestSub: 'Recently added to the marketplace', seeAll: 'All listings', details: 'View listing', posted: 'Posted yesterday', town: 'Mauritania', trusted: 'Local trade you can trust', trustedSub: 'Contact sellers directly across Mauritania’s agricultural regions.', cta: 'Have something farmers need?', ctaSub: 'List your equipment or supplies for Mauritania’s farming community.', ctaButton: 'Post an ad', footer: 'لحريثه — bringing local growers and the tools they need together.', more: 'Explore the market', allResults: 'All listings', noResults: 'No matching listings', reset: 'Clear search', menu: 'Menu', quick: 'Popular searches', searchHint: 'Try: tractor, farmland, spare parts', heroBadge: 'The agricultural marketplace in Mauritania', locations: ['Nouakchott', 'Rosso', 'Atar', 'Boutilimit', 'Kaédi'],
    adCategories: ['Agricultural machinery', 'Agricultural land', 'Seeds', 'Agricultural machinery', 'Fertilizers', 'Spare parts'], see: 'View listing',
  },
};

const categoryNames: Record<Language, string[]> = {
  ar: categories.map((category) => category.label),
  fr: ['Matériel agricole', 'Terrains agricoles', 'Semences', 'Engrais', 'Pièces détachées', 'Produits agricoles', 'Ressources humaines', 'Divers'],
  en: ['Agricultural machinery', 'Agricultural land', 'Seeds', 'Fertilizers', 'Spare parts', 'Agricultural products', 'Farm services', 'Miscellaneous'],
};

const listingTitles: Record<Language, string[]> = {
  ar: listings.map((listing) => listing.title),
  fr: ['Tracteur agricole récent, excellent état', 'Terrain agricole fertile à vendre', 'Semences de blé de qualité', 'Pompe à eau pour irrigation agricole', 'Engrais organique pour cultures', 'Pièces d’origine pour tracteurs'],
  en: ['Modern agricultural tractor in excellent condition', 'Fertile farmland for sale', 'Quality wheat seeds', 'Water pump for farm irrigation', 'Organic fertilizer for crops', 'Genuine tractor spare parts'],
};

const listingLocations: Record<Language, string[]> = {
  ar: ['نواكشوط', 'روصو', 'أطار', 'بوتلميت', 'كيفه', 'نواكشوط'],
  fr: ['Nouakchott', 'Rosso', 'Atar', 'Boutilimit', 'Kiffa', 'Nouakchott'],
  en: ['Nouakchott', 'Rosso', 'Atar', 'Boutilimit', 'Kiffa', 'Nouakchott'],
};

function listingIcon(kind: Listing['icon']) {
  if (kind === 'land') return LandPlot;
  if (kind === 'seed') return Wheat;
  if (kind === 'parts') return Wrench;
  if (kind === 'pump') return Filter;
  if (kind === 'fertilizer') return FlaskConical;
  return Tractor;
}

function ListingCard({ listing, index, language, saved, onSave, onView }: {
  listing: Listing; index: number; language: Language; saved: boolean; onSave: (id: number) => void; onView: () => void;
}) {
  const text = copy[language];
  const Icon = listingIcon(listing.icon);
  const title = listingTitles[language][listing.id - 1];
  const category = text.adCategories[listing.id - 1];
  return (
    <article className="agri-card">
      <button className={`agri-card__photo agri-card__photo--${listing.icon}`} type="button" onClick={onView} aria-label={title}>
        {listing.id === 1 ? <img src="/__mockup/images/agri-home-river-fields.jpg" alt="جرار في حقول زراعية قرب نهر السنغال" loading="lazy" /> : <span className="agri-card__illustration"><Icon size={43} strokeWidth={1.25} /></span>}
        <span className="agri-photo-caption" dir="ltr">Lhriitha / {String(listing.id).padStart(2, '0')}</span>
        {listing.featured && <span className="agri-card__flag"><ShieldCheck size={13} />{language === 'ar' ? 'إعلان مميز' : language === 'fr' ? 'À la une' : 'Featured'}</span>}
      </button>
      <div className="agri-card__content">
        <div className="agri-card__meta"><span>{category}</span><span className="agri-published"><Clock3 size={12} />{text.posted}</span></div>
        <h3>{title}</h3>
        <div className="agri-card__bottom">
          <strong className="agri-price" dir="ltr">{listing.price}</strong>
          <span className="agri-card__location"><MapPin size={14} />{listingLocations[language][index]}</span>
        </div>
        <div className="agri-card__actions">
          <button type="button" className="agri-view-link" onClick={onView}>{text.details}<ArrowUpLeft size={15} /></button>
          <button type="button" aria-label={saved ? (language === 'ar' ? 'إزالة من المحفوظات' : 'Remove saved listing') : (language === 'ar' ? 'حفظ الإعلان' : 'Save listing')} aria-pressed={saved} className={`agri-save ${saved ? 'is-saved' : ''}`} onClick={() => onSave(listing.id)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
    </article>
  );
}

export function Redesign() {
  const [language, setLanguage] = useState<Language>('ar');
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [saved, setSaved] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const text = copy[language];
  const featured = listings.filter((listing) => listing.featured);
  const featuredListing = featured[featureIndex];

  const filtered = useMemo(() => listings.filter((listing) => {
    const term = search.trim().toLocaleLowerCase();
    const title = listingTitles[language][listing.id - 1].toLocaleLowerCase();
    const category = categoryNames[language][categories.findIndex((item) => item.label === listing.category)]?.toLocaleLowerCase() ?? '';
    const location = listingLocations[language][listing.id - 1].toLocaleLowerCase();
    const searchMatch = !term || title.includes(term) || category.includes(term) || location.includes(term) || listing.title.toLocaleLowerCase().includes(term);
    const locationMatch = !selectedLocation || location === selectedLocation.toLocaleLowerCase() || listing.location === selectedLocation;
    const categoryMatch = !selectedCategory || listing.category === selectedCategory;
    return searchMatch && locationMatch && categoryMatch;
  }), [language, search, selectedLocation, selectedCategory]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchSubmitted(true);
    document.getElementById('latest-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const showListing = (listing: Listing) => {
    setSearch(listingTitles[language][listing.id - 1]);
    setSearchSubmitted(true);
    document.getElementById('latest-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleSaved = (id: number) => setSaved((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id]);

  return (
    <div className="agri-redesign" dir={text.direction} lang={language}>
      <header className="agri-header">
        <div className="agri-header__inner">
          <a className="agri-brand" href="#top" aria-label={text.brand}>
            <span className="agri-brand__mark"><Leaf size={23} strokeWidth={2} /></span>
            <span><strong>{text.brand}</strong><small>{text.tagline}</small></span>
          </a>
          <nav className={`agri-nav ${menuOpen ? 'is-open' : ''}`} aria-label={text.menu}>
            <a className="is-active" href="#top" onClick={() => setMenuOpen(false)}>{text.home}</a>
            <a href="#latest-offers" onClick={() => setMenuOpen(false)}>{text.listings}</a>
            <a href="#categories" onClick={() => setMenuOpen(false)}>{text.categories}</a>
            <a href="#footer" onClick={() => setMenuOpen(false)}>{text.more}</a>
          </nav>
          <div className="agri-header__actions">
            <label className="agri-language-select">
              <span className="sr-only">{text.lang}</span>
              <select aria-label={text.lang} value={language} onChange={(event) => setLanguage(event.target.value as Language)} dir="ltr">
                <option value="ar">🇲🇷 AR</option><option value="fr">🇫🇷 FR</option><option value="en">🇺🇸 EN</option>
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            <button type="button" className="agri-login">{text.login}</button>
            <a className="agri-add-link" href="#publish"><Plus size={16} />{text.add}</a>
            <button type="button" className="agri-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="agri-hero">
          <div className="agri-hero__visual" aria-hidden="true"><img src="/__mockup/images/agri-home-river-fields.jpg" alt="" /></div>
          <div className="agri-hero__veil" />
          <div className="agri-hero__content">
            <span className="agri-eyebrow"><span className="agri-eyebrow__dot" />{text.heroBadge}</span>
            <h1>{text.title.split('\\n').map((line, index) => <span key={index}>{line}</span>)}</h1>
            <p>{text.intro}</p>
            <div className="agri-hero__trust"><ShieldCheck size={15} />{text.trusted}</div>
          </div>
          <span className="agri-hero__stamp" dir="ltr">16°30′N<br />16°09′W</span>
        </section>

        <section className="agri-search-wrap" aria-label={text.search}>
          <form className="agri-search" onSubmit={submitSearch}>
            <label className="agri-search__term">
              <Search size={20} />
              <span className="sr-only">{text.search}</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} />
            </label>
            <label className="agri-search__location">
              <MapPin size={18} />
              <span className="sr-only">{text.location}</span>
              <select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                <option value="">{text.location}</option>
                {text.locations.map((location) => <option key={location} value={location}>{location}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
            <button className="agri-search__submit" type="submit"><Search size={17} />{text.searchButton}</button>
          </form>
          <div className="agri-search__under">
            <span>{text.quick}</span>
            {['جرار', 'أرض زراعية', 'قطع غيار'].map((term) => <button key={term} type="button" onClick={() => { setSearch(term); setSearchSubmitted(true); }}>{term}</button>)}
            <small>{text.searchHint}</small>
          </div>
        </section>

        <section id="categories" className="agri-section agri-categories">
          <div className="agri-section-heading">
            <div><span className="agri-section-kicker">01 / {text.categories}</span><h2>{text.categories}</h2><p>{text.categoryIntro}</p></div>
            <a href="#latest-offers" className="agri-text-link">{text.all}<ArrowLeft size={16} /></a>
          </div>
          <div className="agri-category-list">
            {categories.map(({ slug, count, icon: Icon, label }, index) => (
              <button key={slug} type="button" className={`agri-category ${selectedCategory === label ? 'is-selected' : ''}`} onClick={() => { setSelectedCategory((current) => current === label ? '' : label); setSearchSubmitted(true); }}>
                <span className={`agri-category__icon agri-category__icon--${index}`}><Icon size={20} strokeWidth={1.7} /></span>
                <strong>{categoryNames[language][index]}</strong>
                <small>{count} {text.count}</small>
                <ArrowUpLeft className="agri-category__arrow" size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className="agri-featured-band">
          <div className="agri-featured-band__inner">
            <div className="agri-featured-copy">
              <span className="agri-section-kicker">02 / {language === 'ar' ? 'اختيارات السوق' : language === 'fr' ? 'SÉLECTION DU MARCHÉ' : 'MARKET PICKS'}</span>
              <h2>{text.featured}</h2>
              <p>{text.featuredSub}</p>
              <div className="agri-featured-copy__mark"><Wheat size={27} strokeWidth={1.2} /><span dir="ltr">SENEGAL RIVER<br />AGRICULTURAL BELT</span></div>
              <div className="agri-featured-controls" dir="ltr">
                <button type="button" aria-label="Previous featured listing" onClick={() => setFeatureIndex((index) => (index + featured.length - 1) % featured.length)}><ChevronLeft size={18} /></button>
                <span>0{featureIndex + 1} <i /> 0{featured.length}</span>
                <button type="button" aria-label="Next featured listing" onClick={() => setFeatureIndex((index) => (index + 1) % featured.length)}><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="agri-feature-card">
              <div className={`agri-feature-card__image agri-feature-card__image--${featuredListing.icon}`}>
                {featuredListing.id === 1 ? <img src="/__mockup/images/agri-home-river-fields.jpg" alt="جرار زراعي في حقل موريتاني" /> : <span><LandPlot size={106} strokeWidth={0.75} /></span>}
                <span className="agri-feature-card__location"><MapPin size={14} />{listingLocations[language][featuredListing.id - 1]}</span>
              </div>
              <div className="agri-feature-card__details">
                <span className="agri-feature-card__type"><span />{text.adCategories[featuredListing.id - 1]}</span>
                <h3>{listingTitles[language][featuredListing.id - 1]}</h3>
                <div className="agri-feature-card__bottom"><strong dir="ltr">{featuredListing.price}</strong><button type="button" onClick={() => showListing(featuredListing)}>{text.see}<ArrowUpLeft size={16} /></button></div>
              </div>
            </div>
          </div>
        </section>

        <section id="latest-offers" className="agri-section agri-latest">
          <div className="agri-section-heading">
            <div><span className="agri-section-kicker">03 / {language === 'ar' ? 'وصلت حديثاً' : language === 'fr' ? 'NOUVEAUTÉS' : 'JUST ARRIVED'}</span><h2>{text.latest}</h2><p>{text.latestSub}</p></div>
            <button type="button" className="agri-text-link" onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedLocation(''); }}>{text.seeAll}<ArrowLeft size={16} /></button>
          </div>
          {(searchSubmitted || selectedCategory || selectedLocation) && <div className="agri-filter-status"><span>{text.allResults} · {filtered.length}</span><button type="button" onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedLocation(''); setSearchSubmitted(false); }}>{text.reset}<X size={14} /></button></div>}
          {filtered.length ? <div className="agri-listing-grid">
            {filtered.map((listing) => <ListingCard key={listing.id} listing={listing} index={listing.id - 1} language={language} saved={saved.includes(listing.id)} onSave={toggleSaved} onView={() => showListing(listing)} />)}
          </div> : <div className="agri-empty"><Search size={25} /><strong>{text.noResults}</strong><button type="button" onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedLocation(''); }}>{text.reset}</button></div>}
        </section>

        <section className="agri-trust-strip">
          <div className="agri-trust-strip__icon"><ShieldCheck size={25} /></div>
          <div><span className="agri-section-kicker">{language === 'ar' ? 'من السوق، وللسوق' : language === 'fr' ? 'DU MARCHÉ, POUR LE MARCHÉ' : 'BUILT AROUND LOCAL TRADE'}</span><h2>{text.trusted}</h2><p>{text.trustedSub}</p></div>
          <div className="agri-trust-strip__places"><span>ROSSO</span><i /><span>KAEDI</span><i /><span>ATAR</span></div>
        </section>

        <section id="publish" className="agri-cta">
          <div className="agri-cta__motif"><span /><span /><span /><span /><span /></div>
          <div><span className="agri-section-kicker">SOUK AGRICOLE / MAURITANIE</span><h2>{text.cta}</h2><p>{text.ctaSub}</p></div>
          <a href="#top" className="agri-cta__button">{text.ctaButton}<ArrowRight size={17} /></a>
        </section>
      </main>

      <footer className="agri-footer" id="footer">
        <a href="#top" className="agri-brand agri-brand--footer"><span className="agri-brand__mark"><Leaf size={21} /></span><span><strong>{text.brand}</strong><small>{text.tagline}</small></span></a>
        <p>{text.footer}</p>
        <div className="agri-footer__links"><a href="#top">{text.home}</a><a href="#latest-offers">{text.listings}</a><a href="#categories">{text.categories}</a></div>
        <span className="agri-footer__fine" dir="ltr">NOUAKCHOTT · MAURITANIA</span>
      </footer>
      <a className="agri-support" href="#footer" aria-label={language === 'ar' ? 'الدعم' : 'Support'}><CircleHelp size={17} /><span>{language === 'ar' ? 'الدعم' : language === 'fr' ? 'Aide' : 'Support'}</span></a>
    </div>
  );
}