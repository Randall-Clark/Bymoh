import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StepProgress from "@/components/StepProgress";
import PaymentModal from "@/components/PaymentModal";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { useInitiateRegistrationPayment } from "@workspace/api-client-react";

// ─── Data ──────────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬" },
  { code: "BJ", name: "Bénin", dialCode: "+229", flag: "🇧🇯" },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", dialCode: "+221", flag: "🇸🇳" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "CM", name: "Cameroun", dialCode: "+237", flag: "🇨🇲" },
  { code: "ML", name: "Mali", dialCode: "+223", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫" },
];

const BUSINESS_TYPES = [
  "Boutique / Magasin",
  "Épicerie / Alimentation",
  "Supermarché / Mini-marché",
  "Restaurant",
  "Café / Snack / Fast-food",
  "Boulangerie / Pâtisserie",
  "Salon de beauté / Coiffure",
  "Spa / Institut de beauté",
  "Pharmacie / Parapharmacie",
  "Clinique / Cabinet médical",
  "Laboratoire d'analyse",
  "Garage / Atelier auto",
  "Station service",
  "Atelier artisan",
  "Menuiserie / Ébénisterie",
  "Imprimerie / Reprographie",
  "Agence immobilière",
  "Bureau d'étude / Cabinet conseil",
  "Agence de voyage",
  "École / Centre de formation",
  "Crèche / Garderie",
  "Librairie / Papeterie",
  "Informatique / Téléphonie",
  "Électronique / Électroménager",
  "Hôtel / Auberge",
  "Location de véhicules",
  "Transport / Logistique",
  "Couture / Tailleur",
  "Nettoyage / Blanchisserie",
  "Plomberie / Électricité",
  "Entreprise individuelle",
  "SARL / SA",
  "ONG / Association",
  "Autre",
];

const SECTORS = [
  "Alimentation & Épicerie",
  "Restauration & Traiteur",
  "Beauté & Soins personnels",
  "Santé & Bien-être",
  "Mode & Habillement",
  "Électronique & Téléphonie",
  "Informatique & High-Tech",
  "Automobile & Moto",
  "Immobilier",
  "Construction & BTP",
  "Artisanat & Art",
  "Éducation & Formation",
  "Finance & Assurance",
  "Transport & Logistique",
  "Tourisme & Hôtellerie",
  "Agriculture & Élevage",
  "Pêche & Aquaculture",
  "Énergie & Environnement",
  "Médias & Communication",
  "Marketing & Publicité",
  "Événementiel & Animation",
  "Sport & Loisirs",
  "Librairie & Papeterie",
  "Pharmacie & Parapharmacie",
  "Optique",
  "Bijouterie & Joaillerie",
  "Quincaillerie & Matériaux",
  "Imprimerie & Reprographie",
  "Nettoyage & Entretien",
  "Sécurité & Surveillance",
  "Juridique & Conseil",
  "Comptabilité & Audit",
  "Ressources humaines",
  "Service à la personne",
  "Couture & Textile",
  "Ameublement & Déco",
  "Jardinage & Espaces verts",
  "Plomberie & Sanitaire",
  "Électricité & Climatisation",
  "Menuiserie & Ébénisterie",
  "Autre",
];

const CITIES = [
  // Togo
  "Lomé", "Sokodé", "Kara", "Kpalimé", "Atakpamé", "Bassar", "Tsévié",
  "Aného", "Mango", "Dapaong", "Notsé", "Vogan", "Tabligbo", "Badou",
  "Bafilo", "Kandé", "Niamtougou", "Sotouboua", "Tchamba",
  // Bénin
  "Cotonou", "Porto-Novo", "Abomey", "Parakou", "Natitingou", "Ouidah",
  // Côte d'Ivoire
  "Abidjan", "Bouaké", "Daloa", "Korhogo", "San-Pédro", "Yamoussoukro",
  // Sénégal
  "Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Kaolack",
  // Ghana
  "Accra", "Kumasi", "Tamale", "Cape Coast",
  // Cameroun
  "Douala", "Yaoundé", "Bafoussam", "Garoua",
  // Mali
  "Bamako", "Sikasso", "Mopti", "Gao",
  // Burkina Faso
  "Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Banfora",
];

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const DAY_MAP: Record<string, string> = {
  Lun: "Mon", Mar: "Tue", Mer: "Wed", Jeu: "Thu", Ven: "Fri", Sam: "Sat", Dim: "Sun",
};

