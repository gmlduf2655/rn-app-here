import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUser, findUser } from '../db/localDb';

type Props = {
  onLogin: (userId: string, userName: string) => void;
};

export default function LoginScreen({ onLogin }: Props) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [userName, setUserName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!userId.trim() || !password.trim()) {
      Alert.alert('입력 오류', '아이디와 비밀번호를 입력해주세요.');
      return;
    }

    if (isSignUp) {
      try {
        await createUser(userId.trim(), password, userName.trim(), '', '');
        Alert.alert('가입 완료', '로그인해주세요.');
        setIsSignUp(false);
      } catch {
        Alert.alert('오류', '이미 존재하는 아이디입니다.');
      }
    } else {
      const user = await findUser(userId.trim(), password);
      if (user) {
        onLogin(user.user_id, user.user_name ?? '');
      } else {
        Alert.alert('로그인 실패', '아이디 또는 비밀번호가 틀렸습니다.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
      <Text style={styles.title}>MyApp</Text>

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="이름"
          value={userName}
          onChangeText={setUserName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="아이디"
        value={userId}
        onChangeText={setUserId}
        autoCapitalize="none"
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Text style={styles.eyeText}>{showPassword ? '숨김' : '표시'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{isSignUp ? '회원가입' : '로그인'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.toggleText}>
          {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </Text>
      </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8f9fa' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#1a1a2e',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleText: {
    color: '#4f46e5',
    fontSize: 14,
  },
  passwordRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeText: {
    fontSize: 13,
    color: '#4f46e5',
  },
});
