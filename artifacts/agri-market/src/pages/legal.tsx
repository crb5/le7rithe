import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, CalendarDays, FileText, ShieldCheck } from 'lucide-react';
import { AppShell, PageHeading } from '@/components/marketplace-ui';
import { useLanguage, type MarketplaceLanguage } from '@/lib/language';
import { ENABLE_PAID_LISTINGS } from '@/lib/features';
import { SITE_NAME } from '@/lib/brand';
import { getGetLegalPolicyQueryKey, useGetLegalPolicy } from '@workspace/api-client-react';

type LegalCopy = {
  title: string;
  description: string;
  back: string;
  sections: Array<{ title: string; body: string; feature?: 'paidListings' }>;
};

type PrivacySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  paragraphsAfter?: string[];
};

type PrivacyCopy = {
  title: string;
  eyebrow: string;
  description: string;
  introduction: string;
  lastUpdated: string;
  version: string;
  loadingDate: string;
  dateUnavailable: string;
  retry: string;
  contents: string;
  back: string;
  sections: PrivacySection[];
  footer: string;
};

const privacyCopy: Record<MarketplaceLanguage, PrivacyCopy> = {
  ar: {
    title: 'سياسة الخصوصية',
    eyebrow: 'الخصوصية',
    description: 'سياسة الخصوصية — le7rithe',
    introduction: 'مرحبًا بك في le7rithe. نحترم خصوصيتك ونلتزم بحماية المعلومات التي تقدمها عند استخدام خدماتنا.',
    lastUpdated: 'آخر تحديث',
    version: 'الإصدار',
    loadingDate: 'جارٍ تحميل التاريخ…',
    dateUnavailable: 'تعذر تحميل التاريخ',
    retry: 'إعادة المحاولة',
    contents: 'محتويات السياسة',
    back: 'العودة إلى السوق',
    sections: [
      {
        title: 'المعلومات التي نجمعها',
        paragraphs: ['قد نجمع المعلومات التي يقدمها المستخدم عند إنشاء حساب أو استخدام المنصة، مثل:'],
        bullets: [
          'الاسم الأول واسم العائلة.',
          'معلومات تسجيل الدخول والمصادقة.',
          'معلومات الإعلانات التي ينشرها المستخدم.',
          'الصور والملفات التي يرفعها المستخدم.',
          'معلومات التواصل التي يختار المستخدم إظهارها في الإعلان.',
          'معلومات مرتبطة بالمدفوعات أو إثباتات الدفع عند استخدام الخدمات المدفوعة.',
          'معلومات تقنية ضرورية لتشغيل المنصة وحمايتها، مثل عنوان IP ومعلومات المتصفح والجهاز وسجلات الأخطاء.',
        ],
        paragraphsAfter: ['لا نطلب من المستخدم تقديم معلومات شخصية أكثر مما هو ضروري لتشغيل الخدمة.'],
      } as PrivacySection,
      {
        title: 'كيف نستخدم المعلومات',
        paragraphs: ['نستخدم المعلومات من أجل:'],
        bullets: [
          'إنشاء وإدارة الحسابات.',
          'نشر وإدارة الإعلانات.',
          'عرض الإعلانات للمستخدمين.',
          'تشغيل البحث والتصنيفات والفلاتر.',
          'معالجة الخدمات المدفوعة والتحقق منها.',
          'إرسال الإشعارات المتعلقة بالإعلانات والحساب.',
          'حماية المنصة من الاحتيال وإساءة الاستخدام.',
          'اكتشاف الأخطاء وتحسين الأداء والأمان.',
          'الالتزام بالمتطلبات القانونية عند الاقتضاء.',
        ],
      },
      {
        title: 'الإعلانات والمعلومات العامة',
        paragraphs: ['عند نشر إعلان، قد تصبح بعض المعلومات التي اختار المستخدم إدخالها متاحة للعامة، مثل:'],
        bullets: [
          'عنوان الإعلان.',
          'الوصف.',
          'الصور.',
          'السعر.',
          'المنطقة أو الموقع التقريبي الذي اختاره المستخدم.',
          'معلومات التواصل التي اختار المستخدم نشرها.',
        ],
        paragraphsAfter: ['يجب على المستخدم عدم نشر معلومات شخصية أو حساسة لا يرغب في جعلها متاحة للعامة.'],
      } as PrivacySection,
      {
        title: 'الصور والملفات',
        paragraphs: [
          'قد يتم تخزين الصور والملفات التي يرفعها المستخدم باستخدام خدمات التخزين الخاصة بالمنصة.',
          'نستخدم وسائل تقنية مناسبة للتحكم في الوصول إلى الملفات وفقًا لحالة الحساب وصلاحيات المستخدم.',
          'يُمنع رفع ملفات غير قانونية أو ضارة أو تحتوي على برمجيات خبيثة.',
        ],
      },
      {
        title: 'معلومات الدفع',
        paragraphs: [
          'قد نحتاج إلى معلومات مرتبطة بعملية الدفع أو إثبات الدفع عند استخدام الخدمات المدفوعة.',
          'لا ينبغي للمستخدم إرسال كلمات المرور أو رموز OTP أو بيانات بطاقات الدفع السرية داخل إثبات الدفع أو المحادثات أو الإعلانات.',
        ],
      },
      {
        title: 'ملفات تعريف الارتباط والتقنيات المشابهة',
        paragraphs: ['قد تستخدم المنصة Cookies أو تقنيات مشابهة من أجل:'],
        bullets: [
          'الحفاظ على جلسة تسجيل الدخول.',
          'تذكر بعض إعدادات المستخدم.',
          'حماية الحساب والمنصة.',
          'تحسين الأداء وتجربة الاستخدام.',
        ],
        paragraphsAfter: ['قد تتطلب بعض ملفات الارتباط موافقة المستخدم حسب الغرض منها والقوانين المطبقة.'],
      } as PrivacySection,
      {
        title: 'مشاركة المعلومات',
        paragraphs: [
          'لا نبيع المعلومات الشخصية للمستخدمين.',
          'قد تتم مشاركة بعض المعلومات مع مزودي الخدمات الذين يساعدون في تشغيل المنصة، مثل خدمات الاستضافة أو المصادقة أو التخزين أو الخدمات التقنية، وذلك بالقدر اللازم لتقديم الخدمة وحمايتها.',
          'قد يتم الكشف عن المعلومات عندما يكون ذلك مطلوبًا بموجب القانون أو لحماية حقوق المنصة والمستخدمين وسلامتهم.',
        ],
      },
      {
        title: 'مدة الاحتفاظ بالمعلومات',
        paragraphs: [
          'نحتفظ بالمعلومات طالما كانت ضرورية لتقديم الخدمات أو لأغراض قانونية وأمنية وتشغيلية مشروعة.',
          'قد يتم حذف أو إخفاء بعض البيانات عندما لا تعود هناك حاجة إليها، مع مراعاة المتطلبات القانونية.',
        ],
      },
      {
        title: 'حماية الحساب',
        paragraphs: [
          'المستخدم مسؤول عن الحفاظ على أمان حسابه وعدم مشاركة بيانات تسجيل الدخول مع الآخرين.',
          'إذا اشتبه المستخدم في وجود وصول غير مصرح به إلى حسابه، يجب عليه التواصل مع دعم المنصة في أقرب وقت ممكن.',
        ],
      },
      {
        title: 'حقوق المستخدم',
        paragraphs: [
          'وفقًا للقوانين المطبقة، قد يكون للمستخدم حقوق تتعلق بمعلوماته الشخصية، مثل طلب الوصول إلى بعض بياناته أو تصحيحها أو حذفها عندما يكون ذلك متاحًا قانونيًا.',
          'يمكن التواصل مع دعم le7rithe بخصوص طلبات الخصوصية.',
        ],
      },
      {
        title: 'خصوصية الأطفال',
        paragraphs: ['المنصة ليست موجهة للأطفال، ولا نشجع الأشخاص الذين لا يسمح لهم القانون باستخدام هذه الخدمات على إنشاء حساب أو استخدام الخدمات.'],
      },
      {
        title: 'تغييرات سياسة الخصوصية',
        paragraphs: [
          'قد نقوم بتحديث سياسة الخصوصية عند الحاجة.',
          'عند إجراء تغييرات مهمة، قد يتم تحديث تاريخ «آخر تحديث» أو تقديم إشعار مناسب داخل المنصة.',
        ],
      },
      {
        title: 'التواصل',
        paragraphs: ['للاستفسارات المتعلقة بالخصوصية أو البيانات الشخصية، يمكن التواصل مع دعم le7rithe من خلال وسائل الدعم المتاحة داخل المنصة.'],
      },
      {
        title: 'الموافقة',
        paragraphs: ['باستخدام le7rithe وإنشاء حساب عندما تكون الموافقة مطلوبة، يقر المستخدم بأنه قرأ هذه السياسة وفهم كيفية التعامل مع المعلومات وفقًا لما هو موضح فيها.'],
      },
    ],
    footer: 'le7rithe',
  },
  fr: {
    title: 'Politique de confidentialité',
    eyebrow: 'Confidentialité',
    description: 'Politique de confidentialité — le7rithe',
    introduction: 'Bienvenue sur le7rithe. Nous respectons votre vie privée et nous nous engageons à protéger les informations que vous fournissez lorsque vous utilisez nos services.',
    lastUpdated: 'Dernière mise à jour',
    version: 'Version',
    loadingDate: 'Chargement de la date…',
    dateUnavailable: 'Impossible de charger la date',
    retry: 'Réessayer',
    contents: 'Sommaire de la politique',
    back: 'Retour au marché',
    sections: [
      {
        title: 'Informations que nous recueillons',
        paragraphs: ['Nous pouvons recueillir les informations fournies par l’utilisateur lors de la création d’un compte ou de l’utilisation de la plateforme, telles que :'],
        bullets: [
          'Le prénom et le nom.',
          'Les informations de connexion et d’authentification.',
          'Les informations relatives aux annonces publiées par l’utilisateur.',
          'Les images et fichiers téléversés par l’utilisateur.',
          'Les coordonnées que l’utilisateur choisit d’afficher dans l’annonce.',
          'Les informations relatives aux paiements ou aux justificatifs de paiement lors de l’utilisation de services payants.',
          'Les informations techniques nécessaires au fonctionnement et à la protection de la plateforme, telles que l’adresse IP, les informations sur le navigateur et l’appareil, ainsi que les journaux d’erreurs.',
        ],
        paragraphsAfter: ['Nous ne demandons pas à l’utilisateur de fournir davantage d’informations personnelles que nécessaire au fonctionnement du service.'],
      } as PrivacySection,
      {
        title: 'Comment nous utilisons les informations',
        paragraphs: ['Nous utilisons les informations afin de :'],
        bullets: [
          'Créer et gérer les comptes.',
          'Publier et gérer les annonces.',
          'Afficher les annonces aux utilisateurs.',
          'Faire fonctionner la recherche, les catégories et les filtres.',
          'Traiter et vérifier les services payants.',
          'Envoyer des notifications relatives aux annonces et au compte.',
          'Protéger la plateforme contre la fraude et les abus.',
          'Détecter les erreurs et améliorer les performances et la sécurité.',
          'Respecter les exigences légales, le cas échéant.',
        ],
      },
      {
        title: 'Annonces et informations publiques',
        paragraphs: ['Lorsqu’il publie une annonce, certaines informations saisies par l’utilisateur peuvent devenir publiques, telles que :'],
        bullets: [
          'Le titre de l’annonce.',
          'La description.',
          'Les images.',
          'Le prix.',
          'La région ou la localisation approximative choisie par l’utilisateur.',
          'Les coordonnées que l’utilisateur choisit de publier.',
        ],
        paragraphsAfter: ['L’utilisateur ne doit pas publier d’informations personnelles ou sensibles qu’il ne souhaite pas rendre accessibles au public.'],
      } as PrivacySection,
      {
        title: 'Images et fichiers',
        paragraphs: [
          'Les images et fichiers téléversés par l’utilisateur peuvent être stockés au moyen des services de stockage de la plateforme.',
          'Nous utilisons des moyens techniques appropriés pour contrôler l’accès aux fichiers en fonction de l’état du compte et des autorisations de l’utilisateur.',
          'Le téléversement de fichiers illégaux, nuisibles ou contenant des logiciels malveillants est interdit.',
        ],
      },
      {
        title: 'Informations de paiement',
        paragraphs: [
          'Nous pouvons avoir besoin d’informations relatives à une opération ou à un justificatif de paiement lors de l’utilisation de services payants.',
          'L’utilisateur ne doit pas envoyer de mots de passe, de codes OTP ou de données confidentielles de carte de paiement dans un justificatif de paiement, une conversation ou une annonce.',
        ],
      },
      {
        title: 'Cookies et technologies similaires',
        paragraphs: ['La plateforme peut utiliser des cookies ou des technologies similaires afin de :'],
        bullets: [
          'Maintenir la session de connexion.',
          'Mémoriser certains paramètres de l’utilisateur.',
          'Protéger le compte et la plateforme.',
          'Améliorer les performances et l’expérience d’utilisation.',
        ],
        paragraphsAfter: ['Certains cookies peuvent nécessiter le consentement de l’utilisateur selon leur finalité et les lois applicables.'],
      } as PrivacySection,
      {
        title: 'Partage des informations',
        paragraphs: [
          'Nous ne vendons pas les informations personnelles des utilisateurs.',
          'Certaines informations peuvent être partagées avec les prestataires qui contribuent au fonctionnement de la plateforme, tels que les services d’hébergement, d’authentification, de stockage ou les services techniques, dans la mesure nécessaire à la fourniture et à la protection du service.',
          'Des informations peuvent être divulguées lorsque la loi l’exige ou afin de protéger les droits de la plateforme et des utilisateurs ainsi que leur sécurité.',
        ],
      },
      {
        title: 'Durée de conservation des informations',
        paragraphs: [
          'Nous conservons les informations aussi longtemps qu’elles sont nécessaires à la fourniture des services ou à des fins légitimes, juridiques, de sécurité et de fonctionnement.',
          'Certaines données peuvent être supprimées ou masquées lorsqu’elles ne sont plus nécessaires, sous réserve des exigences légales.',
        ],
      },
      {
        title: 'Sécurité du compte',
        paragraphs: [
          'L’utilisateur est responsable de la sécurité de son compte et ne doit pas partager ses identifiants de connexion avec d’autres personnes.',
          'Si l’utilisateur soupçonne un accès non autorisé à son compte, il doit contacter le support de la plateforme dans les meilleurs délais.',
        ],
      },
      {
        title: 'Droits de l’utilisateur',
        paragraphs: [
          'Selon les lois applicables, l’utilisateur peut disposer de droits concernant ses informations personnelles, tels que demander l’accès à certaines de ses données, leur rectification ou leur suppression lorsque la loi le permet.',
          'Les demandes relatives à la confidentialité peuvent être adressées au support de le7rithe.',
        ],
      },
      {
        title: 'Confidentialité des enfants',
        paragraphs: ['La plateforme ne s’adresse pas aux enfants et nous n’encourageons pas les personnes que la loi n’autorise pas à utiliser ces services à créer un compte ou à utiliser les services.'],
      },
      {
        title: 'Modifications de la politique de confidentialité',
        paragraphs: [
          'Nous pouvons mettre à jour la politique de confidentialité lorsque cela est nécessaire.',
          'En cas de modifications importantes, la date de « dernière mise à jour » peut être actualisée ou un avis approprié peut être présenté sur la plateforme.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: ['Pour toute question relative à la confidentialité ou aux données personnelles, vous pouvez contacter le support de le7rithe par les moyens d’assistance disponibles sur la plateforme.'],
      },
      {
        title: 'Consentement',
        paragraphs: ['En utilisant le7rithe et en créant un compte lorsque le consentement est requis, l’utilisateur reconnaît avoir lu cette politique et compris la manière dont les informations sont traitées conformément à ce qui y est indiqué.'],
      },
    ],
    footer: 'le7rithe',
  },
  en: {
    title: 'Privacy Policy',
    eyebrow: 'Privacy',
    description: 'Privacy Policy — le7rithe',
    introduction: 'Welcome to le7rithe. We respect your privacy and are committed to protecting the information you provide when using our services.',
    lastUpdated: 'Last updated',
    version: 'Version',
    loadingDate: 'Loading date…',
    dateUnavailable: 'Unable to load date',
    retry: 'Try again',
    contents: 'Policy contents',
    back: 'Back to the market',
    sections: [
      {
        title: 'Information We Collect',
        paragraphs: ['We may collect information provided by a user when creating an account or using the platform, such as:'],
        bullets: [
          'First and last name.',
          'Login and authentication information.',
          'Information about listings posted by the user.',
          'Images and files uploaded by the user.',
          'Contact information the user chooses to display in a listing.',
          'Information related to payments or proof of payment when using paid services.',
          'Technical information necessary to operate and protect the platform, such as IP address, browser and device information, and error logs.',
        ],
        paragraphsAfter: ['We do not ask users to provide more personal information than is necessary to operate the service.'],
      } as PrivacySection,
      {
        title: 'How We Use Information',
        paragraphs: ['We use information to:'],
        bullets: [
          'Create and manage accounts.',
          'Post and manage listings.',
          'Display listings to users.',
          'Operate search, categories, and filters.',
          'Process and verify paid services.',
          'Send notifications related to listings and accounts.',
          'Protect the platform from fraud and misuse.',
          'Detect errors and improve performance and security.',
          'Comply with legal requirements where applicable.',
        ],
      },
      {
        title: 'Listings and Public Information',
        paragraphs: ['When a user posts a listing, some information they choose to enter may become publicly available, such as:'],
        bullets: [
          'The listing title.',
          'The description.',
          'Images.',
          'The price.',
          'The region or approximate location chosen by the user.',
          'Contact information the user chooses to publish.',
        ],
        paragraphsAfter: ['Users should not publish personal or sensitive information they do not want to make publicly available.'],
      } as PrivacySection,
      {
        title: 'Images and Files',
        paragraphs: [
          'Images and files uploaded by users may be stored using the platform’s storage services.',
          'We use appropriate technical measures to control access to files according to account status and user permissions.',
          'Uploading illegal or harmful files, or files containing malware, is prohibited.',
        ],
      },
      {
        title: 'Payment Information',
        paragraphs: [
          'We may need information related to a payment transaction or proof of payment when paid services are used.',
          'Users should not send passwords, OTP codes, or confidential payment card details in proof of payment, conversations, or listings.',
        ],
      },
      {
        title: 'Cookies and Similar Technologies',
        paragraphs: ['The platform may use cookies or similar technologies to:'],
        bullets: [
          'Maintain the login session.',
          'Remember some user settings.',
          'Protect the account and platform.',
          'Improve performance and the user experience.',
        ],
        paragraphsAfter: ['Some cookies may require user consent depending on their purpose and applicable laws.'],
      } as PrivacySection,
      {
        title: 'Sharing Information',
        paragraphs: [
          'We do not sell users’ personal information.',
          'Some information may be shared with service providers that help operate the platform, such as hosting, authentication, storage, or technical services, to the extent necessary to provide and protect the service.',
          'Information may be disclosed when required by law or to protect the rights of the platform and users and their safety.',
        ],
      },
      {
        title: 'How Long We Keep Information',
        paragraphs: [
          'We retain information for as long as it is necessary to provide the services or for legitimate legal, security, and operational purposes.',
          'Some data may be deleted or hidden when it is no longer needed, subject to legal requirements.',
        ],
      },
      {
        title: 'Account Security',
        paragraphs: [
          'Users are responsible for keeping their accounts secure and not sharing their login information with others.',
          'If a user suspects unauthorized access to their account, they should contact platform support as soon as possible.',
        ],
      },
      {
        title: 'User Rights',
        paragraphs: [
          'Depending on applicable laws, users may have rights concerning their personal information, such as requesting access to some of their data, its correction, or its deletion where legally available.',
          'Users may contact le7rithe support about privacy requests.',
        ],
      },
      {
        title: 'Children’s Privacy',
        paragraphs: ['The platform is not directed at children, and we do not encourage people who are not legally permitted to use these services to create an account or use the services.'],
      },
      {
        title: 'Changes to the Privacy Policy',
        paragraphs: [
          'We may update the Privacy Policy when needed.',
          'When important changes are made, the “Last updated” date may be updated or an appropriate notice may be provided within the platform.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: ['For questions about privacy or personal data, users may contact le7rithe support through the support options available within the platform.'],
      },
      {
        title: 'Consent',
        paragraphs: ['By using le7rithe and creating an account when consent is required, the user acknowledges that they have read this policy and understand how information is handled as described in it.'],
      },
    ],
    footer: 'le7rithe',
  },
};

const copy: Record<'terms', Record<MarketplaceLanguage, LegalCopy>> = {
  terms: {
    ar: {
      title: 'الشروط والأحكام',
      description: `القواعد الأساسية لاستخدام ${SITE_NAME} ونشر الإعلانات والتواصل.`,
      back: 'العودة إلى السوق',
      sections: [
        { title: 'استخدام المنصة', body: 'يجب استخدام السوق بطريقة قانونية وصادقة، وتقديم معلومات دقيقة عن الإعلان، وعدم انتحال هوية شخص أو جهة أخرى.' },
        { title: 'مسؤولية الإعلان', body: 'البائع مسؤول عن ملكية المنتج أو الخدمة ودقة السعر والوصف والصور وبيانات التواصل. لا يضمن السوق إتمام الصفقة بين الأطراف.' },
        { title: 'الدفع والمراجعة', body: 'الدفع اليدوي مخصص لمراجعة نشر الإعلان. يبقى الإعلان مخفياً حتى تأكيد الدفع وموافقة الإدارة، ولا يعني تأكيد الدفع ضماناً للصفقة أو للمنتج.', feature: 'paidListings' },
        { title: 'المحتوى الممنوع', body: 'يُمنع نشر محتوى احتيالي أو مضلل أو مخالف للقانون أو ينتهك حقوق الآخرين. يمكن للإدارة إخفاء الإعلان أو تعليق الحساب عند وجود سبب مشروع.' },
        { title: 'البلاغات والدعم', body: 'استخدم البلاغات والدعم للإبلاغ عن مشكلة حقيقية، ولا تستخدمهما للمضايقة أو إرسال معلومات حساسة غير لازمة.' },
      ],
    },
    fr: {
      title: 'Conditions d’utilisation',
      description: `Règles essentielles pour utiliser ${SITE_NAME}, publier et échanger.`,
      back: 'Retour au marché',
      sections: [
        { title: 'Utilisation', body: 'Le marché doit être utilisé légalement et honnêtement. Les informations publiées doivent être exactes et ne pas usurper l’identité d’une personne ou d’une organisation.' },
        { title: 'Responsabilité de l’annonce', body: 'Le vendeur est responsable de la propriété, du prix, de la description, des images et des coordonnées publiés. Le marché ne garantit pas la conclusion d’une transaction.' },
        { title: 'Paiement et validation', body: 'Le paiement manuel sert à examiner la publication. L’annonce reste masquée jusqu’à la confirmation du paiement et la validation administrative.', feature: 'paidListings' },
        { title: 'Contenu interdit', body: 'Les contenus frauduleux, trompeurs, illégaux ou portant atteinte aux droits d’autrui sont interdits. L’administration peut masquer une annonce ou suspendre un compte.' },
        { title: 'Signalements et support', body: 'Utilisez les signalements et le support pour un problème réel, sans harcèlement ni données sensibles inutiles.' },
      ],
    },
    en: {
      title: 'Terms of use',
      description: `The basic rules for using ${SITE_NAME}, posting listings, and communicating.`,
      back: 'Back to the market',
      sections: [
        { title: 'Using the platform', body: 'Use the marketplace lawfully and honestly. Listing information must be accurate and must not impersonate another person or organization.' },
        { title: 'Listing responsibility', body: 'Sellers are responsible for ownership, price, description, images, and contact details. The marketplace does not guarantee that a transaction will be completed.' },
        { title: 'Payment and review', body: 'Manual payment is used to review publication. A listing stays hidden until payment is confirmed and administration approves it.', feature: 'paidListings' },
        { title: 'Prohibited content', body: 'Fraudulent, misleading, unlawful, or rights-infringing content is prohibited. Administration may hide a listing or suspend an account for a valid reason.' },
        { title: 'Reports and support', body: 'Use reports and support for genuine issues, without harassment or unnecessary sensitive information.' },
      ],
    },
  },
};

function LegalPage({ kind, icon: Icon }: { kind: 'privacy' | 'terms'; icon: typeof ShieldCheck }) {
  const { language, meta } = useLanguage();
  const policyQuery = useGetLegalPolicy({
    query: {
      enabled: kind === 'privacy',
      queryKey: getGetLegalPolicyQueryKey(),
    },
  });
  const content = copy.terms[language];
  const visibleSections = content.sections.filter(
    (section) => section.feature !== 'paidListings' || ENABLE_PAID_LISTINGS,
  );

  if (kind === 'privacy') {
    const policy = privacyCopy[language];
    const privacySections = policy.sections;
    const date = policyQuery.data?.lastUpdated[language];
    return (
      <AppShell>
        <div dir={meta[language].dir} data-testid="privacy-policy-page">
          <PageHeading eyebrow={policy.eyebrow} title={policy.title} description={policy.description} />
          <div className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6" data-testid="privacy-policy-content">
            <header className="overflow-hidden rounded-[1.6rem] border border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_18px_40px_hsl(155_20%_18%/.12)]">
              <div className="relative p-5 sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -end-10 -top-16 h-48 w-48 rounded-full border border-[hsl(var(--primary-foreground)/.12)]" />
                <div aria-hidden="true" className="pointer-events-none absolute -end-2 -top-8 h-32 w-32 rounded-full border border-[hsl(var(--primary-foreground)/.12)]" />
                <div className="relative flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]">
                    <Icon size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.68)]" data-testid="privacy-policy-label">
                      {policy.description}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl" data-testid="privacy-policy-title">{policy.title}</h2>
                  </div>
                </div>
                <p className="relative mt-6 max-w-3xl text-sm leading-7 text-[hsl(var(--primary-foreground)/.86)]" data-testid="privacy-policy-introduction">
                  {policy.introduction}
                </p>
                <div className="relative mt-6 flex flex-wrap items-center gap-2">
                  <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--primary-foreground)/.18)] bg-[hsl(var(--primary-foreground)/.07)] px-3 py-2 text-xs" aria-live="polite" data-testid="privacy-policy-last-updated">
                    <CalendarDays size={15} aria-hidden="true" />
                    <span className="font-semibold">{policy.lastUpdated}:</span>
                    {policyQuery.isLoading ? (
                      <span className="inline-block h-4 w-24 animate-pulse rounded bg-[hsl(var(--primary-foreground)/.16)]" aria-label={policy.loadingDate} />
                    ) : date ? (
                      <span dir="auto" className="font-semibold">{date}</span>
                    ) : (
                      <span>{policy.dateUnavailable}</span>
                    )}
                  </div>
                  {policyQuery.data?.privacyVersion && (
                    <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--primary-foreground)/.18)] bg-[hsl(var(--primary-foreground)/.07)] px-3 py-2 text-xs" data-testid="privacy-policy-version">
                      <span className="font-semibold">{policy.version}:</span>
                      <span dir="ltr" className="font-semibold">{policyQuery.data.privacyVersion}</span>
                    </div>
                  )}
                </div>
                {policyQuery.isError && (
                  <div className="relative mt-3 flex flex-wrap items-center gap-3 text-xs" role="status" data-testid="privacy-policy-load-error">
                    <span>{policy.dateUnavailable}</span>
                    <button
                      type="button"
                      onClick={() => void policyQuery.refetch()}
                      className="min-h-9 rounded-lg bg-[hsl(var(--primary-foreground)/.12)] px-3 font-bold underline underline-offset-2 hover:bg-[hsl(var(--primary-foreground)/.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
                      data-testid="button-retry-privacy-policy"
                    >
                      {policy.retry}
                    </button>
                  </div>
                )}
              </div>
            </header>

            <nav className="my-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5" aria-label={policy.contents} data-testid="privacy-policy-contents">
              <p className="mb-3 text-xs font-bold text-[hsl(var(--muted-foreground))]">{policy.contents}</p>
              <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {privacySections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#privacy-section-${index + 1}`}
                      className="flex min-h-10 items-start gap-2 rounded-lg px-2 py-2 text-xs leading-5 text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
                      data-testid={`link-privacy-contents-${index + 1}`}
                    >
                      <span className="shrink-0 font-bold tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="space-y-3 sm:space-y-4">
              {privacySections.map((section, index) => (
                <section
                  id={`privacy-section-${index + 1}`}
                  key={section.title}
                  className="scroll-mt-5 rounded-[1.25rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_6px_20px_hsl(155_20%_18%/.035)] sm:p-7"
                  data-testid={`legal-section-privacy-${index}`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-xs font-bold tabular-nums text-[hsl(var(--primary))]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold leading-6 text-[hsl(var(--primary))] sm:text-lg">{section.title}</h2>
                      {section.paragraphs?.map((paragraph, paragraphIndex) => (
                        <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]" key={`p-${paragraphIndex}`}>
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets && (
                        <ul className="mt-2 list-disc space-y-2 ps-5 text-sm leading-7 text-[hsl(var(--muted-foreground))] marker:text-[hsl(var(--primary))]">
                          {section.bullets.map((bullet, bulletIndex) => (
                            <li className="ps-1" key={`b-${bulletIndex}`} data-testid={`privacy-bullet-${index + 1}-${bulletIndex + 1}`}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                      {'paragraphsAfter' in section && section.paragraphsAfter?.map((paragraph, paragraphIndex) => (
                        <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]" key={`pa-${paragraphIndex}`}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[hsl(var(--border))] pt-5" data-testid="privacy-policy-footer">
              <span dir="ltr" className="text-xs font-bold tracking-wide text-[hsl(var(--muted-foreground))]">{policy.footer}</span>
              <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary))] transition hover:border-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" data-testid="link-legal-back-privacy">
                {language === 'ar' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                {policy.back}
              </Link>
            </footer>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div dir={meta[language].dir}>
        <PageHeading eyebrow="Terms" title={content.title} description={content.description} />
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="mb-7 rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] shadow-[0_14px_34px_hsl(155_20%_18%/.1)] sm:p-7">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><Icon size={19} /></span><p className="text-sm font-bold">{content.title}</p></div>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[hsl(var(--primary-foreground)/.78)]">{content.description}</p>
          </div>
          {visibleSections.map((section, index) => (
          <section key={section.title} className="group rounded-[1.35rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_6px_20px_hsl(155_20%_18%/.035)] transition hover:border-[hsl(var(--accent)/.7)] sm:p-7" data-testid={`legal-section-${kind}-${index}`}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{String(index + 1).padStart(2, '0')}</span>
              <div><h2 className="font-bold text-[hsl(var(--primary))]">{section.title}</h2><p className="mt-2 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{section.body}</p></div>
            </div>
          </section>
          ))}
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary))] transition hover:border-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" data-testid={`link-legal-back-${kind}`}>{language === 'ar' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}{content.back}</Link>
        </div>
      </div>
    </AppShell>
  );
}

export function PrivacyPolicy() {
  return <LegalPage kind="privacy" icon={ShieldCheck} />;
}

export function TermsOfService() {
  return <LegalPage kind="terms" icon={FileText} />;
}