// ─── Business model logic ──────────────────────────────────────────────────────

type BusinessModel = "article" | "prestation" | "both";
type ItemKind = "article" | "prestation";

const ARTICLE_TYPE_LIST: string[] = [
  "Boutique / Magasin", "Épicerie / Alimentation", "Supermarché / Mini-marché",
  "Boulangerie / Pâtisserie", "Pharmacie / Parapharmacie", "Librairie / Papeterie",
  "Informatique / Téléphonie", "Électronique / Électroménager", "Station service",
];

const PRESTATION_TYPE_LIST: string[] = [
  "Salon de beauté / Coiffure", "Spa / Institut de beauté", "Clinique / Cabinet médical",
  "Laboratoire d'analyse", "Garage / Atelier auto", "Atelier artisan",
  "Menuiserie / Ébénisterie", "Imprimerie / Reprographie", "Agence immobilière",
  "Bureau d'étude / Cabinet conseil", "Agence de voyage", "École / Centre de formation",
  "Crèche / Garderie", "Hôtel / Auberge", "Location de véhicules",
  "Transport / Logistique", "Couture / Tailleur", "Nettoyage / Blanchisserie",
  "Plomberie / Électricité", "ONG / Association",
];

function getBusinessModel(type: string): BusinessModel {
  if (ARTICLE_TYPE_LIST.includes(type)) return "article";
  if (PRESTATION_TYPE_LIST.includes(type)) return "prestation";
  return "both";
}
const STEPS = ["Informations", "Business", "Horaires", "Catalogue", "Paiement"];
const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map((d) => [d, { open: "08:00", close: "18:00", closed: false }])
);

// ─── Picker Modal ──────────────────────────────────────────────────────────────

