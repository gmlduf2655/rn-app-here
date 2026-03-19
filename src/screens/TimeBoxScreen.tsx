import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getBrainDumps,
  saveBrainDump,
  togglePriority,
  toggleComplete,
  deleteBrainDump,
  getTimeTable,
  saveTimeTable,
  deleteTimeTable,
  BrainDump,
  TimeTableItem,
} from '../db/localDb';

type Props = {
  userId: string;
  onMenuPress?: () => void;
};

const COLORS = ['#4f46e5', '#16a34a', '#dc2626', '#d97706', '#0891b2'];

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDisplayDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

export default function TimeBoxScreen({ userId, onMenuPress }: Props) {
  const [currentDate, setCurrentDate] = useState<string>(toDateString(new Date()));
  const [brainDumps, setBrainDumps] = useState<BrainDump[]>([]);
  const [timeTable, setTimeTable] = useState<TimeTableItem[]>([]);

  // Brain Dump 추가 인풋 상태
  const [addingDump, setAddingDump] = useState(false);
  const newDumpTitleRef = useRef('');       // 한글 조합 충돌 방지: ref로 관리
  const inputRef = useRef<TextInput>(null); // 추가 후 input 초기화용

  // 시간 슬롯 선택 → Brain Dump 선택 모달
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);

  const load = useCallback(async () => {
    const dumps = await getBrainDumps(userId, currentDate);
    const table = await getTimeTable(userId, currentDate);
    setBrainDumps(dumps);
    setTimeTable(table);
  }, [userId, currentDate]);

  useEffect(() => {
    load();
  }, [load]);

  // 날짜 이동
  const moveDate = (days: number) => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setCurrentDate(toDateString(d));
  };

  // Brain Dump 저장
  const handleAddDump = async () => {
    const title = newDumpTitleRef.current.trim();
    if (!title) {
      Alert.alert('할 일 제목을 입력해주세요.');
      return;
    }
    const dumpId = String(Date.now()) + String(Math.random());
    await saveBrainDump(dumpId, userId, currentDate, title, '', 'N', '0');
    newDumpTitleRef.current = '';
    inputRef.current?.clear();
    setAddingDump(false);
    load();
  };

  // 우선순위 토글 (최대 3개)
  const handleTogglePriority = async (item: BrainDump) => {
    if (item.priority_yn !== 'Y') {
      const priorityCount = brainDumps.filter((d) => d.priority_yn === 'Y').length;
      if (priorityCount >= 3) {
        Alert.alert('Top 3 Priority', '우선순위는 최대 3개까지만 선택할 수 있습니다.');
        return;
      }
    }
    await togglePriority(item.dump_id, item.priority_yn);
    load();
  };

  // 완료 토글
  const handleToggleComplete = async (item: BrainDump) => {
    await toggleComplete(item.dump_id, item.complete_yn);
    load();
  };

  // Brain Dump 삭제
  const handleDeleteDump = (item: BrainDump) => {
    Alert.alert('삭제', `"${item.dump_title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteBrainDump(item.dump_id);
          load();
        },
      },
    ]);
  };

  // 시간 슬롯 클릭 → 모달 열기
  const openSlotModal = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedColor(COLORS[0]);
    setSlotModalVisible(true);
  };

  // 시간 슬롯에 Brain Dump 배정
  const handleAssignDump = async (dump: BrainDump) => {
    const timeTableId = String(Date.now()) + String(Math.random());
    await saveTimeTable(timeTableId, dump.dump_id, currentDate, userId, selectedHour, selectedMinute, selectedColor);
    setSlotModalVisible(false);
    load();
  };

  // 시간 슬롯 항목 삭제
  const handleDeleteTimeTable = async (item: TimeTableItem) => {
    await deleteTimeTable(item.time_table_id);
    load();
  };

  // 해당 시간+분에 배정된 항목 (슬롯당 1개)
  const getSlotItem = (hour: number, minute: number) =>
    timeTable.find((t) => t.time_hour === hour && t.time_minute === minute) ?? null;

  // Top 3 Priority 목록
  const top3 = brainDumps.filter((d) => d.priority_yn === 'Y').slice(0, 3);

  // 미완료 Brain Dump 목록 (모달용)
  const incompleteDumps = brainDumps.filter((d) => d.complete_yn !== 'Y');

  // 시간별 행 목록 (24개, 각 행에 :00과 :30 슬롯)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>타임박스</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 날짜 네비게이터 */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => moveDate(-1)} style={styles.dateNavBtn}>
            <Text style={styles.dateNavArrow}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDisplayDate(currentDate)}</Text>
          <TouchableOpacity onPress={() => moveDate(1)} style={styles.dateNavBtn}>
            <Text style={styles.dateNavArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Top 3 Priority 섹션 */}
        <View style={styles.top3Section}>
          <Text style={styles.top3Title}>Top 3 Priority</Text>
          <View style={styles.top3List}>
            {[0, 1, 2].map((i) => {
              const item = top3[i];
              return (
                <View key={i} style={styles.top3Item}>
                  <Text style={styles.top3Rank}>{i + 1}</Text>
                  {item ? (
                    <Text
                      style={[styles.top3Text, item.complete_yn === 'Y' && styles.top3TextDone]}
                      numberOfLines={1}
                    >
                      {item.dump_title}
                    </Text>
                  ) : (
                    <Text style={styles.top3Empty}>-</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Brain Dump 섹션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Brain Dump</Text>
            <TouchableOpacity onPress={() => setAddingDump(true)} style={styles.addDumpBtn}>
              <Text style={styles.addDumpBtnText}>+ 할 일 추가</Text>
            </TouchableOpacity>
          </View>

          {/* 인라인 추가 입력 */}
          {addingDump && (
            <View style={styles.addDumpRow}>
              <TextInput
                ref={inputRef}
                style={styles.addDumpInput}
                placeholder="할 일 제목"
                onChangeText={(text) => { newDumpTitleRef.current = text; }}
                autoFocus
                onSubmitEditing={handleAddDump}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleAddDump} style={styles.addDumpConfirmBtn}>
                <Text style={styles.addDumpConfirmText}>추가</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { newDumpTitleRef.current = ''; inputRef.current?.clear(); setAddingDump(false); }}
                style={styles.addDumpCancelBtn}
              >
                <Text style={styles.addDumpCancelText}>취소</Text>
              </TouchableOpacity>
            </View>
          )}

          {brainDumps.length === 0 && !addingDump && (
            <Text style={styles.emptyText}>할 일을 추가해보세요!</Text>
          )}

          {brainDumps.map((item) => (
            <View key={item.dump_id} style={styles.dumpItem}>
              {/* 우선순위 버튼 */}
              <TouchableOpacity
                onPress={() => handleTogglePriority(item)}
                style={styles.priorityBtn}
              >
                <Text style={[styles.priorityIcon, item.priority_yn === 'Y' && styles.priorityActive]}>
                  {item.priority_yn === 'Y' ? '★' : '☆'}
                </Text>
              </TouchableOpacity>

              {/* 제목 */}
              <Text
                style={[
                  styles.dumpTitle,
                  item.complete_yn === 'Y' && styles.dumpTitleDone,
                ]}
                numberOfLines={1}
              >
                {item.dump_title}
              </Text>

              {/* 완료 버튼 */}
              <TouchableOpacity
                onPress={() => handleToggleComplete(item)}
                style={styles.completeBtn}
              >
                <Text style={[styles.completeIcon, item.complete_yn === 'Y' && styles.completeActive]}>
                  ✓
                </Text>
              </TouchableOpacity>

              {/* 삭제 버튼 */}
              <TouchableOpacity onPress={() => handleDeleteDump(item)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* 시간표 섹션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘의 시간표</Text>
          </View>

          {hours.map((hour) => {
            const slot0 = getSlotItem(hour, 0);
            const slot30 = getSlotItem(hour, 30);
            return (
              <View key={hour} style={styles.timeSlot}>
                {/* 시간 레이블 */}
                <Text style={styles.timeLabel}>
                  {String(hour).padStart(2, '0')}
                </Text>

                {/* :00 슬롯 */}
                <View style={styles.halfSlot}>
                  {slot0 ? (
                    <View style={[styles.slotItem, { borderLeftColor: slot0.color }]}>
                      <Text style={[styles.slotTitle, slot0.complete_yn === 'Y' && styles.slotTitleDone]} numberOfLines={1}>
                        {slot0.dump_title}
                      </Text>
                      {slot0.priority_yn === 'Y' && <Text style={styles.slotPriority}>★</Text>}
                      <TouchableOpacity onPress={() => handleDeleteTimeTable(slot0)} style={styles.slotDeleteBtn}>
                        <Text style={styles.slotDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => openSlotModal(hour, 0)} style={styles.slotAddBtn}>
                      <Text style={styles.slotAddText}>:00</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* :30 슬롯 */}
                <View style={styles.halfSlot}>
                  {slot30 ? (
                    <View style={[styles.slotItem, { borderLeftColor: slot30.color }]}>
                      <Text style={[styles.slotTitle, slot30.complete_yn === 'Y' && styles.slotTitleDone]} numberOfLines={1}>
                        {slot30.dump_title}
                      </Text>
                      {slot30.priority_yn === 'Y' && <Text style={styles.slotPriority}>★</Text>}
                      <TouchableOpacity onPress={() => handleDeleteTimeTable(slot30)} style={styles.slotDeleteBtn}>
                        <Text style={styles.slotDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => openSlotModal(hour, 30)} style={styles.slotAddBtn}>
                      <Text style={styles.slotAddText}>:30</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Brain Dump 선택 모달 */}
      <Modal
        visible={slotModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSlotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')} — 할 일 배정
            </Text>

            {/* 색상 선택 */}
            <Text style={styles.modalSubTitle}>색상 선택</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorDotSelected,
                  ]}
                />
              ))}
            </View>

            {/* 미완료 Brain Dump 목록 */}
            <Text style={styles.modalSubTitle}>할 일 선택</Text>
            {incompleteDumps.length === 0 ? (
              <Text style={styles.emptyText}>배정할 수 있는 할 일이 없습니다.</Text>
            ) : (
              <FlatList
                data={incompleteDumps}
                keyExtractor={(item) => item.dump_id}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalDumpItem}
                    onPress={() => handleAssignDump(item)}
                  >
                    <Text style={styles.modalDumpPriority}>
                      {item.priority_yn === 'Y' ? '★ ' : ''}
                    </Text>
                    <Text style={styles.modalDumpTitle}>{item.dump_title}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              onPress={() => setSlotModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
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
  scrollContent: { paddingBottom: 40 },

  // 날짜 네비게이터
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 20,
  },
  dateNavBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0f0ff',
  },
  dateNavArrow: { fontSize: 18, color: '#4f46e5', fontWeight: '600' },
  dateText: { fontSize: 17, fontWeight: '600', color: '#1a1a2e', minWidth: 120, textAlign: 'center' },

  // Top 3 Priority
  top3Section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  top3Title: { fontSize: 14, fontWeight: '700', color: '#d97706', marginBottom: 10 },
  top3List: { flexDirection: 'row', gap: 8 },
  top3Item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  top3Rank: { fontSize: 13, fontWeight: '700', color: '#d97706', minWidth: 12 },
  top3Text: { flex: 1, fontSize: 12, color: '#1a1a2e' },
  top3TextDone: { textDecorationLine: 'line-through', color: '#aaa' },
  top3Empty: { flex: 1, fontSize: 12, color: '#ccc', textAlign: 'center' },

  // 섹션
  section: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },

  // Brain Dump 추가 버튼
  addDumpBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addDumpBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  // 인라인 추가 입력
  addDumpRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  addDumpInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#1a1a2e',
    backgroundColor: '#f8f9fa',
  },
  addDumpConfirmBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addDumpConfirmText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  addDumpCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addDumpCancelText: { color: '#666', fontSize: 13 },

  emptyText: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingVertical: 12 },

  // Brain Dump 항목
  dumpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 6,
  },
  priorityBtn: { padding: 4 },
  priorityIcon: { fontSize: 18, color: '#ccc' },
  priorityActive: { color: '#d97706' },
  dumpTitle: { flex: 1, fontSize: 15, color: '#1a1a2e' },
  dumpTitleDone: { textDecorationLine: 'line-through', color: '#aaa' },
  completeBtn: { padding: 4 },
  completeIcon: { fontSize: 16, color: '#ccc', fontWeight: '700' },
  completeActive: { color: '#16a34a' },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 13, color: '#ef4444' },

  // 시간 슬롯
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 4,
  },
  timeLabel: {
    width: 52,
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    textAlign: 'right',
    marginRight: 10,
  },
  slotContent: { flex: 1, flexDirection: 'column', gap: 4 },
  halfSlot: { flex: 1, paddingHorizontal: 2 },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderLeftWidth: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  slotTitle: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  slotTitleDone: { textDecorationLine: 'line-through', color: '#aaa' },
  slotPriority: { fontSize: 13, color: '#d97706' },
  slotDeleteBtn: { padding: 2 },
  slotDeleteText: { fontSize: 13, color: '#ef4444' },
  slotAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignSelf: 'flex-start',
  },
  slotAddText: { fontSize: 16, color: '#4f46e5', lineHeight: 20 },

  // 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 },
  modalSubTitle: { fontSize: 13, color: '#888', marginBottom: 8, marginTop: 4 },

  // 색상 선택
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#1a1a2e',
  },

  // 모달 Brain Dump 목록
  modalList: { maxHeight: 280, marginBottom: 8 },
  modalDumpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalDumpPriority: { fontSize: 15, color: '#d97706', marginRight: 4 },
  modalDumpTitle: { fontSize: 15, color: '#1a1a2e', flex: 1 },

  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modalCancelText: { color: '#666', fontSize: 15 },
});
