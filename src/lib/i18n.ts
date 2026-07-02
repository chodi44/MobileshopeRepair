import type { RepairStatus } from "./repair-status";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr" as const },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" as const },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", dir: "ltr" as const },
  { code: "es", label: "Spanish", nativeLabel: "Español", dir: "ltr" as const },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", dir: "ltr" as const },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(v: unknown): v is LanguageCode {
  return typeof v === "string" && SUPPORTED_LANGUAGES.some((l) => l.code === v);
}

export function getDirection(code: LanguageCode): "ltr" | "rtl" {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
}

type StatusDict = Record<RepairStatus, string>;

export const STATUS_LABEL_I18N: Record<LanguageCode, StatusDict> = {
  en: {
    received: "Received",
    diagnosing: "Diagnosing",
    awaiting_parts: "Awaiting parts",
    repairing: "Repairing",
    ready: "Ready for pickup",
    delivered: "Delivered",
    cancelled: "Cancelled",
  },
  ar: {
    received: "تم الاستلام",
    diagnosing: "قيد التشخيص",
    awaiting_parts: "بانتظار قطع الغيار",
    repairing: "قيد الإصلاح",
    ready: "جاهز للاستلام",
    delivered: "تم التسليم",
    cancelled: "ملغى",
  },
  hi: {
    received: "प्राप्त हुआ",
    diagnosing: "जाँच जारी",
    awaiting_parts: "पुर्जों की प्रतीक्षा",
    repairing: "मरम्मत जारी",
    ready: "लेने के लिए तैयार",
    delivered: "सौंप दिया गया",
    cancelled: "रद्द",
  },
  es: {
    received: "Recibido",
    diagnosing: "Diagnosticando",
    awaiting_parts: "Esperando piezas",
    repairing: "Reparando",
    ready: "Listo para recoger",
    delivered: "Entregado",
    cancelled: "Cancelado",
  },
  te: {
    received: "స్వీకరించబడింది",
    diagnosing: "నిర్ధారణలో",
    awaiting_parts: "విడిభాగాల కోసం వేచి ఉంది",
    repairing: "మరమ్మతులో",
    ready: "తీసుకోవడానికి సిద్ధం",
    delivered: "అందించబడింది",
    cancelled: "రద్దు చేయబడింది",
  },
};

type UIKey =
  | "brand"
  | "trackTitle"
  | "trackSubtitle"
  | "ticketCode"
  | "checkStatus"
  | "lookupAnother"
  | "notFoundTitle"
  | "notFoundHint"
  | "loading"
  | "estimatedReady"
  | "lastUpdated"
  | "updatesTitle"
  | "noUpdates"
  | "cancelledMsg"
  | "awaitingPartsBadge"
  | "language"
  | "adminLogin";

