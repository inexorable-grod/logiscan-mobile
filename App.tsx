import React, { useEffect, useState } from 'react';
import { StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { initDB } from './src/services/offlineQueue';
import { clearToken, registerDeviceToken } from './src/services/api';
import { User } from './src/types';

import LoginScreen from './src/screens/LoginScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import HomeNavigator from './src/navigation/HomeNavigator';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type AppState = 'loading' | 'login' | 'force_password' | 'home';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      await initDB();
      setAppState('login');
    })();
  }, []);

  const registerPushToken = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await registerDeviceToken(
        tokenData.data,
        Platform.OS as 'ios' | 'android'
      );
    } catch {
      // Push notifications are optional — don't block login flow
    }
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    registerPushToken();
    if (loggedInUser.force_password_change) {
      setAppState('force_password');
    } else {
      setAppState('home');
    }
  };

  const handlePasswordChanged = () => {
    if (user) {
      setUser({ ...user, force_password_change: false });
    }
    setAppState('home');
  };

  const handleLogout = async () => {
    try {
      await clearToken();
    } catch {
      // Token may already be invalid
    }
    setUser(null);
    setAppState('login');
  };

  const renderScreen = () => {
    switch (appState) {
      case 'loading':
        return null;
      case 'login':
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
      case 'force_password':
        return <ChangePasswordScreen onPasswordChanged={handlePasswordChanged} />;
      case 'home':
        return <HomeNavigator user={user!} onLogout={handleLogout} />;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#f0f4f8" />
        {renderScreen()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
});
