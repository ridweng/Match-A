import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
  rightElement,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        pressed && onPress && { opacity: 0.7 },
      ]}
      disabled={!onPress && !rightElement}
    >
      <View style={[s.rowIcon, danger && s.rowIconDanger]}>
        <Feather
          name={icon as any}
          size={16}
          color={danger ? colors.dislikeRed : colors.gold}
        />
      </View>
      <Text style={[s.rowLabel, danger && s.rowLabelDanger]}>{label}</Text>
      <View style={s.rowRight}>
        {rightElement ? (
          rightElement
        ) : value ? (
          <Text style={s.rowValue}>{value}</Text>
        ) : null}
        {onPress && !rightElement && (
          <Feather name="chevron-right" size={16} color={colors.slateLight} />
        )}
      </View>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function Divider() {
  return <View style={s.divider} />;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, logout } = useApp();

  const [notifMatches, setNotifMatches] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifTips, setNotifTips] = useState(false);
  const [showAge, setShowAge] = useState(true);
  const [showDistance, setShowDistance] = useState(true);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      language === "es" ? "Cerrar sesión" : "Log out",
      language === "es"
        ? "¿Estás seguro que deseas salir?"
        : "Are you sure you want to log out?",
      [
        {
          text: language === "es" ? "Cancelar" : "Cancel",
          style: "cancel",
        },
        {
          text: language === "es" ? "Salir" : "Log out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      language === "es" ? "Eliminar cuenta" : "Delete account",
      language === "es"
        ? "Esta acción es permanente e irreversible."
        : "This action is permanent and irreversible.",
      [
        {
          text: language === "es" ? "Cancelar" : "Cancel",
          style: "cancel",
        },
        {
          text: language === "es" ? "Eliminar" : "Delete",
          style: "destructive",
          onPress: () => Alert.alert("Demo", "Funcionalidad en desarrollo."),
        },
      ]
    );
  };

  const handleComingSoon = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      language === "es" ? "Próximamente" : "Coming soon",
      language === "es"
        ? "Esta función estará disponible pronto."
        : "This feature will be available soon."
    );
  };

  return (
    <View style={[s.container, { paddingTop: topPadding }]}>
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="chevron-left" size={22} color={colors.ivory} />
        </Pressable>
        <Text style={s.headerTitle}>
          {language === "es" ? "Ajustes" : "Settings"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: bottomPadding + 100 }]}
      >
        <SectionHeader title={language === "es" ? "Cuenta" : "Account"} />
        <View style={s.card}>
          <SettingRow
            icon="user"
            label={language === "es" ? "Nombre de usuario" : "Username"}
            value="@tu_usuario"
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="mail"
            label={language === "es" ? "Correo electrónico" : "Email"}
            value="tu@email.com"
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="phone"
            label={language === "es" ? "Teléfono" : "Phone number"}
            value="+34 ··· ··· ···"
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="lock"
            label={language === "es" ? "Cambiar contraseña" : "Change password"}
            onPress={handleComingSoon}
          />
        </View>

        <SectionHeader
          title={language === "es" ? "Preferencias de búsqueda" : "Discovery preferences"}
        />
        <View style={s.card}>
          <SettingRow
            icon="users"
            label={language === "es" ? "Mostrar perfiles de" : "Show me"}
            value={language === "es" ? "Mujeres" : "Women"}
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="calendar"
            label={language === "es" ? "Rango de edad" : "Age range"}
            value="24 – 36"
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="map-pin"
            label={language === "es" ? "Distancia máxima" : "Maximum distance"}
            value="50 km"
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="globe"
            label={language === "es" ? "Idioma de la app" : "App language"}
            value={language === "es" ? "Español" : "English"}
            onPress={() => setLanguage(language === "es" ? "en" : "es")}
          />
        </View>

        <SectionHeader
          title={language === "es" ? "Notificaciones" : "Notifications"}
        />
        <View style={s.card}>
          <SettingRow
            icon="heart"
            label={language === "es" ? "Nuevos matches" : "New matches"}
            rightElement={
              <Switch
                value={notifMatches}
                onValueChange={setNotifMatches}
                trackColor={{ false: colors.cardBorder, true: colors.gold }}
                thumbColor={colors.ivory}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="message-circle"
            label={language === "es" ? "Mensajes" : "Messages"}
            rightElement={
              <Switch
                value={notifMessages}
                onValueChange={setNotifMessages}
                trackColor={{ false: colors.cardBorder, true: colors.gold }}
                thumbColor={colors.ivory}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="zap"
            label={language === "es" ? "Consejos de mejora" : "Improvement tips"}
            rightElement={
              <Switch
                value={notifTips}
                onValueChange={setNotifTips}
                trackColor={{ false: colors.cardBorder, true: colors.gold }}
                thumbColor={colors.ivory}
              />
            }
          />
        </View>

        <SectionHeader
          title={language === "es" ? "Privacidad" : "Privacy"}
        />
        <View style={s.card}>
          <SettingRow
            icon="eye"
            label={language === "es" ? "Mostrar mi edad" : "Show my age"}
            rightElement={
              <Switch
                value={showAge}
                onValueChange={setShowAge}
                trackColor={{ false: colors.cardBorder, true: colors.gold }}
                thumbColor={colors.ivory}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="navigation"
            label={language === "es" ? "Mostrar mi distancia" : "Show my distance"}
            rightElement={
              <Switch
                value={showDistance}
                onValueChange={setShowDistance}
                trackColor={{ false: colors.cardBorder, true: colors.gold }}
                thumbColor={colors.ivory}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="shield"
            label={language === "es" ? "Bloquear y reportar" : "Block & report"}
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="file-text"
            label={language === "es" ? "Política de privacidad" : "Privacy policy"}
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="info"
            label={language === "es" ? "Términos de uso" : "Terms of service"}
            onPress={handleComingSoon}
          />
        </View>

        <SectionHeader
          title={language === "es" ? "Soporte" : "Support"}
        />
        <View style={s.card}>
          <SettingRow
            icon="help-circle"
            label={language === "es" ? "Centro de ayuda" : "Help center"}
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="star"
            label={language === "es" ? "Valora la app" : "Rate the app"}
            onPress={handleComingSoon}
          />
          <Divider />
          <SettingRow
            icon="share-2"
            label={language === "es" ? "Compartir MatchA" : "Share MatchA"}
            onPress={handleComingSoon}
          />
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.8 }]}
        >
          <Feather name="log-out" size={18} color={colors.ivory} />
          <Text style={s.logoutText}>
            {language === "es" ? "Cerrar sesión" : "Log out"}
          </Text>
        </Pressable>

        <View style={s.dangerZone}>
          <Text style={s.dangerTitle}>
            {language === "es" ? "Zona de peligro" : "Danger zone"}
          </Text>
          <View style={s.card}>
            <SettingRow
              icon="trash-2"
              label={language === "es" ? "Eliminar mi cuenta" : "Delete my account"}
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        <Text style={s.version}>MatchA v1.0.0 · Hecho con ♥</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  sectionHeader: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(76,175,114,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: {
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  rowLabel: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.ivory,
  },
  rowLabelDanger: {
    color: colors.dislikeRed,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.slateLight,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginLeft: 60,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 16,
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.ivory,
  },
  dangerZone: {
    marginTop: 24,
  },
  dangerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.dislikeRed,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  version: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.slateLight,
    textAlign: "center",
    marginTop: 32,
    marginBottom: 8,
  },
});
