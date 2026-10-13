import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const PERIOD = "2026-06";
const DEMO_RFIDS = ["RFID-101", "RFID-202", "RFID-303"];

export default function App() {
  const [rfid, setRfid] = useState("RFID-101");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      await fetch(`${API_URL}/seed`, { method: "POST" });
      const [units, sessions, invoices] = await Promise.all([
        fetchJson("/units"),
        fetchJson("/sessions"),
        fetchJson(`/invoices/${PERIOD}`),
      ]);
      setPayload({ ...units, sessions: sessions.sessions, invoices: invoices.invoices });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(() => {
    if (!payload) return null;
    const user = payload.users.find((item) => item.rfid_tag === rfid);
    const unit = payload.units.find((item) => item.id === user?.unit_id);
    const invoice = payload.invoices.find((item) => item.unit_id === user?.unit_id);
    const sessions = payload.sessions.filter((item) => item.rfid_tag === rfid);
    return { user, unit, invoice, sessions };
  }, [payload, rfid]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>EV ChargeOps</Text>
          <Text style={styles.title}>Minha recarga</Text>
        </View>

        <View style={styles.segmented}>
          {DEMO_RFIDS.map((item) => (
            <Pressable
              key={item}
              style={[styles.segment, item === rfid && styles.segmentActive]}
              onPress={() => setRfid(item)}
            >
              <Text style={[styles.segmentText, item === rfid && styles.segmentTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {loading && <ActivityIndicator color="#167a5a" size="large" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {selected?.user ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Usuário autenticado por RFID</Text>
              <Text style={styles.cardTitle}>{selected.user.name}</Text>
              <Text style={styles.muted}>{selected.unit?.name}</Text>
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
}

async function fetchJson(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path}`);
  }
  return response.json();
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
    backgroundColor: "#f5f7f6",
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  header: {
    gap: 4,
    paddingTop: 16,
  },
  kicker: {
    color: "#167a5a",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: "#17211d",
    fontSize: 30,
    fontWeight: "800",
  },
  segmented: {
    backgroundColor: "#e7eeea",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  segment: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#17211d",
  },
  segmentText: {
    color: "#52635b",
    fontSize: 12,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 16,
  },
  label: {
    color: "#5d6b64",
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#17211d",
    fontSize: 18,
    fontWeight: "800",
  },
  muted: {
    color: "#5d6b64",
    fontSize: 14,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 8,
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
    fontWeight: "800",
    marginTop: 4,
  },
  session: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e0dc",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
  },
  badge: {
    backgroundColor: "#eef6f2",
    borderRadius: 999,
    color: "#167a5a",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeWarn: {
    backgroundColor: "#fff6e7",
    color: "#b66a00",
  },
  error: {
    color: "#b42318",
    fontWeight: "700",
  },
});
