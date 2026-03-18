import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMemos, saveMemo, updateMemo, deleteMemo, getUnsyncedMemos, markMemoSynced } from '../db/localDb';
import { fetchAndSeedFromServer } from '../db/syncDb';
import { uploadMemo } from '../api/springApi';

type Memo = {
  memo_id: string;
  user_id: string;
  reg_date: string;
  title: string;
  memo_content: string;
  upd_dt: string;
  synced: number;
};

type Props = {
  userId: string;
  onMenuPress?: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function MemoScreen({ userId, onMenuPress }: Props) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [fetchModalVisible, setFetchModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Memo | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fetchPwd, setFetchPwd] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    const data = await getMemos(userId, '2020-01-01', today());
    setMemos(data);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setTitle('');
    setContent('');
    setModalVisible(true);
  };

  const openEdit = (memo: Memo) => {
    setEditTarget(memo);
    setTitle(memo.title);
    setContent(memo.memo_content);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('제목을 입력해주세요.');
      return;
    }
    if (editTarget) {
      await updateMemo(editTarget.memo_id, userId, title.trim(), content);
    } else {
      await saveMemo(String(Date.now()), userId, today(), title.trim(), content);
    }
    setModalVisible(false);
    load();
  };

  const handleDelete = (memo: Memo) => {
    Alert.alert('삭제', `"${memo.title}" 메모를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteMemo(memo.memo_id);
          load();
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const unsynced = await getUnsyncedMemos(userId);
      if (unsynced.length === 0) {
        Alert.alert('동기화', '모든 메모가 이미 동기화되어 있습니다.');
        return;
      }
      for (const memo of unsynced) {
        await uploadMemo({
          title: memo.title,
          content: memo.memo_content,
          createdAt: memo.reg_date,
        });
        await markMemoSynced(memo.memo_id);
      }
      Alert.alert('동기화 완료', `${unsynced.length}개의 메모를 서버에 백업했습니다.`);
      load();
    } catch {
      Alert.alert('동기화 실패', '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
    } finally {
      setSyncing(false);
    }
  };

  const handleFetch = async () => {
    if (!fetchPwd.trim()) {
      Alert.alert('비밀번호를 입력해주세요.');
      return;
    }
    setFetching(true);
    try {
      const result = await fetchAndSeedFromServer(userId, fetchPwd.trim());
      setFetchModalVisible(false);
      setFetchPwd('');
      if (result.success) {
        Alert.alert('불러오기 완료', `서버에서 ${result.count}개의 메모를 받아왔습니다.`);
        load();
      } else {
        Alert.alert('불러오기 실패', result.error ?? '알 수 없는 오류');
      }
    } finally {
      setFetching(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>메모</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setFetchModalVisible(true)}
            style={styles.fetchButton}
          >
            <Text style={styles.fetchButtonText}>불러오기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSync} style={styles.syncButton} disabled={syncing}>
            <Text style={styles.syncButtonText}>{syncing ? '동기화 중...' : '백업'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreate} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ 새 메모</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={memos}
        keyExtractor={(item) => item.memo_id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.memoItem} onPress={() => openEdit(item)}>
            <View style={styles.memoItemRow}>
              <Text style={styles.memoTitle} numberOfLines={1}>{item.title}</Text>
              {item.synced === 0 && <View style={styles.unsyncedDot} />}
            </View>
            <Text style={styles.memoContent} numberOfLines={2}>{item.memo_content}</Text>
            <View style={styles.memoFooter}>
              <Text style={styles.memoDate}>{formatDate(item.upd_dt)}</Text>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={styles.deleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>메모가 없습니다. 새 메모를 작성해보세요!</Text>
        }
        contentContainerStyle={memos.length === 0 ? styles.emptyContainer : undefined}
      />

      {/* 메모 작성/편집 모달 */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editTarget ? '메모 편집' : '새 메모'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>저장</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.titleInput}
            placeholder="제목"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.contentInput}
            placeholder="내용을 입력하세요..."
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* 서버 불러오기 모달 */}
      <Modal
        visible={fetchModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFetchModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.fetchModal}>
            <Text style={styles.fetchModalTitle}>서버에서 불러오기</Text>
            <Text style={styles.fetchModalDesc}>
              서버의 메모 데이터를 받아와 로컬에 저장합니다.{'\n'}
              오프라인에서도 사용할 수 있게 백업됩니다.
            </Text>
            <TextInput
              style={styles.fetchInput}
              placeholder="비밀번호"
              value={fetchPwd}
              onChangeText={setFetchPwd}
              secureTextEntry
              autoFocus
            />
            <View style={styles.fetchModalActions}>
              <TouchableOpacity
                style={styles.fetchCancelBtn}
                onPress={() => { setFetchModalVisible(false); setFetchPwd(''); }}
              >
                <Text style={styles.fetchCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fetchConfirmBtn, fetching && styles.disabledBtn]}
                onPress={handleFetch}
                disabled={fetching}
              >
                <Text style={styles.fetchConfirmText}>
                  {fetching ? '불러오는 중...' : '불러오기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuBtn: { marginRight: 10, padding: 4 },
  menuBtnText: { fontSize: 22, color: '#1a1a2e' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  headerActions: { flexDirection: 'row', gap: 8 },
  fetchButton: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fetchButtonText: { color: '#16a34a', fontSize: 13, fontWeight: '500' },
  syncButton: {
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: { color: '#2196f3', fontSize: 13, fontWeight: '500' },
  addButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  memoItem: {
    backgroundColor: '#fff',
    margin: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memoItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  memoTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  unsyncedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginLeft: 6 },
  memoContent: { fontSize: 14, color: '#666', marginBottom: 8 },
  memoFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memoDate: { fontSize: 12, color: '#aaa' },
  deleteText: { fontSize: 13, color: '#ef4444' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 15, textAlign: 'center', marginTop: 80 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelText: { color: '#666', fontSize: 16 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a2e' },
  saveText: { color: '#4f46e5', fontSize: 16, fontWeight: '600' },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    color: '#1a1a2e',
  },
  contentInput: {
    flex: 1,
    fontSize: 15,
    padding: 16,
    color: '#333',
    lineHeight: 24,
  },
  // 불러오기 모달
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fetchModal: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '100%',
  },
  fetchModalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  fetchModalDesc: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 16 },
  fetchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
  },
  fetchModalActions: { flexDirection: 'row', gap: 10 },
  fetchCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  fetchCancelText: { color: '#666', fontSize: 15 },
  fetchConfirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  fetchConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabledBtn: { backgroundColor: '#86efac' },
});
