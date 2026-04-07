import * as FileSystem from 'expo-file-system/legacy';
import { createUser, insertSeed, getBackupPath, saveBrainDump, saveTimeTable } from './localDb';

const BASE_URL = 'http://localhost:8080/api';

// 휴대폰과 PC 연결 시 필요(USB 디버깅 + 테더링도 해야됨)
// adb reverse tcp:8080 tcp:8080
// 휴대폰에서 개발자 모드 실행 시 필요
// adb shell input keyevent 82

export type SyncResult = {
  success: boolean;
  count?: number;
  error?: string;
};

/**
 * 서버에서 유저 + 메모 데이터를 받아와 로컬 SQLite에 저장
 * 온라인 상태일 때 수동으로 호출 (버튼 등)
 */
export async function fetchAndSeedFromServer(
  userId: string,
  userPwd: string
): Promise<SyncResult> {
  try {
    // 1. 로그인 확인
    const loginRes = await fetch(
      `${BASE_URL}/user/loginUser?userId=${encodeURIComponent(userId)}&userPwd=${encodeURIComponent(userPwd)}`
    );
    if (!loginRes.ok) throw new Error('서버 로그인 실패');

    const loginData: any[] = await loginRes.json();
    if (!loginData || loginData.length === 0) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    const user = loginData[0];

    // tb_user에 저장
    await createUser(
      user.userId,
      userPwd,
      user.userName ?? '',
      user.email ?? '',
      user.address ?? ''
    );
    // 2. 메모 전체 목록 가져오기 (2020-01-01 ~ 오늘)
    const today = new Date().toISOString().slice(0, 10);
    const memoRes = await fetch(
      `${BASE_URL}/memo/selectMemoList?userId=${encodeURIComponent(userId)}&startDate=2020-01-01&endDate=${today}`
    );
    if (!memoRes.ok) throw new Error('메모 데이터 수신 실패');

    const memos: any[] = await memoRes.json();


    // 3. backup.json으로 저장 (앱 재설치 후 오프라인 복원용)
    const backup = {
      users: [{
        user_id: user.userId,
        user_pwd: userPwd,
        user_name: user.userName ?? '',
        email: user.email ?? '',
        address: user.address ?? '',
        adm_yn: user.admYn ?? 'N',
      }],
      memos: memos.map(m => ({
        memo_id: m.memoId,
        user_id: m.userId,
        reg_date: m.regDate,
        title: m.title,
        memo_content: m.memoContent ?? '',
      })),
    };

    await FileSystem.writeAsStringAsync(getBackupPath(), JSON.stringify(backup));

    // 4. SQLite에 삽입
    await insertSeed(backup);

    return { success: true, count: memos.length };
  } catch (e: any) {
    return { success: false, error: e.message ?? '알 수 없는 오류' };
  }
}

/**
 * 서버에서 타임박스(Brain Dump + Time Table) 데이터를 받아와 로컬 SQLite에 저장
 */
export async function fetchAndSeedTimeBoxFromServer(
  userId: string,
  userPwd: string
): Promise<SyncResult> {
  try {
    // 1. 로그인 확인
    const loginRes = await fetch(
      `${BASE_URL}/user/loginUser?userId=${encodeURIComponent(userId)}&userPwd=${encodeURIComponent(userPwd)}`
    );
    if (!loginRes.ok) throw new Error('서버 로그인 실패');

    const loginData: any[] = await loginRes.json();
    if (!loginData || loginData.length === 0) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');

    // 2. 전체 Brain Dump 조회 (tboxDate 없이 → 전체 날짜)
    const dumpRes = await fetch(
      `${BASE_URL}/timebox/selectBrainDumpList?userId=${encodeURIComponent(userId)}`
    );
    if (!dumpRes.ok) throw new Error('Brain Dump 데이터 수신 실패');
    const dumps: any[] = await dumpRes.json();

    // 3. Brain Dump가 존재하는 고유 날짜 목록 추출
    const uniqueDates = [...new Set(dumps.map((d: any) => d.tboxDate).filter(Boolean))];

    // 4. 각 날짜별 Time Table 조회
    const allTimeTables: any[] = [];
    for (const date of uniqueDates) {
      const ttRes = await fetch(
        `${BASE_URL}/timebox/selectTimeTableList?userId=${encodeURIComponent(userId)}&tboxDate=${encodeURIComponent(date)}`
      );
      if (ttRes.ok) {
        const tts: any[] = await ttRes.json();
        allTimeTables.push(...tts);
      }
    }

    // 5. Brain Dump SQLite 저장 (synced = 1)
    for (const dump of dumps) {
      await saveBrainDump(
        dump.dumpId,
        userId,
        dump.tboxDate,
        dump.dumpTitle,
        dump.dumpContent ?? '',
        dump.priorityYn ?? 'N',
        dump.status ?? '0',
        1
      );
    }

    // 6. Time Table SQLite 저장
    for (const tt of allTimeTables) {
      await saveTimeTable(
        tt.timeTableId,
        tt.dumpId,
        tt.tboxDate,
        userId,
        tt.timeHour,
        tt.timeMinute,
        tt.color ?? '#4f46e5',
        "1"
      );
    }

    return { success: true, count: dumps.length };
  } catch (e: any) {
    return { success: false, error: e.message ?? '알 수 없는 오류' };
  }
}
