import {
  LayoutDashboard, Users, PenLine, KeyRound, Mail, Lock, CalendarX2, Banknote, CreditCard, TriangleAlert,
  Wallet, FileText, MessagesSquare, LogOut, Building2, Settings, Menu, GraduationCap, BookOpen, X, Search,
  Download, MapPin, Blocks, RefreshCw, Megaphone, History, Bell, Wrench, CalendarDays, Check, Layers,
  TrendingDown, Receipt, CircleAlert, ClipboardList, ShieldCheck, UserCog, ChevronRight, ChevronDown,
  ChevronLeft, Plus, ExternalLink, Link2, Library, Video, Globe, Trash2, Pencil, Ellipsis, Info, Send,
  Calendar, Newspaper, LifeBuoy, Briefcase, Award, Bus, Utensils, HandCoins, ArrowLeft, Server, Database,
  Activity, CornerDownLeft, CircleCheck, Clock, LogIn, Eye, EyeOff, Upload, UserPlus, Copy, School,
  CalendarCheck, ShieldAlert, Flag, Printer,
} from 'lucide-react';

// Jeu d'icônes Lucide (trait régulier, dessin sobre) à la place des icônes
// dessinées à la main d'avant : une seule famille cohérente dans toute
// l'application. Les noms Icon* historiques sont conservés pour ne rien
// changer aux imports des pages.
function avecTrait(Icone) {
  function IconeEduSphere(props) {
    return <Icone strokeWidth={1.75} aria-hidden="true" {...props} />;
  }
  IconeEduSphere.displayName = Icone.displayName;
  return IconeEduSphere;
}

export const IconDashboard = avecTrait(LayoutDashboard);
export const IconUsers = avecTrait(Users);
export const IconPencil = avecTrait(PenLine);
export const IconKey = avecTrait(KeyRound);
export const IconMail = avecTrait(Mail);
export const IconLock = avecTrait(Lock);
export const IconCalendarAlert = avecTrait(CalendarX2);
export const IconBanknote = avecTrait(Banknote);
export const IconCard = avecTrait(CreditCard);
export const IconAlertTriangle = avecTrait(TriangleAlert);
export const IconWallet = avecTrait(Wallet);
export const IconDocument = avecTrait(FileText);
export const IconMessage = avecTrait(MessagesSquare);
export const IconLogout = avecTrait(LogOut);
export const IconBuilding = avecTrait(Building2);
export const IconSettings = avecTrait(Settings);
export const IconMenu = avecTrait(Menu);
export const IconGraduationCap = avecTrait(GraduationCap);
export const IconBook = avecTrait(BookOpen);
export const IconClose = avecTrait(X);
export const IconSearch = avecTrait(Search);
export const IconDownload = avecTrait(Download);
export const IconMapPin = avecTrait(MapPin);
export const IconToggle = avecTrait(Blocks);
export const IconRocket = avecTrait(RefreshCw);
export const IconMegaphone = avecTrait(Megaphone);
export const IconHistory = avecTrait(History);
export const IconSparkles = avecTrait(Bell);
export const IconWrench = avecTrait(Wrench);
export const IconCalendar = avecTrait(CalendarDays);
export const IconCheck = avecTrait(Check);

export const IconLayers = avecTrait(Layers);
export const IconTrendingDown = avecTrait(TrendingDown);
export const IconReceipt = avecTrait(Receipt);
export const IconCircleAlert = avecTrait(CircleAlert);
export const IconClipboard = avecTrait(ClipboardList);
export const IconShield = avecTrait(ShieldCheck);
export const IconUserCog = avecTrait(UserCog);
export const IconChevronRight = avecTrait(ChevronRight);
export const IconChevronDown = avecTrait(ChevronDown);
export const IconChevronLeft = avecTrait(ChevronLeft);
export const IconPlus = avecTrait(Plus);
export const IconExternal = avecTrait(ExternalLink);
export const IconTrash = avecTrait(Trash2);
export const IconEdit = avecTrait(Pencil);
export const IconMore = avecTrait(Ellipsis);
export const IconInfo = avecTrait(Info);
export const IconSend = avecTrait(Send);
export const IconArrowLeft = avecTrait(ArrowLeft);
export const IconServer = avecTrait(Server);
export const IconDatabase = avecTrait(Database);
export const IconActivity = avecTrait(Activity);
export const IconEnter = avecTrait(CornerDownLeft);
export const IconCircleCheck = avecTrait(CircleCheck);
export const IconClock = avecTrait(Clock);
export const IconBell = avecTrait(Bell);
export const IconLogin = avecTrait(LogIn);
export const IconOeil = avecTrait(Eye);
export const IconEye = IconOeil;
export const IconOeilBarre = avecTrait(EyeOff);
export const IconUpload = avecTrait(Upload);
export const IconUserPlus = avecTrait(UserPlus);
export const IconCopy = avecTrait(Copy);
export const IconSchool = avecTrait(School);
export const IconCalendarCheck = avecTrait(CalendarCheck);
export const IconShieldAlert = avecTrait(ShieldAlert);
export const IconFlag = avecTrait(Flag);
export const IconPrinter = avecTrait(Printer);

// Icônes proposées pour une fonctionnalité personnalisée (même liste que
// ICONES_PERSONNALISABLES côté backend), plus celles des modules intégrés.
export const ICONES_FONCTIONNALITES = {
  FileText: avecTrait(FileText),
  BookOpen: avecTrait(BookOpen),
  Library: avecTrait(Library),
  GraduationCap: avecTrait(GraduationCap),
  Calendar: avecTrait(Calendar),
  ClipboardList: avecTrait(ClipboardList),
  Newspaper: avecTrait(Newspaper),
  Megaphone: avecTrait(Megaphone),
  Video: avecTrait(Video),
  Globe: avecTrait(Globe),
  Link2: avecTrait(Link2),
  LifeBuoy: avecTrait(LifeBuoy),
  Briefcase: avecTrait(Briefcase),
  Award: avecTrait(Award),
  Bus: avecTrait(Bus),
  Utensils: avecTrait(Utensils),
  HandCoins: avecTrait(HandCoins),
  Info: avecTrait(Info),
  TrendingDown: avecTrait(TrendingDown),
  KeyRound: avecTrait(KeyRound),
  CalendarDays: avecTrait(CalendarDays),
  MessagesSquare: avecTrait(MessagesSquare),
  Wallet: avecTrait(Wallet),
  Receipt: avecTrait(Receipt),
};

export function IconeFonctionnalite({ nom, ...props }) {
  const Icone = ICONES_FONCTIONNALITES[nom] || ICONES_FONCTIONNALITES.FileText;
  return <Icone {...props} />;
}
