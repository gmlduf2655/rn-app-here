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
import { getMemos, createMemo, updateMemo, deleteMemo, getUnsyncedMemos, markMemoSynced } from '../db/localDb';
import { uploadMemo } from '../api/springApi';

type Memo = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  synced: number;
  server_id: number | null;
};

type Props = {
  userId: number;
};

export default function MemoScreen({ userId }: Props) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Memo | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const data = await getMemos(userId);
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
    setContent(memo.content);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('제목을 입력해주세요.');
      return;
    }
    if (editTarget) {
      await updateMemo(editTarget.id, title.trim(), content);
    } else {
      await createMemo(userId, title.trim(), content);
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
          await deleteMemo(memo.id);
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
        const result = await uploadMemo({
          title: memo.title,
          content: memo.content,
          createdAt: memo.created_at,
        });
        await markMemoSynced(memo.id, result.id);
      }
      Alert.alert('동기화 완료', `${unsynced.length}개의 메모를 서버에 백업했습니다.`);
      load();
    } catch (e) {
      Alert.alert('동기화 실패', '서버에 연결할 수 없습니다. 홈 네트워크에 연결되어 있는지 확인해주세요.');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>메모</Text>
        <View style={styles.headerActions}>
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
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.memoItem} onPress={() => openEdit(item)}>
            <View style={styles.memoItemRow}>
              <Text style={styles.memoTitle} numberOfLines={1}>{item.title}</Text>
              {item.synced === 0 && <View style={styles.unsyncedDot} />}
            </View>
            <Text style={styles.memoContent} numberOfLines={2}>{item.content}</Text>
            <View style={styles.memoFooter}>
              <Text style={styles.memoDate}>{formatDate(item.updated_at)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  headerActions: { flexDirection: 'row', gap: 8 },
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
});
