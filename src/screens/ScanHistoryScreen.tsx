import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from 'react-native';
import { getScanHistory } from '../services/api';

interface ScanItem {
  id: string;
  barcode: string;
  scan_type: string;
  scanned_at: string;
  client: { id: string; client_code: string; name: string } | null;
}

interface Section {
  title: string;
  data: ScanItem[];
}

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
  const [sections, setSections] = useState<Section[]>([]);
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

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchHistory(1);
  };

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Historial de escaneos</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
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
});
