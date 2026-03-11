// Spring Boot 백업/동기화 API
// 집 Wi-Fi에서 수동으로 백업할 때 사용

const BASE_URL = 'http://192.168.0.1:8080/api'; // TODO: 실제 서버 IP로 변경

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
  content: string;
  createdAt: string;
}) {
  const res = await fetch(`${BASE_URL}/memo`, {
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
