console.log('App module loaded'); // import 레벨
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDb } from './src/db/localDb';
import LoginScreen from './src/screens/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  console.log('App render');  // 렌더 레벨
  const [dbReady, setDbReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    console.log('initDb start');
    initDb()
      .then(() => { console.log('initDb success'); setDbReady(true); })
      .catch((e) => console.error('initDb failed:', e));
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {userId === null ? (
          <LoginScreen onLogin={(id) => setUserId(id)} />
        ) : (
          <AppNavigator userId={userId} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
