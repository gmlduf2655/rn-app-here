import * as FileSystem from 'expo-file-system/legacy';
import { createUser, insertSeed, getBackupPath } from './localDb';

const BASE_URL = 'http://119.71.193.203:8080/api'; // 실제 서버 IP로 변경

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
