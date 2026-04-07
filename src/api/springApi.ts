// Spring Boot 백업/동기화 API
// 집 Wi-Fi에서 수동으로 백업할 때 사용

const BASE_URL = 'http://localhost:8080/api';

let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

export async function loginToServer(userId: string, password: string) {
  const res = await fetch(`${BASE_URL}/user/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ userId, password }),
  });
  if (!res.ok) throw new Error('서버 로그인 실패');
  return res.json();
}

export async function uploadMemo(memo: {
  title: string;
  userId: string;
  memoContent: string;
  regDate: string;
}) {
  const res = await fetch(`${BASE_URL}/memo/saveMemo`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(memo),
  });
  if (!res.ok) throw new Error('메모 업로드 실패');
  return res.json() as Promise<{ id: number }>;
}

export async function fetchServerMemos() {
  const res = await fetch(`${BASE_URL}/memo`, { headers: headers() });
  if (!res.ok) throw new Error('서버 메모 조회 실패');
  return res.json();
}

export async function uploadTimeTable(item: {
  timeTableId: string;
  dumpId: string;
  tboxDate: string;
  userId: string;
  timeHour: number;
  timeMinute: number;
  color: string;
}) {
  const res = await fetch(`${BASE_URL}/timebox/saveTimeTable`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('TimeTable 업로드 실패');
  return res.json();
}

export async function uploadBrainDump(dump: {
  dumpId: string;
  userId: string;
  tboxDate: string;
  dumpTitle: string;
  dumpContent: string;
  priorityYn: string;
  completeYn: string;
  status: string;
}) {
  const res = await fetch(`${BASE_URL}/timebox/saveBrainDump`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(dump),
  });
  if (!res.ok) throw new Error('Brain Dump 업로드 실패');
  return res.json();
}
