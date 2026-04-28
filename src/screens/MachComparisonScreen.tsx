import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { getComparison } from '../services/routeClosureApi';
import { MachComparison, OrderComparison } from '../types/closure';

interface Props {
  closureId: string;
  routeNumber: string;
  onBack: () => void;
}

const STATUS_CONFIG: Record<OrderComparison['status'], { label: string; bg: string; text: string }> = {
  complete: { label: 'Completo', bg: '#dcfce7', text: '#166534' },
  incomplete: { label: 'Incompleto', bg: '#fef3c7', text: '#92400e' },
  pending: { label: 'Pendiente', bg: '#fee2e2', text: '#991b1b' },
  over: { label: 'Excedente', bg: '#dbeafe', text: '#1e40af' },
};

function ProgressBar({ scanned, expected }: { scanned: number; expected: number }) {
  const ratio = expected > 0 ? Math.min(scanned / expected, 1) : 0;
  const percentage = Math.round(ratio * 100);
  const barColor =
    scanned === 0 && expected > 0
      ? '#ef4444'
      : scanned >= expected
      ? '#22c55e'
      : '#f59e0b';

  return (
    <View style={barStyles.container}>
      <View style={barStyles.track}>
        <View
          style={[
            barStyles.fill,
            { width: `${percentage}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={barStyles.label}>
        {scanned}/{expected}
      </Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 40,
    textAlign: 'right',
  },
});

function OrderCard({ order }: { order: OrderComparison }) {
  const config = STATUS_CONFIG[order.status];

  const types: Array<{ key: keyof OrderComparison['expected']; label: string }> = [
    { key: 'cubetas', label: 'Cubetas' },
    { key: 'cajas_bolsa', label: 'Cajas/Bolsa' },
    { key: 'refrigerado', label: 'Refrigerado' },
    { key: 'controlado', label: 'Controlado' },
  ];

  return (
    <View style={cardStyles.card}>
      {/* Header row */}
      <View style={cardStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.pedido}>Pedido {order.pedido_number}</Text>
          <Text style={cardStyles.client} numberOfLines={1}>
            {order.client_name}
          </Text>
        </View>
        <View style={[cardStyles.badge, { backgroundColor: config.bg }]}>
          <Text style={[cardStyles.badgeText, { color: config.text }]}>
            {config.label}
          </Text>
        </View>
      </View>

      {/* Per-type breakdowns */}
      {types.map((type) => {
        const exp = order.expected[type.key];
        const scn = order.scanned[type.key];
        if (exp === 0 && scn === 0) return null;
        return (
          <View key={type.key} style={cardStyles.typeRow}>
            <Text style={cardStyles.typeLabel}>{type.label}</Text>
            <ProgressBar scanned={scn} expected={exp} />
          </View>
        );
      })}

      {/* Total row */}
      <View style={cardStyles.totalRow}>
        <Text style={cardStyles.totalLabel}>Total</Text>
        <ProgressBar scanned={order.scanned.total} expected={order.expected.total} />
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pedido: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  client: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeRow: {
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
});

export default function MachComparisonScreen({ closureId, routeNumber, onBack }: Props) {

  const [data, setData] = useState<MachComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const comparison = await getComparison(closureId);
      setData(comparison);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? err?.message ?? 'No se pudo cargar el comparativo.';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [closureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a56db" />
        <Text style={styles.loadingText}>Cargando comparativo...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Sin datos disponibles.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { summary, orders, unmatched_scans } = data;

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comparativo Ruta {routeNumber}</Text>
        <Text style={styles.headerSubtitle}>
          {summary.total_orders} pedidos en la ruta
        </Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#dcfce7' }]}>
          <Text style={[styles.kpiValue, { color: '#166534' }]}>
            {summary.complete}
          </Text>
          <Text style={[styles.kpiLabel, { color: '#166534' }]}>Completos</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.kpiValue, { color: '#92400e' }]}>
            {summary.incomplete}
          </Text>
          <Text style={[styles.kpiLabel, { color: '#92400e' }]}>Incompletos</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.kpiValue, { color: '#991b1b' }]}>
            {summary.pending}
          </Text>
          <Text style={[styles.kpiLabel, { color: '#991b1b' }]}>Pendientes</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Detalle por pedido</Text>
    </View>
  );

  const renderFooter = () => {
    if (!unmatched_scans || unmatched_scans.length === 0) return null;

    return (
      <View style={styles.unmatchedSection}>
        <Text style={styles.unmatchedTitle}>
          Escaneos sin coincidencia ({unmatched_scans.length})
        </Text>
        {unmatched_scans.map((scan) => (
          <View key={scan.id} style={styles.unmatchedItem}>
            <Text style={styles.unmatchedBarcode}>{scan.barcode}</Text>
            <Text style={styles.unmatchedMeta}>
              {scan.scan_type} - {new Date(scan.scanned_at).toLocaleTimeString()}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.order_id}
        renderItem={({ item }) => <OrderCard order={item} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No se encontraron pedidos para comparar.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  listContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f0f4f8',
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: '#1a56db',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
    marginTop: 4,
  },

  // KPI Row
  kpiRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Section titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },

  // Empty
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Unmatched scans
  unmatchedSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  unmatchedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 10,
  },
  unmatchedItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unmatchedBarcode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'monospace',
  },
  unmatchedMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
});
