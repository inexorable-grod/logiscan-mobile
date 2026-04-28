import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { User, Route } from '../types';
import ScannerScreen from '../screens/ScannerScreen';
import RoutesScreen from '../screens/RoutesScreen';
import RequestsScreen from '../screens/RequestsScreen';
import ScanHistoryScreen from '../screens/ScanHistoryScreen';
import RouteClosingScreen from '../screens/RouteClosingScreen';
import MachComparisonScreen from '../screens/MachComparisonScreen';
import { logout as apiLogout } from '../services/api';

type Tab = 'scanner' | 'routes' | 'requests' | 'history' | 'cierre';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function HomeNavigator({ user, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [closureId, setClosureId] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert('Cerrar sesion', 'Esta seguro que desea salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiLogout();
          } catch {
            // Ignore — clear local state regardless
          }
          onLogout();
        },
      },
    ]);
  };

  const handleSelectRoute = (route: Route) => {
    setSelectedRoute(route);
    setActiveTab('scanner');
  };

  const handleChangeRoute = () => {
    setSelectedRoute(null);
  };

  // Gate: must select a route before accessing the app
  if (!selectedRoute) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>LogiScan Pro</Text>
            <Text style={styles.headerSubtitle}>{user.name}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>

        {/* Route selection gate */}
        <View style={styles.gateContainer}>
          <Text style={styles.gateTitle}>Seleccione una ruta</Text>
          <Text style={styles.gateSubtitle}>
            Debe seleccionar una ruta antes de comenzar a escanear.
          </Text>
        </View>

        <View style={styles.content}>
          <RoutesScreen onSelectRoute={handleSelectRoute} />
        </View>
      </View>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'scanner':
        return (
          <ScannerScreen
            operationId="current"
            routeId={selectedRoute.id}
          />
        );
      case 'routes':
        return <RoutesScreen onSelectRoute={handleSelectRoute} />;
      case 'requests':
        return <RequestsScreen routeId={selectedRoute.id} />;
      case 'history':
        return <ScanHistoryScreen routeId={selectedRoute.id} />;
      case 'cierre':
        if (closureId) {
          return (
            <MachComparisonScreen
              closureId={closureId}
              routeNumber={selectedRoute.route_number}
              onBack={() => setClosureId(null)}
            />
          );
        }
        return (
          <RouteClosingScreen
            routeId={selectedRoute.id}
            routeNumber={selectedRoute.route_number}
            onViewComparison={(id: string) => setClosureId(id)}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>LogiScan Pro</Text>
          <Text style={styles.headerSubtitle}>{user.name}</Text>
        </View>
        <TouchableOpacity onPress={handleChangeRoute} style={styles.routeChip}>
          <Text style={styles.routeChipText}>
            Ruta {selectedRoute.route_number}
          </Text>
          <Text style={styles.routeChipChange}>Cambiar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Screen content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'scanner' as Tab, label: 'Escanear' },
          { key: 'routes' as Tab, label: 'Rutas' },
          { key: 'requests' as Tab, label: 'Solicitudes' },
          { key: 'history' as Tab, label: 'Historial' },
          { key: 'cierre' as Tab, label: 'Cierre' },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a56db',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#bfdbfe', fontSize: 13 },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  routeChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  routeChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  routeChipChange: { color: '#bfdbfe', fontSize: 10 },
  gateContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    backgroundColor: '#f0f4f8',
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  gateSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: '#1a56db',
  },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#1a56db', fontWeight: '700' },
});
