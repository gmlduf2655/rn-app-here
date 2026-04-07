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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
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
  getUnsyncedBrainDumps,
  markBrainDumpSynced,
  updateBrainDump,
  getUnsyncedTimeTables,
  markTimeTableSynced,
  BrainDump,
  TimeTableItem,
} from '../db/localDb';
import { fetchAndSeedTimeBoxFromServer } from '../db/syncDb';
import { uploadBrainDump, uploadTimeTable } from '../api/springApi';

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

  const [syncing, setSyncing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchModalVisible, setFetchModalVisible] = useState(false);
  const [fetchPwd, setFetchPwd] = useState('');

  // Brain Dump 상세 편집 모달
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDump, setSelectedDump] = useState<BrainDump | null>(null);
  const detailTitleRef = useRef('');
  const detailContentRef = useRef('');

  // 상세 모달 시간 배정
  const [detailTimeEnabled, setDetailTimeEnabled] = useState(false);
  const [detailHourCursor, setDetailHourCursor] = useState(9);
  const [detailAssignSlots, setDetailAssignSlots] = useState<{hour: number; minute: number}[]>([]);
  const [detailAssignColor, setDetailAssignColor] = useState(COLORS[0]);
  const [detailExistingSlots, setDetailExistingSlots] = useState<TimeTableItem[]>([]);

  // 시간 슬롯 선택 → Brain Dump 선택 모달
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);

  // 배정된 슬롯 상세 모달
  const [slotDetailModalVisible, setSlotDetailModalVisible] = useState(false);
  const [selectedSlotItem, setSelectedSlotItem] = useState<TimeTableItem | null>(null);
  const [slotDetailColor, setSlotDetailColor] = useState<string>(COLORS[0]);
  const [slotDetailDumpId, setSlotDetailDumpId] = useState<string>('');

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

  // Brain Dump 상세 모달 열기
  const openDetailModal = (item: BrainDump) => {
    setSelectedDump(item);
    detailTitleRef.current = item.dump_title;
    detailContentRef.current = item.dump_content;
    setDetailTimeEnabled(false);
    setDetailHourCursor(9);
    setDetailAssignSlots([]);
    setDetailAssignColor(COLORS[0]);
    setDetailExistingSlots(timeTable.filter(t => t.dump_id === item.dump_id));
    setDetailModalVisible(true);
  };

  // Brain Dump 상세 저장
  const handleSaveDetail = async () => {
    if (!selectedDump) return;
    const title = detailTitleRef.current.trim();
    if (!title) {
      Alert.alert('제목을 입력해주세요.');
      return;
    }
    await updateBrainDump(selectedDump.dump_id, userId, title, detailContentRef.current);
    if (detailTimeEnabled && detailAssignSlots.length > 0) {
      for (const slot of detailAssignSlots) {
        const timeTableId = String(Date.now()) + String(Math.random());
        await saveTimeTable(timeTableId, selectedDump.dump_id, currentDate, userId, slot.hour, slot.minute, detailAssignColor, '0');
      }
    }
    setDetailModalVisible(false);
    setSelectedDump(null);
    load();
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
    await saveTimeTable(timeTableId, dump.dump_id, currentDate, userId, selectedHour, selectedMinute, selectedColor, "1");
    setSlotModalVisible(false);
    load();
  };

  // 시간 슬롯 항목 삭제
  const handleDeleteTimeTable = async (item: TimeTableItem) => {
    await deleteTimeTable(item.time_table_id);
    load();
  };

  // 배정된 슬롯 수정 (색상/할 일 변경)
  const handleSaveSlotDetail = async () => {
    if (!selectedSlotItem) return;
    await saveTimeTable(
      selectedSlotItem.time_table_id,
      slotDetailDumpId,
      selectedSlotItem.tbox_date,
      selectedSlotItem.user_id,
      selectedSlotItem.time_hour,
      selectedSlotItem.time_minute,
      slotDetailColor,
      '0',
    );
    setSlotDetailModalVisible(false);
    load();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const unsyncedDumps = await getUnsyncedBrainDumps(userId);
      const unsyncedTables = await getUnsyncedTimeTables(userId);

      if (unsyncedDumps.length === 0 && unsyncedTables.length === 0) {
        Alert.alert('동기화', '모든 데이터가 이미 동기화되어 있습니다.');
        return;
      }

      for (const dump of unsyncedDumps) {
        await uploadBrainDump({
          dumpId: dump.dump_id,
          userId,
          tboxDate: dump.tbox_date,
          dumpTitle: dump.dump_title,
          dumpContent: dump.dump_content,
          priorityYn: dump.priority_yn,
          completeYn: dump.complete_yn,
          status: dump.status,
        });
        await markBrainDumpSynced(dump.dump_id);
      }

      for (const item of unsyncedTables) {
        await uploadTimeTable({
          timeTableId: item.time_table_id,
          dumpId: item.dump_id,
          tboxDate: item.tbox_date,
          userId: item.user_id,
          timeHour: item.time_hour,
          timeMinute: item.time_minute,
          color: item.color,
        });
        await markTimeTableSynced(item.time_table_id);
      }

      Alert.alert(
        '동기화 완료',
        `할 일 ${unsyncedDumps.length}개, 타임테이블 ${unsyncedTables.length}개를 서버에 백업했습니다.`
      );
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
      const result = await fetchAndSeedTimeBoxFromServer(userId, fetchPwd.trim());
      setFetchModalVisible(false);
      setFetchPwd('');
      if (result.success) {
        Alert.alert('불러오기 완료', `서버에서 ${result.count}개의 할 일을 받아왔습니다.`);
        load();
      } else {
        Alert.alert('불러오기 실패', result.error ?? '알 수 없는 오류');
      }
    } finally {
      setFetching(false);
    }
  };

  // 해당 시간+분에 배정된 항목 (슬롯당 1개)
  const getSlotItem = (hour: number, minute: number) =>
    timeTable.find((t) => t.time_hour === hour && t.time_minute === minute) ?? null;

  // Top 3 Priority 목록
  const top3 = brainDumps.filter((d) => d.priority_yn === 'Y').slice(0, 3);

  // 미완료 Brain Dump 목록 (모달용)
  //const incompleteDumps = brainDumps.filter((d) => d.complete_yn !== 'Y');
  const incompleteDumps = brainDumps.filter((d) => 1 == 1);

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
        </View>
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
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openDetailModal(item)}>
                <Text
                  style={[
                    styles.dumpTitle,
                    item.complete_yn === 'Y' && styles.dumpTitleDone,
                  ]}
                  numberOfLines={1}
                >
                  {item.dump_title}
                </Text>
                {item.dump_content ? (
                  <Text style={styles.dumpContentPreview} numberOfLines={1}>
                    {item.dump_content}
                  </Text>
                ) : null}
              </TouchableOpacity>

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
                    <TouchableOpacity
                      style={[styles.slotItem, { borderLeftColor: slot0.color }]}
                      onPress={() => { setSelectedSlotItem(slot0); setSlotDetailColor(slot0.color); setSlotDetailDumpId(slot0.dump_id); setSlotDetailModalVisible(true); }}
                    >
                      <Text style={[styles.slotTitle, slot0.complete_yn === 'Y' && styles.slotTitleDone]} numberOfLines={1}>
                        {slot0.dump_title}
                      </Text>
                      {slot0.priority_yn === 'Y' && <Text style={styles.slotPriority}>★</Text>}
                      <TouchableOpacity onPress={() => handleDeleteTimeTable(slot0)} style={styles.slotDeleteBtn}>
                        <Text style={styles.slotDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => openSlotModal(hour, 0)} style={styles.slotAddBtn}>
                      <Text style={styles.slotAddText}>:00</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* :30 슬롯 */}
                <View style={styles.halfSlot}>
                  {slot30 ? (
                    <TouchableOpacity
                      style={[styles.slotItem, { borderLeftColor: slot30.color }]}
                      onPress={() => { setSelectedSlotItem(slot30); setSlotDetailColor(slot30.color); setSlotDetailDumpId(slot30.dump_id); setSlotDetailModalVisible(true); }}
                    >
                      <Text style={[styles.slotTitle, slot30.complete_yn === 'Y' && styles.slotTitleDone]} numberOfLines={1}>
                        {slot30.dump_title}
                      </Text>
                      {slot30.priority_yn === 'Y' && <Text style={styles.slotPriority}>★</Text>}
                      <TouchableOpacity onPress={() => handleDeleteTimeTable(slot30)} style={styles.slotDeleteBtn}>
                        <Text style={styles.slotDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
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

      {/* 서버 불러오기 모달 */}
      <Modal
        visible={fetchModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFetchModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.fetchModal}>
            <Text style={styles.fetchModalTitle}>서버에서 불러오기</Text>
            <Text style={styles.fetchModalDesc}>
              서버의 타임박스 데이터를 받아와 로컬에 저장합니다.{'\n'}
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Brain Dump 상세 편집 모달 */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior="padding"
        >
          <View style={styles.detailModal}>
            <Text style={styles.detailModalTitle}>할 일 상세</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.detailLabel}>제목</Text>
              <TextInput
                style={styles.detailTitleInput}
                defaultValue={selectedDump?.dump_title ?? ''}
                onChangeText={(t) => { detailTitleRef.current = t; }}
                placeholder="제목"
                returnKeyType="next"
              />
              <Text style={styles.detailLabel}>내용</Text>
              <TextInput
                style={styles.detailContentInput}
                defaultValue={selectedDump?.dump_content ?? ''}
                onChangeText={(t) => { detailContentRef.current = t; }}
                placeholder="상세 내용을 입력하세요"
                multiline
                textAlignVertical="top"
                scrollEnabled
              />

              {/* 기존 배정된 시간 */}
              {detailExistingSlots.length > 0 && (
                <View style={styles.existingSlotsSection}>
                  <Text style={styles.detailLabel}>배정된 시간</Text>
                  <View style={styles.existingSlotsList}>
                    {[...detailExistingSlots]
                      .sort((a, b) => a.time_hour !== b.time_hour ? a.time_hour - b.time_hour : a.time_minute - b.time_minute)
                      .map(slot => (
                        <View key={slot.time_table_id} style={[styles.existingSlotChip, { borderLeftColor: slot.color }]}>
                          <Text style={styles.existingSlotText}>
                            {String(slot.time_hour).padStart(2, '0')}:{slot.time_minute === 0 ? '00' : '30'}
                          </Text>
                          <TouchableOpacity
                            onPress={async () => {
                              await handleDeleteTimeTable(slot);
                              setDetailExistingSlots(prev => prev.filter(s => s.time_table_id !== slot.time_table_id));
                            }}
                          >
                            <Text style={styles.existingSlotDeleteText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                </View>
              )}

              {/* 시간 배정 */}
              <View style={styles.timeAssignHeader}>
                <Text style={styles.detailLabel}>시간 배정</Text>
                <TouchableOpacity
                  style={[styles.timeToggleBtn, detailTimeEnabled && styles.timeToggleBtnOn]}
                  onPress={() => setDetailTimeEnabled(!detailTimeEnabled)}
                >
                  <Text style={[styles.timeToggleText, detailTimeEnabled && styles.timeToggleTextOn]}>
                    {detailTimeEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {detailTimeEnabled && (
                <>
                  {/* 시 선택 (커서) */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.hourBtn, detailHourCursor === i && styles.hourBtnSelected]}
                        onPress={() => setDetailHourCursor(i)}
                      >
                        <Text style={[styles.hourBtnText, detailHourCursor === i && styles.hourBtnTextSelected]}>
                          {String(i).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* 분 선택 → 슬롯 토글 */}
                  <View style={styles.minuteRow}>
                    {[0, 30].map((m) => {
                      const isActive = detailAssignSlots.some(s => s.hour === detailHourCursor && s.minute === m);
                      const isAlreadyAssigned = detailExistingSlots.some(s => s.time_hour === detailHourCursor && s.time_minute === m);
                      return (
                        <TouchableOpacity
                          key={m}
                          disabled={isAlreadyAssigned}
                          style={[
                            styles.minuteBtn,
                            isActive && styles.minuteBtnSelected,
                            isAlreadyAssigned && styles.minuteBtnAssigned,
                          ]}
                          onPress={() => {
                            setDetailAssignSlots(prev =>
                              isActive
                                ? prev.filter(s => !(s.hour === detailHourCursor && s.minute === m))
                                : [...prev, { hour: detailHourCursor, minute: m }]
                            );
                          }}
                        >
                          <Text style={[
                            styles.minuteBtnText,
                            isActive && styles.minuteBtnTextSelected,
                            isAlreadyAssigned && styles.minuteBtnTextAssigned,
                          ]}>
                            {String(detailHourCursor).padStart(2, '0')}{m === 0 ? ':00' : ':30'}
                          </Text>
                          {isAlreadyAssigned && <Text style={styles.minuteBtnAssignedLabel}>배정됨</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 선택된 슬롯 칩 */}
                  {detailAssignSlots.length > 0 && (
                    <View style={styles.slotChipRow}>
                      {[...detailAssignSlots]
                        .sort((a, b) => a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute)
                        .map((s) => (
                          <TouchableOpacity
                            key={`${s.hour}-${s.minute}`}
                            style={styles.slotChip}
                            onPress={() => setDetailAssignSlots(prev => prev.filter(x => !(x.hour === s.hour && x.minute === s.minute)))}
                          >
                            <Text style={styles.slotChipText}>
                              {String(s.hour).padStart(2, '0')}:{s.minute === 0 ? '00' : '30'} ✕
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  )}

                  {/* 색상 선택 */}
                  <View style={styles.colorRow}>
                    {COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorDot, { backgroundColor: c }, detailAssignColor === c && styles.colorDotSelected]}
                        onPress={() => setDetailAssignColor(c)}
                      />
                    ))}
                  </View>

                  <Text style={styles.timePreview}>
                    {detailAssignSlots.length === 0
                      ? '분 버튼을 눌러 시간을 추가하세요'
                      : `${detailAssignSlots.length}개 슬롯에 배정됩니다`}
                  </Text>
                </>
              )}
            </ScrollView>
            <View style={styles.fetchModalActions}>
              <TouchableOpacity
                style={styles.fetchCancelBtn}
                onPress={() => { setDetailModalVisible(false); setSelectedDump(null); }}
              >
                <Text style={styles.fetchCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fetchConfirmBtn} onPress={handleSaveDetail}>
                <Text style={styles.fetchConfirmText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Brain Dump 선택 모달 */}
      <Modal
        visible={slotModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSlotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* 고정 헤더 영역 */}
            <Text style={styles.modalTitle}>
              {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')} — 할 일 배정
            </Text>
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
            <Text style={styles.modalSubTitle}>할 일 선택</Text>

            {/* 스크롤 가능한 목록 영역 — flex: 1로 남은 공간 차지 */}
            <View style={styles.modalListContainer}>
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
            </View>

            {/* 항상 보이는 취소 버튼 */}
            <TouchableOpacity
              onPress={() => setSlotModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* 배정된 슬롯 상세 모달 */}
      <Modal
        visible={slotDetailModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSlotDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.slotDetailBox}>
            {/* 헤더: 시간 + 색상 바 */}
            <View style={[styles.slotDetailColorBar, { backgroundColor: slotDetailColor }]} />
            <Text style={styles.slotDetailTime}>
              {selectedSlotItem
                ? `${String(selectedSlotItem.time_hour).padStart(2, '0')}:${selectedSlotItem.time_minute === 0 ? '00' : '30'}`
                : ''}
            </Text>

            {/* 색상 선택 */}
            <Text style={styles.modalSubTitle}>색상 선택</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSlotDetailColor(c)}
                  style={[styles.colorDot, { backgroundColor: c }, slotDetailColor === c && styles.colorDotSelected]}
                />
              ))}
            </View>

            {/* 할 일 선택 */}
            <Text style={styles.modalSubTitle}>할 일 선택</Text>
            <View style={styles.modalListContainer}>
              <FlatList
                data={brainDumps}
                keyExtractor={(item) => item.dump_id}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalDumpItem, slotDetailDumpId === item.dump_id && styles.modalDumpItemSelected]}
                    onPress={() => setSlotDetailDumpId(item.dump_id)}
                  >
                    <Text style={styles.modalDumpPriority}>{item.priority_yn === 'Y' ? '★ ' : ''}</Text>
                    <Text style={[styles.modalDumpTitle, slotDetailDumpId === item.dump_id && styles.modalDumpTitleSelected]}>
                      {item.dump_title}
                    </Text>
                    {slotDetailDumpId === item.dump_id && <Text style={styles.modalDumpCheck}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* 버튼 */}
            <View style={styles.slotDetailActions}>
              <TouchableOpacity
                style={styles.slotDetailDeleteBtn}
                onPress={() => {
                  if (selectedSlotItem) handleDeleteTimeTable(selectedSlotItem);
                  setSlotDetailModalVisible(false);
                }}
              >
                <Text style={styles.slotDetailDeleteText}>배정 삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.slotDetailCloseBtn} onPress={handleSaveSlotDetail}>
                <Text style={styles.slotDetailCloseText}>저장</Text>
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
  dumpTitle: { fontSize: 15, color: '#1a1a2e' },
  dumpTitleDone: { textDecorationLine: 'line-through', color: '#aaa' },
  dumpContentPreview: { fontSize: 12, color: '#888', marginTop: 2 },
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    height: SCREEN_HEIGHT * 0.75,
    flexDirection: 'column',
  },
  modalListContainer: {
    flex: 1,
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
  modalList: { flex: 1 },
  modalDumpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalDumpPriority: { fontSize: 15, color: '#d97706', marginRight: 4 },
  modalDumpTitle: { fontSize: 15, color: '#1a1a2e', flex: 1 },
  modalDumpItemSelected: { backgroundColor: '#f5f3ff' },
  modalDumpTitleSelected: { color: '#4f46e5', fontWeight: '600' },
  modalDumpCheck: { fontSize: 15, color: '#4f46e5', fontWeight: '700' },

  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modalCancelText: { color: '#666', fontSize: 15 },

  // 헤더 액션 버튼
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

  // 상세 편집 모달
  detailModal: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  detailModalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 },
  detailLabel: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 4 },
  detailTitleInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#1a1a2e',
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
  },
  detailContentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1a1a2e',
    backgroundColor: '#f8f9fa',
    minHeight: 120,
    maxHeight: 200,
    marginBottom: 20,
  },
  timeAssignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  timeToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f0f0f0',
  },
  timeToggleBtnOn: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  timeToggleText: { fontSize: 13, fontWeight: '600', color: '#999' },
  timeToggleTextOn: { color: '#fff' },
  hourScroll: { marginBottom: 8 },
  hourBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    marginRight: 6,
  },
  hourBtnSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  hourBtnText: { fontSize: 13, color: '#444' },
  hourBtnTextSelected: { color: '#fff', fontWeight: '700' },
  minuteRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  minuteBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  minuteBtnSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  minuteBtnText: { fontSize: 14, color: '#444', fontWeight: '600' },
  minuteBtnTextSelected: { color: '#fff' },
  minuteBtnAssigned: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
    opacity: 0.6,
  },
  minuteBtnTextAssigned: { color: '#aaa' },
  minuteBtnAssignedLabel: { fontSize: 11, color: '#aaa', marginLeft: 4 },
  slotChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  slotChip: {
    backgroundColor: '#ede9fe',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  slotChipText: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  timePreview: {
    textAlign: 'center',
    fontSize: 13,
    color: '#4f46e5',
    fontWeight: '600',
    marginBottom: 8,
  },

  // 기존 배정 시간 표시
  existingSlotsSection: {
    marginBottom: 12,
  },
  existingSlotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  existingSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  existingSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  existingSlotDeleteText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '700',
  },

  // 배정된 슬롯 상세 모달
  slotDetailBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    height: SCREEN_HEIGHT * 0.75,
    flexDirection: 'column',
  },
  slotDetailColorBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  slotDetailTime: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  slotDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotDetailPriority: {
    fontSize: 18,
    color: '#d97706',
  },
  slotDetailTitle: {
    fontSize: 18,
    color: '#1a1a2e',
    fontWeight: '600',
    flex: 1,
  },
  slotDetailTitleDone: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  slotDetailBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 20,
  },
  slotDetailBadgeText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  slotDetailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  slotDetailDeleteBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  slotDetailDeleteText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  slotDetailCloseBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  slotDetailCloseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
