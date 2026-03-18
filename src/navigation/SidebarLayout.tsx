import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MemoScreen from '../screens/MemoScreen';
import MandalartScreen from '../screens/MandalartScreen';
import TimeBoxScreen from '../screens/TimeBoxScreen';

const SIDEBAR_WIDTH = 240;

type ScreenName = '메모' | '만다라트' | '타임박스';

const MENU_ITEMS: { name: ScreenName; icon: string }[] = [
  { name: '메모', icon: '📝' },
  { name: '만다라트', icon: '🎯' },
  { name: '타임박스', icon: '⏱' },
];

type Props = { userId: string };

export default function SidebarLayout({ userId }: Props) {
  const [activeScreen, setActiveScreen] = useState<ScreenName>('메모');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [translateX, overlayOpacity]);

  const closeSidebar = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -SIDEBAR_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  }, [translateX, overlayOpacity]);

  const navigate = useCallback(
    (screen: ScreenName) => {
      setActiveScreen(screen);
      closeSidebar();
    },
    [closeSidebar],
  );

  const renderScreen = () => {
    switch (activeScreen) {
      case '메모':
        return <MemoScreen userId={userId} onMenuPress={openSidebar} />;
      case '만다라트':
        return <MandalartScreen onMenuPress={openSidebar} />;
      case '타임박스':
        return <TimeBoxScreen userId={userId} onMenuPress={openSidebar} />;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}

      {/* 사이드바 열릴 때 배경 오버레이 */}
      {sidebarOpen && (
        <TouchableWithoutFeedback onPress={closeSidebar}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableWithoutFeedback>
      )}

      {/* 사이드바 패널 */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.sidebarContent}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.appName}>MyApp</Text>
            <TouchableOpacity onPress={closeSidebar} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, activeScreen === item.name && styles.menuItemActive]}
              onPress={() => navigate(item.name)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, activeScreen === item.name && styles.menuLabelActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarContent: { flex: 1 },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  appName: { fontSize: 20, fontWeight: 'bold', color: '#4f46e5' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#666' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 16, marginBottom: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  menuItemActive: { backgroundColor: '#eef2ff' },
  menuIcon: { fontSize: 22, marginRight: 14 },
  menuLabel: { fontSize: 16, color: '#374151', fontWeight: '500' },
  menuLabelActive: { color: '#4f46e5', fontWeight: '700' },
});
