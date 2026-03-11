import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import MemoScreen from '../screens/MemoScreen';
import MandalartScreen from '../screens/MandalartScreen';

const Tab = createBottomTabNavigator();

type Props = {
  userId: number;
};

export default function AppNavigator({ userId }: Props) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { paddingBottom: 4, height: 56 },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            메모: '📝',
            만다라트: '🎯',
          };
          return <Text style={{ fontSize: size - 4 }}>{icons[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="메모">
        {() => <MemoScreen userId={userId} />}
      </Tab.Screen>
      <Tab.Screen name="만다라트" component={MandalartScreen} />
    </Tab.Navigator>
  );
}