export const UI: Record<LanguageCode, Record<UIKey, string>> = {
  en: {
    brand: "FixCell",
    trackTitle: "Track your repair",
    trackSubtitle: "Enter the ticket code we gave you when you dropped off your device.",
    ticketCode: "Ticket code",
    checkStatus: "Check status",
    lookupAnother: "Look up another ticket",
    notFoundTitle: "Ticket not found",
    notFoundHint: "Double-check the code and try again.",
    loading: "Loading…",
    estimatedReady: "Estimated ready by",
    lastUpdated: "Last updated",
    updatesTitle: "Updates from the shop",
    noUpdates: "No updates yet. We'll post here as your repair progresses.",
    cancelledMsg: "This repair was cancelled. Please contact the shop for details.",
    awaitingPartsBadge: "Awaiting parts",
    language: "Language",
    adminLogin: "Admin Login",
  },
  ar: {
    brand: "FixCell",
    trackTitle: "تتبع الإصلاح",
    trackSubtitle: "أدخل رمز التذكرة الذي تلقيته عند تسليم جهازك.",
    ticketCode: "رمز التذكرة",
    checkStatus: "عرض الحالة",
    lookupAnother: "البحث عن تذكرة أخرى",
    notFoundTitle: "التذكرة غير موجودة",
    notFoundHint: "تحقق من الرمز وحاول مرة أخرى.",
    loading: "جارٍ التحميل…",
    estimatedReady: "الجاهزية المتوقعة بحلول",
    lastUpdated: "آخر تحديث",
    updatesTitle: "تحديثات من المتجر",
    noUpdates: "لا توجد تحديثات بعد. سننشر هنا مع تقدم الإصلاح.",
    cancelledMsg: "تم إلغاء هذا الإصلاح. يرجى التواصل مع المتجر.",
    awaitingPartsBadge: "بانتظار قطع الغيار",
    language: "اللغة",
    adminLogin: "تسجيل دخول المسؤول",
  },
  hi: {
    brand: "FixCell",
    trackTitle: "अपनी मरम्मत ट्रैक करें",
    trackSubtitle: "जब आपने डिवाइस दिया था तब मिला टिकट कोड डालें।",
    ticketCode: "टिकट कोड",
    checkStatus: "स्थिति देखें",
    lookupAnother: "दूसरा टिकट खोजें",
    notFoundTitle: "टिकट नहीं मिला",
    notFoundHint: "कोड जाँचकर पुनः प्रयास करें।",
    loading: "लोड हो रहा है…",
    estimatedReady: "अनुमानित तैयार तिथि",
    lastUpdated: "अंतिम अद्यतन",
    updatesTitle: "दुकान से अपडेट",
    noUpdates: "अभी कोई अपडेट नहीं। जैसे-जैसे मरम्मत होगी, अपडेट यहाँ दिखेंगे।",
    cancelledMsg: "यह मरम्मत रद्द कर दी गई है। कृपया दुकान से संपर्क करें।",
    awaitingPartsBadge: "पुर्जों की प्रतीक्षा",
    language: "भाषा",
    adminLogin: "व्यवस्थापक लॉगिन",
  },
  es: {
    brand: "FixCell",
    trackTitle: "Sigue tu reparación",
    trackSubtitle: "Ingresa el código del ticket que te dimos al entregar tu dispositivo.",
    ticketCode: "Código del ticket",
    checkStatus: "Ver estado",
    lookupAnother: "Buscar otro ticket",
    notFoundTitle: "Ticket no encontrado",
    notFoundHint: "Verifica el código e inténtalo de nuevo.",
    loading: "Cargando…",
    estimatedReady: "Listo estimado para",
    lastUpdated: "Última actualización",
    updatesTitle: "Actualizaciones de la tienda",
    noUpdates: "Aún no hay actualizaciones. Publicaremos aquí a medida que avance la reparación.",
    cancelledMsg: "Esta reparación fue cancelada. Contacta con la tienda para más detalles.",
    awaitingPartsBadge: "Esperando piezas",
    language: "Idioma",
    adminLogin: "Acceso de administrador",
  },
  te: {
    brand: "FixCell",
    trackTitle: "మీ మరమ్మతును ట్రాక్ చేయండి",
    trackSubtitle: "మీరు పరికరాన్ని అప్పగించినప్పుడు ఇచ్చిన టికెట్ కోడ్‌ను నమోదు చేయండి.",
    ticketCode: "టికెట్ కోడ్",
    checkStatus: "స్థితి చూడండి",
    lookupAnother: "మరో టికెట్ చూడండి",
    notFoundTitle: "టికెట్ కనుగొనబడలేదు",
    notFoundHint: "కోడ్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
    loading: "లోడ్ అవుతోంది…",
    estimatedReady: "సిద్ధమయ్యే అంచనా తేదీ",
    lastUpdated: "చివరిగా నవీకరించబడింది",
    updatesTitle: "షాప్ నుండి నవీకరణలు",
    noUpdates: "ఇంకా నవీకరణలు లేవు. మరమ్మతు పురోగతిలో ఇక్కడ పోస్ట్ చేస్తాము.",
    cancelledMsg: "ఈ మరమ్మతు రద్దు చేయబడింది. వివరాల కోసం షాప్‌ను సంప్రదించండి.",
    awaitingPartsBadge: "విడిభాగాల కోసం వేచి ఉంది",
    language: "భాష",
    adminLogin: "అడ్మిన్ లాగిన్",
  },
};
