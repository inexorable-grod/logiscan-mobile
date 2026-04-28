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
import { getScanHistory, getScansByOrder } from '../services/api';

interface ScanItem {
  id: string;
  barcode: string;
  scan_type: string;
  scanned_at: string;
  client: { id: string; client_code: string; name: string } | null;
}

interface OrderSummary {
  pedido_number: string;
  scanned_count: number;
  expected_count: number;
  packages: string[];
  missing: string[];
  scan_types: string[];
  is_complete: boolean;
}

interface OrderResponse {
  orders: OrderSummary[];
  total_orders: number;
  total_scanned: number;
  complete_orders: number;
  missing_orders: number;
  unmatched_scans: number;
}

interface Section {
  title: string;
  data: ScanItem[];
}

// For SectionList, we use a dummy data item to render order rows
interface OrderSection {
  title: string;
  data: OrderSummary[];
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
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
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
      const result = await getScansByOrder(routeId, today);
      setOrderData(result);
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

  const renderOrderCard = (order: OrderSummary) => {
    const statusColor = order.is_complete ? '#dcfce7' : '#fef3c7';
    const statusTextColor = order.is_complete ? '#166534' : '#92400e';
    const statusLabel = order.is_complete ? 'Completo' : 'Incompleto';
    const hasMissing = order.missing.length > 0;

    return (
      <View key={order.pedido_number} style={styles.orderCard}>
        <View style={styles.orderCardHeader}>
          <Text style={styles.orderPedido}>Pedido {order.pedido_number}</Text>
          <View style={[styles.orderStatusBadge, { backgroundColor: statusColor }]}>
            <Text style={[styles.orderStatusText, { color: statusTextColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.orderCountsRow}>
          <Text style={styles.orderCountLabel}>Escaneados:</Text>
          <Text style={styles.orderCountValue}>
            {order.scanned_count}/{order.expected_count}
          </Text>
        </View>

        <View style={styles.orderPackagesRow}>
          <Text style={styles.orderCountLabel}>Paquetes:</Text>
          <Text style={styles.orderPackagesList}>
            {order.packages.join(', ')}
          </Text>
        </View>

        {hasMissing && (
          <View style={styles.orderMissingRow}>
            <Text style={styles.missingLabel}>Faltantes:</Text>
            <Text style={styles.missingList}>
              {order.missing.join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.orderTypesRow}>
          {order.scan_types.map((t: string) => (
            <View key={t} style={[styles.typeBadge, { backgroundColor: typeColor(t) }]}>
              <Text style={styles.typeBadgeText}>{TYPE_LABELS[t] ?? t}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderOrderView = () => {
    if (!orderData || orderData.orders.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No hay pedidos para esta ruta.</Text>
        </View>
      );
    }

    return (
      <SectionList
        sections={[{ title: 'summary', data: orderData.orders }]}
        keyExtractor={(item: OrderSummary) => item.pedido_number}
        renderSectionHeader={() => (
          <View style={styles.orderSummaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{orderData.total_orders}</Text>
              <Text style={styles.summaryLabel}>Pedidos</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{orderData.total_scanned}</Text>
              <Text style={styles.summaryLabel}>Escaneos</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: '#166534' }]}>{orderData.complete_orders}</Text>
              <Text style={styles.summaryLabel}>Completos</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: '#92400e' }]}>{orderData.missing_orders}</Text>
              <Text style={styles.summaryLabel}>Faltantes</Text>
            </View>
          </View>
        )}
        renderItem={({ item }: { item: OrderSummary }) => renderOrderCard(item)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        stickySectionHeadersEnabled
      />
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

      {viewMode === 'order' ? renderOrderView() : (
        <SectionList
          sections={sections}
          keyExtractor={(item: ScanItem) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
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
              <Text style={styles.emptyText}>No hay escaneos registrados.</Text>
            </View>
          }
          stickySectionHeadersEnabled
        />
      )}
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

  // Order summary bar
  orderSummaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    padding: 12,
    elevation: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },

  // Order cards
  orderCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    padding: 14,
    elevation: 1,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderPedido: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  orderStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderCountLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 90,
  },
  orderCountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  orderPackagesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  orderPackagesList: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  orderMissingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    padding: 6,
    marginTop: 2,
  },
  missingLabel: {
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '600',
    width: 90,
  },
  missingList: {
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '600',
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  orderTypesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
});
