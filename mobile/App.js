import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const PERIOD = "2026-06";

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState("ana@chargeops.local");
  const [password, setPassword] = useState("RFID-101");
  const [auth, setAuth] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setLoading(true);
    setError("");
    try {
      const session = await postJson("/auth/login", { email, password });
      if (session.user.role !== "resident") {
        throw new Error("Use uma conta de morador no app mobile.");
      }
      setAuth(session);
      const [units, sessions, invoices] = await Promise.all([
        fetchJson("/units", session.token),
        fetchJson("/sessions", session.token),
        fetchJson(`/invoices/${PERIOD}`, session.token),
      ]);
      setPayload({ ...units, sessions: sessions.sessions, invoices: invoices.invoices });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setAuth(null);
    setPayload(null);
    setError("");
  }

  const selected = useMemo(() => {
    if (!payload || !auth) return null;
    const user = auth.user;
    const unit = payload.units.find((item) => item.id === user.unit_id);
    const invoice = payload.invoices.find((item) => item.unit_id === user.unit_id);
    const sessions = payload.sessions.filter((item) => item.rfid_tag === user.rfid_tag);
    return { user, unit, invoice, sessions };
  }, [payload, auth]);

  if (!auth) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.loginContent}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>EV ChargeOps</Text>
            <Text style={styles.title}>Acompanhe suas recargas</Text>
            <Text style={styles.copy}>Histórico, consumo e fatura mensal vinculados ao RFID cadastrado.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Entrar</Text>
            <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
            <Field label="API" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" />
            <Pressable style={styles.primaryButton} onPress={signIn} disabled={loading}>
              <Text style={styles.primaryButtonText}>{loading ? "Entrando..." : "Entrar"}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.kicker}>Minha recarga</Text>
            <Text style={styles.titleSmall}>{selected?.user.name}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={signOut}>
            <Text style={styles.secondaryButtonText}>Sair</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator color="#167a5a" size="large" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {selected ? (
          <>
            <View style={styles.rfidCard}>
              <View>
                <Text style={styles.label}>RFID autenticado</Text>
                <Text style={styles.rfid}>{selected.user.rfid_tag}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Ativo</Text>
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.metric}>
                <Text style={styles.label}>Fatura</Text>
                <Text style={styles.metricValue}>R$ {selected.invoice?.total.toFixed(2)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.label}>Energia</Text>
                <Text style={styles.metricValue}>{selected.invoice?.energy_kwh.toFixed(1)} kWh</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Unidade</Text>
              <Text style={styles.cardTitle}>{selected.unit?.name}</Text>
              <Text style={styles.muted}>{selected.sessions.length} sessões no ciclo 2026-06</Text>
            </View>

            <Text style={styles.sectionTitle}>Histórico</Text>
            {selected.sessions.map((session) => (
              <View style={styles.session} key={session.id}>
                <View>
                  <Text style={styles.cardTitle}>{session.kwh_delivered.toFixed(1)} kWh</Text>
                  <Text style={styles.muted}>{formatDate(session.start)}</Text>
                </View>
                <Text style={[styles.badge, session.status === "interrompida" && styles.badgeWarn]}>
                  {session.status}
                </Text>
              </View>
            ))}
            {!selected.sessions.length && <Text style={styles.muted}>Nenhuma sessão neste ciclo.</Text>}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );

  async function postJson(path, body) {
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error("Credenciais inválidas ou API indisponível.");
    }
    return response.json();
  }

  async function fetchJson(path, token) {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Falha ao carregar ${path}`);
    }
    return response.json();
  }
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#8b9892" {...props} />
    </View>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#eef2f0",
    flex: 1,
  },
  loginContent: {
    gap: 18,
    padding: 20,
    paddingTop: 44,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingTop: 28,
  },
  hero: {
    backgroundColor: "#15211c",
    borderRadius: 18,
    gap: 10,
    padding: 24,
  },
  kicker: {
    color: "#167a5a",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },
  titleSmall: {
    color: "#17211d",
    fontSize: 26,
    fontWeight: "900",
  },
  copy: {
    color: "#cfdad5",
    fontSize: 15,
    lineHeight: 22,
  },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  field: {
    gap: 7,
  },
  input: {
    backgroundColor: "#f8faf9",
    borderColor: "#d9e0dc",
    borderRadius: 9,
    borderWidth: 1,
    color: "#17211d",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  label: {
    color: "#5d6b64",
    fontSize: 12,
    fontWeight: "800",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#17211d",
    borderRadius: 9,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  secondaryButton: {
    borderColor: "#d9e0dc",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#17211d",
    fontWeight: "900",
  },
  error: {
    color: "#b42318",
    fontWeight: "800",
  },
  rfidCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  rfid: {
    color: "#17211d",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: "#e7f4ef",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillText: {
    color: "#167a5a",
    fontSize: 12,
    fontWeight: "900",
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 16,
  },
  metricValue: {
    color: "#167a5a",
    fontSize: 22,
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#17211d",
    fontSize: 18,
    fontWeight: "900",
  },
  cardTitle: {
    color: "#17211d",
    fontSize: 18,
    fontWeight: "900",
  },
  muted: {
    color: "#5d6b64",
    fontSize: 14,
  },
  session: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  badge: {
    backgroundColor: "#e7f4ef",
    borderRadius: 999,
    color: "#167a5a",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeWarn: {
    backgroundColor: "#fff4df",
    color: "#a95f00",
  },
});
