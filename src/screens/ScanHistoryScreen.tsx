import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SectionList,
  TouchableOpacity,
} from 'react-native';
import { getScanHistory } from '../services/api';
import { getRouteOrders } from '../services/routeClosureApi';

interface ScanItem {
  id: string;
  barcode: string;
  scan_type: string;
  scanned_at: string;
  client: { id: string; client_code: string; name: string } | null;
}

interface OrderWithScans {
  id: string;
  pedido_number: string;
  client_name_ocr: string | null;
  expected_cubetas: number;
  expected_cajas_bolsa: number;
  expected_refrigerado: number;
  expected_controlado: number;
  expected_total: number;
  client?: { id: string; name: string; client_code: string } | null;
  scanned: { cubetas: number; cajas_bolsa: number; refrigerado: number; controlado: number; total: number };
}

interface Section {
  title: string;
  data: ScanItem[];
}

interface OrderSection {
  order: OrderWithScans;
  title: string;
  data: ScanItem[];
}

type ViewMode = 'date' | 'order';

interface Props {
  routeId: string;
}

const TYPE_LABELS: Record<string, string> = {
  bulto: 'Bulto',
  cubeta: 'Cubeta',
  rf: 'RF',
  controlado: 'Controlado',
  refrigerado: 'Refrigerado',
};

