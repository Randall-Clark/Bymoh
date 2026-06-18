import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StepProgress from "@/components/StepProgress";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = ["Restaurant", "Artisan", "Beauté & Soins", "Santé", "Éducation", "Auto", "Tech & IT", "Nettoyage", "Autre"];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const STEPS = ["Informations", "Business", "Horaires", "Catalogue", "Paiement"];

const DEFAULT_HOURS = Object.fromEntries(DAYS.map((d) => [d, { open: "08:00", close: "18:00", closed: false }]));

export default function ProRegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBusiness } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Step 1 - Personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Step 2 - Business
  const [bizName, setBizName] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("Lomé");
  const [address, setAddress] = useState("");
  const [employees, setEmployees] = useState("1-5");
  // Step 3 - Hours
  const [hours, setHours] = useState(DEFAULT_HOURS);
  // Step 4 - Catalog
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  // Step 5 - Payment handled inline

  const canProceed = () => {
    if (step === 0) return firstName.trim() && lastName.trim();
    if (step === 1) return bizName.trim() && bizPhone.trim() && category;
    if (step === 2) return true;
    if (step === 3) return serviceTitle.trim() && servicePrice.trim();
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    Haptics.selectionAsync();
    if (step < 4) setStep(step + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    const newId = "b" + Date.now().toString().slice(-4);
    addBusiness(newId);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Business inscrit !",
      "Votre business est maintenant en ligne. Les clients peuvent vous trouver sur Lokali.",
      [{ text: "Voir mon tableau de bord", onPress: () => router.replace("/pro/dashboard") }]
    );
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
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={step > 0 ? () => setStep(step - 1) : () => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Inscrire mon business</Text>
          <StepProgress current={step} total={5} />
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.stepLabel, { color: colors.primary }]}>ÉTAPE {step + 1}/5</Text>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{STEPS[step]}</Text>

        {step === 0 && (
          <View style={styles.fields}>
            <InputField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Jean" />
            <InputField label="Nom de famille" value={lastName} onChangeText={setLastName} placeholder="Dupont" />
          </View>
        )}

        {step === 1 && (
          <View style={styles.fields}>
            <InputField label="Nom de l'entreprise" value={bizName} onChangeText={setBizName} placeholder="Mon Business" />
            <InputField label="Téléphone" value={bizPhone} onChangeText={setBizPhone} placeholder="+228 90 00 00 00" keyboardType="phone-pad" />
            <InputField label="Email (optionnel)" value={bizEmail} onChangeText={setBizEmail} placeholder="contact@monbusiness.com" keyboardType="email-address" />
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Secteur d'activité</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catChip, { backgroundColor: category === c ? colors.primary : colors.card, borderColor: category === c ? colors.primary : colors.border }]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.catLabel, { color: category === c ? "#fff" : colors.text }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <InputField label="Ville" value={city} onChangeText={setCity} placeholder="Lomé" />
            <InputField label="Adresse" value={address} onChangeText={setAddress} placeholder="Rue des Artisans, Quartier X" />
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Nombre d'employés</Text>
              <View style={styles.empRow}>
                {["1", "2-5", "6-10", "11-50", "50+"].map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.empChip, { backgroundColor: employees === e ? colors.primary : colors.card, borderColor: employees === e ? colors.primary : colors.border }]}
                    onPress={() => setEmployees(e)}
                  >
                    <Text style={[styles.empLabel, { color: employees === e ? "#fff" : colors.text }]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.fields}>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Définissez vos horaires d'ouverture pour chaque jour de la semaine.</Text>
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

        {step === 3 && (
          <View style={styles.fields}>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Ajoutez votre premier service ou produit pour attirer vos premiers clients.</Text>
            <InputField label="Titre du service" value={serviceTitle} onChangeText={setServiceTitle} placeholder="Ex: Coupe homme" />
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={serviceDesc}
                onChangeText={setServiceDesc}
                placeholder="Décrivez votre service en détail..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>
            <InputField label="Prix (FCFA)" value={servicePrice} onChangeText={setServicePrice} placeholder="Ex: 5000" keyboardType="number-pad" />
          </View>
        )}

        {step === 4 && (
          <View style={styles.fields}>
            <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.pricingBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.pricingBadgeText}>Offre de lancement</Text>
              </View>
              <Text style={[styles.pricingTitle, { color: colors.text }]}>Forfait Pro Mensuel</Text>
              <Text style={[styles.pricingPrice, { color: colors.primary }]}>
                15 000 <Text style={[styles.pricingCurrency, { color: colors.mutedForeground }]}>FCFA/mois</Text>
              </Text>
              {["Profil business visible", "Catalogue illimité", "Réservations en ligne", "Commandes & livraison", "Tableau de bord analytics", "Support prioritaire"].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={14} color={colors.success} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.secondary }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Feather name="credit-card" size={18} color="#fff" />
              <Text style={styles.payBtnText}>{loading ? "Traitement..." : "Payer & Activer mon business"}</Text>
            </TouchableOpacity>

            <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
              Paiement sécurisé · Mobile Money · Visa · Mastercard
            </Text>
          </View>
        )}
      </ScrollView>

      {step < 4 && (
        <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
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
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  catLabel: { fontSize: 12, fontWeight: "600" },
  empRow: { flexDirection: "row", gap: 8 },
  empChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  empLabel: { fontSize: 12, fontWeight: "600" },
  hintText: { fontSize: 14, lineHeight: 20 },
  hourRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  dayLabel: { fontSize: 13, fontWeight: "700" },
  closedToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  closedText: { fontSize: 11, fontWeight: "700" },
  hoursInputs: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  timeInput: { width: 60, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, fontSize: 13, textAlign: "center" },
  timeSep: { fontSize: 13 },
  pricingCard: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 12, overflow: "hidden" },
  pricingBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  pricingBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  pricingTitle: { fontSize: 20, fontWeight: "800" },
  pricingPrice: { fontSize: 32, fontWeight: "900" },
  pricingCurrency: { fontSize: 14, fontWeight: "400" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 14 },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 100 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  legalText: { fontSize: 12, textAlign: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 100 },
  nextBtnText: { fontSize: 16, fontWeight: "700" },
});