function PickerModal({
  visible,
  title,
  items,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => items.filter((i) => i.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[pmStyles.overlay]}>
        <View style={[pmStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={[pmStyles.handle, { backgroundColor: colors.border }]} />
          <Text style={[pmStyles.title, { color: colors.text }]}>{title}</Text>
          {/* Search */}
          <View style={[pmStyles.searchRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[pmStyles.searchInput, { color: colors.text }]}
              placeholder="Rechercher..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => {
              const isSelected = item === selected;
              return (
                <TouchableOpacity
                  style={[pmStyles.item, { borderBottomColor: colors.border }]}
                  onPress={() => { onSelect(item); onClose(); setSearch(""); }}
                >
                  <Text style={[pmStyles.itemText, { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? "700" : "400" }]}>
                    {item}
                  </Text>
                  {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={[pmStyles.closeBtn, { backgroundColor: colors.muted }]} onPress={() => { onClose(); setSearch(""); }}>
            <Text style={[pmStyles.closeBtnText, { color: colors.text }]}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Country Picker Modal ──────────────────────────────────────────────────────

function CountryPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (c: typeof COUNTRIES[0]) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={pmStyles.overlay}>
        <View style={[pmStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[pmStyles.handle, { backgroundColor: colors.border }]} />
          <Text style={[pmStyles.title, { color: colors.text }]}>Indicatif pays</Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(c) => c.code}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => {
              const isSel = item.code === selected;
              return (
                <TouchableOpacity
                  style={[pmStyles.item, { borderBottomColor: colors.border }]}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[pmStyles.itemText, { color: isSel ? colors.primary : colors.text, fontWeight: isSel ? "700" : "400" }]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>{item.dialCode}</Text>
                  {isSel && <Feather name="check" size={16} color={colors.primary} style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={[pmStyles.closeBtn, { backgroundColor: colors.muted }]} onPress={onClose}>
            <Text style={[pmStyles.closeBtnText, { color: colors.text }]}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 0.5 },
  itemText: { flex: 1, fontSize: 15 },
  closeBtn: { paddingVertical: 14, borderRadius: 100, alignItems: "center", marginTop: 8 },
  closeBtnText: { fontSize: 15, fontWeight: "600" },
});

// ─── SelectField helper ────────────────────────────────────────────────────────

function SelectField({ label, value, placeholder, onPress, colors }: any) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectBtn, { backgroundColor: colors.card, borderColor: value ? colors.primary : colors.border }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.selectBtnText, { color: value ? colors.text : colors.mutedForeground }]}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ProRegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBusiness } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const { mutateAsync: initiateRegistrationPayment } = useInitiateRegistrationPayment();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Step 0 – Personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Step 1 – Business
  const [bizName, setBizName] = useState("");
  const [bizCountry, setBizCountry] = useState(COUNTRIES[0]);
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizDescription, setBizDescription] = useState("");
  const [bizLogo, setBizLogo] = useState<string | null>(null);
  const [bizBanner, setBizBanner] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // Step 2 – Hours
  const [hours, setHours] = useState(DEFAULT_HOURS);

  // Step 3 – Catalog
  type CatalogItem = {
    id: string; kind: ItemKind; title: string; desc: string; price: string; photo: string | null;
    duration?: string; billingType?: "fixed" | "hourly"; allowsBooking?: boolean;
  };
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [formKind, setFormKind] = useState<ItemKind>("article");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formDuration, setFormDuration] = useState("30");
  const [formBilling, setFormBilling] = useState<"fixed" | "hourly">("fixed");
  const [formAllowsBooking, setFormAllowsBooking] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showKindSelector, setShowKindSelector] = useState(false);

  const pickImageFor = async (setter: (uri: string) => void, aspect: [number, number] = [4, 3]) => {
    if ((Platform.OS as string) !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission requise", "Autorisez l'accès à la galerie.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect,
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const addService = () => {
    if (!formTitle.trim() || !formPrice.trim()) return;
    const item = {
      id: Date.now().toString(),
      kind: formKind,
      title: formTitle.trim(),
      desc: formDesc.trim(),
      price: formPrice.trim(),
      photo: formPhoto,
      duration: formKind === "prestation" ? formDuration : undefined,
      billingType: formKind === "prestation" ? formBilling : undefined,
      allowsBooking: formKind === "prestation" ? formAllowsBooking : undefined,
    };
    setServices((prev) => [...prev, item]);
    setFormTitle(""); setFormDesc(""); setFormPrice(""); setFormPhoto(null);
    setFormDuration("30"); setFormBilling("fixed"); setFormAllowsBooking(true);
    setFormKind("article"); setShowAddForm(false); setShowKindSelector(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    Haptics.selectionAsync();
  };

  // Modals
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showSectorPicker, setShowSectorPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  const canProceed = () => {
    if (step === 0) return firstName.trim() && lastName.trim();
    if (step === 1) return bizName.trim() && bizPhone.trim() && sector && businessType && city;
    if (step === 2) return true;
    if (step === 3) return services.length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    Haptics.selectionAsync();
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const bookingMode = ARTICLE_TYPE_LIST.includes(businessType)
        ? "none"
        : businessType.includes("Restaurant") || businessType.includes("Café") || businessType.includes("Hôtel")
          ? "table"
          : "service";

      const biz = await api.post<{ id: string }>("/businesses", {
        name: bizName.trim(),
        category: businessType,
        sector,
        phone: `${bizCountry.dialCode}${bizPhone}`.trim(),
        email: bizEmail.trim() || undefined,
        description: bizDescription.trim(),
        address: address.trim(),
        city,
        hasDelivery: false,
        bookingMode,
        categoryIcon: "briefcase",
      });

      await api.patch(`/businesses/${biz.id}`, { forfaitPaid: true });

      const hoursPayload = Object.entries(hours).map(([day, h]) => ({
        day: DAY_MAP[day] ?? day,
        openTime: h.open,
        closeTime: h.close,
        isClosed: h.closed,
      }));
      await api.put(`/businesses/${biz.id}/hours`, hoursPayload);

      for (const svc of services) {
        await api.post(`/businesses/${biz.id}/catalog`, {
          kind: svc.kind,
          title: svc.title,
          description: svc.desc,
          price: parseFloat(svc.price) || 0,
          currency: "FCFA",
          photo: svc.photo,
          ...(svc.kind === "prestation"
            ? {
                duration: parseInt(svc.duration ?? "30", 10),
                billingType: svc.billingType ?? "fixed",
                allowsBooking: svc.allowsBooking ?? true,
              }
            : {}),
        });
      }

      addBusiness(biz.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Business inscrit !",
        "Votre business est maintenant en ligne. Les clients peuvent vous trouver sur Kola.",
        [{ text: "Voir mon tableau de bord", onPress: () => router.replace("/pro/dashboard") }]
      );
    } catch (err) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible de créer le business. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, value, onChangeText, placeholder, keyboardType = "default" }: any) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={step > 0 ? () => setStep(step - 1) : () => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Inscrire mon business</Text>
          <StepProgress current={step} total={5} />
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.stepLabel, { color: colors.primary }]}>ÉTAPE {step + 1}/5</Text>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{STEPS[step]}</Text>

        {/* ── Step 0: Informations personnelles ── */}
        {step === 0 && (
          <View style={styles.fields}>
            <InputField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Jean" />
            <InputField label="Nom de famille" value={lastName} onChangeText={setLastName} placeholder="Dupont" />
          </View>
        )}

        {/* ── Step 1: Business ── */}
        {step === 1 && (
          <View style={styles.fields}>
            <InputField
              label="Nom de l'entreprise"
              value={bizName}
              onChangeText={setBizName}
              placeholder="Mon Business"
            />

            {/* Phone with country code */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Téléphone du business</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={[styles.dialCodeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={styles.flagText}>{bizCountry.flag}</Text>
                  <Text style={[styles.dialCodeText, { color: colors.text }]}>{bizCountry.dialCode}</Text>
                  <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.phoneInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={bizPhone}
                  onChangeText={setBizPhone}
                  placeholder="90 00 00 00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <InputField
              label="Email (optionnel)"
              value={bizEmail}
              onChangeText={setBizEmail}
              placeholder="contact@monbusiness.com"
              keyboardType="email-address"
            />

            <SelectField
              label="Type d'entreprise"
              value={businessType}
              placeholder="Choisir le type..."
              onPress={() => setShowTypePicker(true)}
              colors={colors}
            />

            <SelectField
              label="Secteur d'activité"
              value={sector}
              placeholder="Choisir le secteur..."
              onPress={() => setShowSectorPicker(true)}
              colors={colors}
            />

            <SelectField
              label="Ville"
              value={city}
              placeholder="Choisir la ville..."
              onPress={() => setShowCityPicker(true)}
              colors={colors}
            />

            <InputField
              label="Adresse"
              value={address}
              onChangeText={setAddress}
              placeholder="Rue des Artisans, Quartier X"
            />

            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description du business</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={bizDescription}
                onChangeText={setBizDescription}
                placeholder="Décrivez votre business, vos spécialités, votre histoire..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Logo */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Logo du business</Text>
              <TouchableOpacity
                style={[styles.logoPicker, { backgroundColor: colors.muted, borderColor: bizLogo ? colors.primary : colors.border }]}
                onPress={() => pickImageFor((uri) => setBizLogo(uri), [1, 1])}
                activeOpacity={0.85}
              >
                {bizLogo ? (
                  <Image source={{ uri: bizLogo }} style={styles.logoPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.logoPickerInner}>
                    <Feather name="image" size={24} color={colors.primary} />
                    <Text style={[styles.logoPickerText, { color: colors.mutedForeground }]}>Ajouter le logo</Text>
                    <Text style={[styles.logoPickerHint, { color: colors.mutedForeground }]}>Format carré recommandé</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Banner */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Photo de couverture (bannière)</Text>
              <TouchableOpacity
                style={[styles.bannerPicker, { backgroundColor: colors.muted, borderColor: bizBanner ? colors.primary : colors.border }]}
                onPress={() => pickImageFor((uri) => setBizBanner(uri), [16, 9])}
                activeOpacity={0.85}
              >
                {bizBanner ? (
                  <Image source={{ uri: bizBanner }} style={styles.bannerPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.logoPickerInner}>
                    <Feather name="image" size={24} color={colors.primary} />
                    <Text style={[styles.logoPickerText, { color: colors.mutedForeground }]}>Ajouter une bannière</Text>
                    <Text style={[styles.logoPickerHint, { color: colors.mutedForeground }]}>Format 16:9 recommandé</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 2: Horaires ── */}
        {step === 2 && (
          <View style={styles.fields}>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Définissez vos horaires d'ouverture pour chaque jour de la semaine.
            </Text>
            {DAYS.map((day) => (
              <View key={day} style={[styles.hourRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.dayLabel, { color: colors.text, width: 36 }]}>{day}</Text>
                <TouchableOpacity
                  style={[styles.closedToggle, { backgroundColor: hours[day].closed ? colors.destructiveLight : colors.successLight }]}
                  onPress={() => setHours({ ...hours, [day]: { ...hours[day], closed: !hours[day].closed } })}
                >
                  <Text style={[styles.closedText, { color: hours[day].closed ? colors.destructive : colors.success }]}>
                    {hours[day].closed ? "Fermé" : "Ouvert"}
                  </Text>
                </TouchableOpacity>
                {!hours[day].closed && (
                  <View style={styles.hoursInputs}>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
                      value={hours[day].open}
                      onChangeText={(t) => setHours({ ...hours, [day]: { ...hours[day], open: t } })}
                      placeholder="08:00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <Text style={[styles.timeSep, { color: colors.mutedForeground }]}>–</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
                      value={hours[day].close}
                      onChangeText={(t) => setHours({ ...hours, [day]: { ...hours[day], close: t } })}
                      placeholder="18:00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Step 3: Catalogue ── */}
        {step === 3 && (() => {
          const effectiveKind: ItemKind = formKind;
          return (
          <View style={styles.fields}>
            {/* Model hint */}
            <View style={[styles.modelHint, { backgroundColor: colors.muted }]}>
              <Feather name="layers" size={15} color={colors.primary} />
              <Text style={[styles.modelHintText, { color: colors.primary }]}>
                Ajoutez des articles (produits à vendre) et/ou des prestations (services sur RDV).
              </Text>
            </View>

            {/* Items list */}
            {services.map((s) => (
              <View key={s.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {s.photo ? (
                  <Image source={{ uri: s.photo }} style={styles.serviceCardImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.serviceCardImgPlaceholder, { backgroundColor: s.kind === "prestation" ? "#EDE9FE" : colors.muted }]}>
                    <Feather name={s.kind === "prestation" ? "calendar" : "package"} size={20} color={s.kind === "prestation" ? "#7C3AED" : colors.mutedForeground} />
                  </View>
                )}
                <View style={styles.serviceCardBody}>
                  <View style={[styles.serviceKindBadge, { backgroundColor: s.kind === "prestation" ? "#EDE9FE" : colors.accent }]}>
                    <Text style={[styles.serviceKindBadgeText, { color: s.kind === "prestation" ? "#7C3AED" : colors.primary }]}>
                      {s.kind === "prestation" ? "Prestation" : "Article"}
                    </Text>
                  </View>
                  <Text style={[styles.serviceCardTitle, { color: colors.text }]} numberOfLines={1}>{s.title}</Text>
                  {s.desc ? <Text style={[styles.serviceCardDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{s.desc}</Text> : null}
                  <Text style={[styles.serviceCardPrice, { color: colors.primary }]}>
                    {s.price} FCFA{s.billingType === "hourly" ? "/h" : ""}
                    {s.duration ? ` · ${s.duration} min` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeService(s.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Kind selector — always available */}
            {!showAddForm && showKindSelector && (
              <View style={[styles.kindSelectorCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                <Text style={[styles.addFormTitle, { color: colors.text }]}>Que voulez-vous ajouter ?</Text>
                <TouchableOpacity
                  style={[styles.kindOption, { backgroundColor: colors.accent, borderColor: colors.primary }]}
                  onPress={() => { setFormKind("article"); setShowKindSelector(false); setShowAddForm(true); }}
                >
                  <Feather name="package" size={18} color={colors.primary} />
                  <View>
                    <Text style={[styles.kindOptionLabel, { color: colors.text }]}>Article</Text>
                    <Text style={[styles.kindOptionDesc, { color: colors.mutedForeground }]}>Produit avec prix de vente</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.kindOption, { backgroundColor: "#F5F3FF", borderColor: "#7C3AED" }]}
                  onPress={() => { setFormKind("prestation"); setShowKindSelector(false); setShowAddForm(true); }}
                >
                  <Feather name="calendar" size={18} color="#7C3AED" />
                  <View>
                    <Text style={[styles.kindOptionLabel, { color: colors.text }]}>Prestation</Text>
                    <Text style={[styles.kindOptionDesc, { color: colors.mutedForeground }]}>Service avec durée et RDV</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formCancelBtn, { borderColor: colors.border }]} onPress={() => setShowKindSelector(false)}>
                  <Text style={[styles.formCancelText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Add form */}
            {showAddForm ? (
              <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                <Text style={[styles.addFormTitle, { color: colors.text }]}>
                  {effectiveKind === "prestation" ? "Nouvelle prestation" : "Nouvel article"}
                </Text>

                {/* Photo picker */}
                <TouchableOpacity style={[styles.photoPicker, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => pickImageFor((uri) => setFormPhoto(uri), [4, 3])}>
                  {formPhoto ? (
                    <Image source={{ uri: formPhoto }} style={styles.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoPickerInner}>
                      <Feather name="camera" size={24} color={colors.primary} />
                      <Text style={[styles.photoPickerText, { color: colors.mutedForeground }]}>Ajouter une photo</Text>
                    </View>
                  )}
                  {formPhoto && (
                    <View style={[styles.photoOverlay]}>
                      <Feather name="camera" size={16} color="#fff" />
                      <Text style={styles.photoOverlayText}>Changer</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Title */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Titre *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formTitle}
                    onChangeText={setFormTitle}
                    placeholder="Ex : Coupe homme, Pizza Margarita..."
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                {/* Description */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Description</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formDesc}
                    onChangeText={setFormDesc}
                    placeholder="Décrivez votre service ou produit..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Price */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Prix (FCFA) *{effectiveKind === "prestation" && formBilling === "hourly" ? " — à l'heure" : ""}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    placeholder="Ex : 5000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Prestation-specific fields */}
                {effectiveKind === "prestation" && (
                  <>
                    {/* Duration */}
                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>Durée de la prestation</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                        {[
                          { label: "15 min", v: "15" }, { label: "30 min", v: "30" }, { label: "45 min", v: "45" },
                          { label: "1 h", v: "60" }, { label: "1h30", v: "90" }, { label: "2 h", v: "120" },
                          { label: "3 h", v: "180" }, { label: "Journée", v: "480" },
                        ].map(({ label, v }) => (
                          <TouchableOpacity
                            key={v}
                            style={[styles.durationChip, {
                              backgroundColor: formDuration === v ? colors.primary : colors.muted,
                              borderColor: formDuration === v ? colors.primary : colors.border,
                            }]}
                            onPress={() => setFormDuration(v)}
                          >
                            <Text style={[styles.durationChipText, { color: formDuration === v ? "#fff" : colors.text }]}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    {/* Billing type */}
                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.text }]}>Mode de facturation</Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity
                          style={[styles.billingOption, { flex: 1, backgroundColor: formBilling === "fixed" ? colors.accent : colors.muted, borderColor: formBilling === "fixed" ? colors.primary : colors.border }]}
                          onPress={() => setFormBilling("fixed")}
                        >
                          <Feather name="tag" size={15} color={formBilling === "fixed" ? colors.primary : colors.mutedForeground} />
                          <Text style={[{ fontSize: 13, fontWeight: "700" }, { color: colors.text }]}>Forfait</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.billingOption, { flex: 1, backgroundColor: formBilling === "hourly" ? colors.accent : colors.muted, borderColor: formBilling === "hourly" ? colors.primary : colors.border }]}
                          onPress={() => setFormBilling("hourly")}
                        >
                          <Feather name="clock" size={15} color={formBilling === "hourly" ? colors.primary : colors.mutedForeground} />
                          <Text style={[{ fontSize: 13, fontWeight: "700" }, { color: colors.text }]}>À l'heure</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Booking toggle */}
                    <View style={[styles.bookingRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Feather name="calendar" size={16} color={formAllowsBooking ? colors.primary : colors.mutedForeground} />
                      <Text style={[{ flex: 1, fontSize: 13, fontWeight: "600" }, { color: colors.text }]}>Prise de rendez-vous en ligne</Text>
                      <Switch
                        value={formAllowsBooking}
                        onValueChange={setFormAllowsBooking}
                        trackColor={{ false: colors.border, true: "#86EFAC" }}
                        thumbColor={formAllowsBooking ? "#16A34A" : colors.mutedForeground}
                      />
                    </View>
                  </>
                )}

                {/* Form actions */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.formCancelBtn, { borderColor: colors.border }]}
                    onPress={() => { setShowAddForm(false); setShowKindSelector(false); setFormTitle(""); setFormDesc(""); setFormPrice(""); setFormPhoto(null); }}
                  >
                    <Text style={[styles.formCancelText, { color: colors.text }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formAddBtn, { backgroundColor: formTitle.trim() && formPrice.trim() ? colors.primary : colors.muted }]}
                    onPress={addService}
                    disabled={!formTitle.trim() || !formPrice.trim()}
                  >
                    <Feather name="check" size={16} color={formTitle.trim() && formPrice.trim() ? "#fff" : colors.mutedForeground} />
                    <Text style={[styles.formAddText, { color: formTitle.trim() && formPrice.trim() ? "#fff" : colors.mutedForeground }]}>
                      Ajouter
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : !showKindSelector ? (
              <TouchableOpacity
                style={[styles.addServiceBtn, { borderColor: colors.primary, backgroundColor: colors.accent }]}
                onPress={() => setShowKindSelector(true)}
              >
                <Feather name="plus-circle" size={20} color={colors.primary} />
                <Text style={[styles.addServiceBtnText, { color: colors.primary }]}>
                  {services.length === 0 ? "Ajouter un article ou une prestation" : "Ajouter un autre"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          );
        })()}

        {/* ── Step 4: Paiement ── */}
        {step === 4 && (
          <View style={styles.fields}>
            {/* Summary card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.mutedForeground }]}>Résumé de l'inscription</Text>
              <View style={styles.summaryRow}>
                <Feather name="briefcase" size={14} color={colors.primary} />
                <Text style={[styles.summaryText, { color: colors.text }]}>{bizName || "Votre business"}</Text>
              </View>
              {sector ? (
                <View style={styles.summaryRow}>
                  <Feather name="tag" size={14} color={colors.primary} />
                  <Text style={[styles.summaryText, { color: colors.text }]}>{sector}</Text>
                </View>
              ) : null}
              {city ? (
                <View style={styles.summaryRow}>
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[styles.summaryText, { color: colors.text }]}>{city}</Text>
                </View>
              ) : null}
            </View>

            {/* Pricing card */}
            <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={[styles.pricingBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.pricingBadgeText}>🎉 Offre de lancement</Text>
              </View>
              <Text style={[styles.pricingTitle, { color: colors.text }]}>Forfait Unique</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.pricingPrice, { color: colors.primary }]}>10 000</Text>
                <Text style={[styles.pricingCurrency, { color: colors.mutedForeground }]}>FCFA{"\n"}paiement unique</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {[
                "Profil business visible sur Kola",
                "Catalogue de produits / services illimité",
                "Réservations en ligne 24h/24",
                "Commandes & gestion des livraisons",
                "Tableau de bord analytics",
                "Support client prioritaire",
                "Aucun abonnement mensuel",
              ].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check-circle" size={15} color={colors.success} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.primary }]}
              onPress={() => setPaymentModal(true)}
              disabled={loading}
              activeOpacity={0.88}
            >
              <Feather name="credit-card" size={18} color="#fff" />
              <Text style={styles.payBtnText}>{loading ? "Traitement..." : "Payer 10 000 FCFA & Activer"}</Text>
            </TouchableOpacity>

            <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
              Paiement sécurisé via CinetPay · Moov Money · MTN MoMo · Carte bancaire
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Payment modal — step 4 */}
      <PaymentModal
        visible={paymentModal}
        onClose={() => setPaymentModal(false)}
        onInitiate={async ({ method, phone }) => {
          const result = await initiateRegistrationPayment({ data: { method, phone } });
          return result;
        }}
        onSuccess={() => {
          setPaymentModal(false);
          handleSubmit();
        }}
      />

      {/* Footer: next button */}
      {step < 4 && (
        <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad + 16, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canProceed() ? colors.primary : colors.muted }]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={[styles.nextBtnText, { color: canProceed() ? "#fff" : colors.mutedForeground }]}>
              Continuer
            </Text>
            <Feather name="arrow-right" size={18} color={canProceed() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <CountryPickerModal
        visible={showCountryPicker}
        selected={bizCountry.code}
        onSelect={(c) => setBizCountry(c)}
        onClose={() => setShowCountryPicker(false)}
      />
      <PickerModal
        visible={showSectorPicker}
        title="Secteur d'activité"
        items={SECTORS}
        selected={sector}
        onSelect={setSector}
        onClose={() => setShowSectorPicker(false)}
      />
      <PickerModal
        visible={showTypePicker}
        title="Type d'entreprise"
        items={BUSINESS_TYPES}
        selected={businessType}
        onSelect={setBusinessType}
        onClose={() => setShowTypePicker(false)}
      />
      <PickerModal
        visible={showCityPicker}
        title="Ville"
        items={CITIES}
        selected={city}
        onSelect={setCity}
        onClose={() => setShowCityPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, gap: 12,
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  stepLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  stepTitle: { fontSize: 24, fontWeight: "800", marginBottom: 16 },
  fields: { gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  textArea: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 100 },
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1,
  },
  selectBtnText: { fontSize: 15, flex: 1 },
  phoneRow: { flexDirection: "row", gap: 8 },
  dialCodeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  flagText: { fontSize: 18 },
  dialCodeText: { fontSize: 14, fontWeight: "700" },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  hintText: { fontSize: 14, lineHeight: 20 },
  // Media pickers
  logoPicker: {
    height: 120, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  logoPreview: { width: "100%", height: "100%" },
  logoPickerInner: { alignItems: "center", gap: 6 },
  logoPickerText: { fontSize: 14, fontWeight: "600" },
  logoPickerHint: { fontSize: 11 },
  bannerPicker: {
    height: 160, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  bannerPreview: { width: "100%", height: "100%" },
  // Catalog — model hint
  modelHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 12,
  },
  modelHintText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  // Catalog — item kind badge
  serviceKindBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 100 },
  serviceKindBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  // Catalog — kind selector card
  kindSelectorCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 12 },
  kindOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  kindOptionLabel: { fontSize: 14, fontWeight: "700" },
  kindOptionDesc: { fontSize: 12, marginTop: 1 },
  // Prestation fields
  durationChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5 },
  durationChipText: { fontSize: 13, fontWeight: "600" },
  billingOption: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1.5,
  },
  bookingRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  hourRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  dayLabel: { fontSize: 13, fontWeight: "700" },
  closedToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  closedText: { fontSize: 11, fontWeight: "700" },
  hoursInputs: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  timeInput: { width: 60, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, fontSize: 13, textAlign: "center" },
  timeSep: { fontSize: 13 },
  summaryCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  summaryTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryText: { fontSize: 14, fontWeight: "500" },
  pricingCard: { borderRadius: 20, padding: 20, borderWidth: 2, gap: 12, overflow: "hidden" },
  pricingBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  pricingBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pricingTitle: { fontSize: 22, fontWeight: "800" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  pricingPrice: { fontSize: 40, fontWeight: "900", lineHeight: 44 },
  pricingCurrency: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  divider: { height: 1, marginVertical: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14 },
  payBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 100,
  },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  legalText: { fontSize: 12, textAlign: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 100,
  },
  nextBtnText: { fontSize: 16, fontWeight: "700" },
  // Catalog
  serviceCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1,
    overflow: "hidden", gap: 12, padding: 10,
  },
  serviceCardImg: { width: 64, height: 64, borderRadius: 10 },
  serviceCardImgPlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  serviceCardBody: { flex: 1, gap: 2 },
  serviceCardTitle: { fontSize: 14, fontWeight: "700" },
  serviceCardDesc: { fontSize: 12, lineHeight: 16 },
  serviceCardPrice: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  addServiceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed",
  },
  addServiceBtnText: { fontSize: 15, fontWeight: "700" },
  addForm: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 14 },
  addFormTitle: { fontSize: 16, fontWeight: "800" },
  photoPicker: {
    height: 140, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  photoPickerInner: { alignItems: "center", gap: 8 },
  photoPickerText: { fontSize: 13 },
  photoPreview: { width: "100%", height: "100%" },
  photoOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6,
  },
  photoOverlayText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  formCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 100, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  formCancelText: { fontSize: 14, fontWeight: "600" },
  formAddBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: 100,
  },
  formAddText: { fontSize: 14, fontWeight: "700" },
});