export default function ScanHistoryScreen({ routeId }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('date');
  const [sections, setSections] = useState<Section[]>([]);
  const [orderSections, setOrderSections] = useState<OrderSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const groupByDate = (scans: ScanItem[]): Section[] => {
    const groups: Record<string, ScanItem[]> = {};
    for (const scan of scans) {
      const date = new Date(scan.scanned_at).toLocaleDateString('es', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(scan);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  };

  const fetchHistory = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        const result = await getScanHistory(routeId, pageNum);
        const newScans = result.data;
        setHasMore(result.current_page < result.last_page);

        if (append) {
          setSections((prev) => {
            const allItems = prev.flatMap((s) => s.data).concat(newScans);
            return groupByDate(allItems);
          });
        } else {
          setSections(groupByDate(newScans));
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [routeId]
  );

  const fetchOrderView = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const [orders, historyResult] = await Promise.all([
        getRouteOrders(routeId, today),
        getScanHistory(routeId, 1),
      ]);

      const allScans: ScanItem[] = historyResult.data;

      // Build order sections: group scans by client match
      const result: OrderSection[] = orders.map((order: OrderWithScans) => {
        const orderScans = allScans.filter(
          (scan) => scan.client && order.client && scan.client.id === order.client.id
        );
        const clientName = order.client?.name ?? order.client_name_ocr ?? 'Sin cliente';
        return {
          order,
          title: `Pedido ${order.pedido_number} — ${clientName}`,
          data: orderScans,
        };
      });

      // Add unmatched scans section
      const matchedClientIds = new Set(
        orders
          .filter((o: OrderWithScans) => o.client)
          .map((o: OrderWithScans) => o.client!.id)
      );
      const unmatchedScans = allScans.filter(
        (scan) => !scan.client || !matchedClientIds.has(scan.client.id)
      );
      if (unmatchedScans.length > 0) {
        result.push({
          order: {
            id: '__unmatched__',
            pedido_number: '',
            client_name_ocr: null,
            expected_cubetas: 0,
            expected_cajas_bolsa: 0,
            expected_refrigerado: 0,
            expected_controlado: 0,
            expected_total: 0,
            scanned: { cubetas: 0, cajas_bolsa: 0, refrigerado: 0, controlado: 0, total: 0 },
          },
          title: `Sin pedido asignado (${unmatchedScans.length})`,
          data: unmatchedScans,
        });
      }

      setOrderSections(result);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (viewMode === 'date') {
      fetchHistory();
    } else {
      fetchOrderView();
    }
  }, [fetchHistory, fetchOrderView, viewMode]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    if (viewMode === 'date') {
      fetchHistory(1);
    } else {
      fetchOrderView();
    }
  };

  const handleLoadMore = () => {
    if (viewMode === 'order' || !hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistory(nextPage, true);
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'bulto': return '#1a56db';
      case 'cubeta': return '#7c3aed';
      case 'rf': return '#059669';
      case 'controlado': return '#d97706';
      case 'refrigerado': return '#0891b2';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a56db" />
      </View>
    );
  }

  const activeSections = viewMode === 'date' ? sections : orderSections;

  const renderOrderSectionHeader = (section: OrderSection) => {
    const { order } = section;
    if (order.id === '__unmatched__') {
      return (
        <View style={styles.orderSectionHeader}>
          <Text style={styles.orderSectionTitle}>{section.title}</Text>
        </View>
      );
    }
    const scannedTotal = order.scanned.total;
    const expectedTotal = order.expected_total;
    const isComplete = scannedTotal >= expectedTotal && expectedTotal > 0;
    const isPending = scannedTotal === 0 && expectedTotal > 0;
    return (
      <View style={styles.orderSectionHeader}>
        <View style={styles.orderSectionTop}>
          <Text style={styles.orderSectionTitle}>{section.title}</Text>
          <View
            style={[
              styles.orderStatusBadge,
              {
                backgroundColor: isComplete ? '#dcfce7' : isPending ? '#fee2e2' : '#fef3c7',
              },
            ]}
          >
            <Text
              style={[
                styles.orderStatusText,
                {
                  color: isComplete ? '#166534' : isPending ? '#991b1b' : '#92400e',
                },
              ]}
            >
              {isComplete ? 'Completo' : isPending ? 'Pendiente' : 'Incompleto'}
            </Text>
          </View>
        </View>
        <View style={styles.orderCountsRow}>
          <Text style={styles.orderCountText}>
            Total: {scannedTotal}/{expectedTotal}
          </Text>
          {order.expected_cubetas > 0 && (
            <Text style={styles.orderCountText}>
              Cub: {order.scanned.cubetas}/{order.expected_cubetas}
            </Text>
          )}
          {order.expected_cajas_bolsa > 0 && (
            <Text style={styles.orderCountText}>
              Caj: {order.scanned.cajas_bolsa}/{order.expected_cajas_bolsa}
            </Text>
          )}
          {order.expected_refrigerado > 0 && (
            <Text style={styles.orderCountText}>
              Ref: {order.scanned.refrigerado}/{order.expected_refrigerado}
            </Text>
          )}
          {order.expected_controlado > 0 && (
            <Text style={styles.orderCountText}>
              Ctrl: {order.scanned.controlado}/{order.expected_controlado}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Historial de escaneos</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'date' && styles.toggleActive]}
            onPress={() => setViewMode('date')}
          >
            <Text style={[styles.toggleText, viewMode === 'date' && styles.toggleTextActive]}>
              Por fecha
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'order' && styles.toggleActive]}
            onPress={() => setViewMode('order')}
          >
            <Text style={[styles.toggleText, viewMode === 'order' && styles.toggleTextActive]}>
              Por pedido
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={activeSections}
        keyExtractor={(item: ScanItem) => item.id}
        renderSectionHeader={({ section }) =>
          viewMode === 'order' ? (
            renderOrderSectionHeader(section as OrderSection)
          ) : (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )
        }
        renderItem={({ item }: { item: ScanItem }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.barcode}>{item.barcode}</Text>
              <View style={[styles.typeBadge, { backgroundColor: typeColor(item.scan_type) }]}>
                <Text style={styles.typeBadgeText}>
                  {TYPE_LABELS[item.scan_type] ?? item.scan_type}
                </Text>
              </View>
            </View>
            {item.client && (
              <Text style={styles.clientText}>
                {item.client.client_code} — {item.client.name}
              </Text>
            )}
            <Text style={styles.timeText}>
              {new Date(item.scanned_at).toLocaleTimeString('es', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              {viewMode === 'order'
                ? 'No hay pedidos para esta ruta.'
                : 'No hay escaneos registrados.'}
            </Text>
          </View>
        }
        stickySectionHeadersEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  sectionHeader: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    padding: 14,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barcode: { fontSize: 16, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  typeBadge: { borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  clientText: { fontSize: 13, color: '#374151', marginTop: 4 },
  timeText: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#6b7280' },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#1a56db',
  },

  // Order section headers
  orderSectionHeader: {
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  orderSectionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  orderStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderCountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 10,
  },
  orderCountText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});
