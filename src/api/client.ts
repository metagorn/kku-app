const ENV = (typeof process !== 'undefined' ? (process as any).env : undefined) || {} as any;
const ENV_BASE = ENV.EXPO_PUBLIC_API_BASE_URL || ENV.EXPO_PUBLIC_CIS_API_BASE_URL;
const ENV_KEY = ENV.EXPO_PUBLIC_API_KEY || ENV.EXPO_PUBLIC_CIS_API_KEY;
export const API_BASE_URL = ENV_BASE || 'https://cis.kku.ac.th/api/classroom';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface StatusItem {
  id: string | number;
  content: string;
  createdAt?: string;
  authorName?: string;
  likeCount?: number;
  isLiked?: boolean;
  comments?: CommentItem[];
  raw?: any;
}

export interface CommentItem {
  id: string | number;
  content: string;
  authorName?: string;
  createdAt?: string;
  raw?: any;
}
export interface MemberUser {
  id: string | number;
  name: string;
  email?: string;
  image?: string;
  raw?: any;
}
export interface ProfileData {
  _id?: string;
  firstname?: string;
  lastname?: string;
  name?: string;
  email?: string;
  image?: string;
}

function buildUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function fetchJson<T = any>(
  path: string,
  options: {
    method?: HttpMethod;
    token?: string | null;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', token, body, headers } = options;
  const fetchHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(headers || {}),
  };
  if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
  if (ENV_KEY && !fetchHeaders['x-api-key']) fetchHeaders['x-api-key'] = String(ENV_KEY);

  const res = await fetch(buildUrl(path), {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeParseJson(text) : undefined;

  if (!res.ok) {
    const message =
      (data && (data.message || data.error || data.msg)) ||
      `${res.status} ${res.statusText}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text } as any;
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ token: string; raw: any }> {
  const body = { email, password };
  const res: any = await fetchJson('/signin', { method: 'POST', body });
  const token = res?.data?.token || '';
  return { token, raw: res };
}

function fullName(u: any): string | undefined {
  if (!u) return undefined;
  if (u.name) return u.name;
  const f = u.firstname || u.firstName;
  const l = u.lastname || u.lastName;
  if (f || l) return [f, l].filter(Boolean).join(' ');
  if (typeof u.email === 'string' && u.email.includes('@')) return u.email.split('@')[0];
  return undefined;
}

function likeCountOf(obj: any): number {
  if (!obj) return 0;
  if (typeof obj.likeCount === 'number') return obj.likeCount;
  if (typeof obj.likesCount === 'number') return obj.likesCount;
  if (Array.isArray(obj.like)) return obj.like.length;
  if (typeof obj.like === 'number') return obj.like;
  if (Array.isArray(obj.likes)) return obj.likes.length;
  if (typeof obj.likes === 'number') return obj.likes;
  if (obj.reactions && typeof obj.reactions.like === 'number') return obj.reactions.like;
  return 0;
}

function isLikedByMe(obj: any): boolean {
  if (!obj) return false;
  if (typeof obj.hasLiked === 'boolean') return obj.hasLiked;
  if (typeof obj.isLiked === 'boolean') return obj.isLiked;
  if (typeof obj.liked === 'boolean') return obj.liked;
  return false;
}

function normalizeStatus(obj: any): StatusItem | null {
  if (!obj) return null;
  const id = obj._id ?? obj.id ?? obj.statusId ?? obj.status_id ?? obj.uuid;
  if (id == null) return null;
  const content = obj.content ?? obj.text ?? obj.message ?? obj.body ?? '';
  const createdAt = obj.createdAt ?? obj.created_at ?? obj.timestamp ?? undefined;
  const authorName = fullName(obj.createdBy) ?? fullName(obj.author) ?? obj.authorName;
  const likeCount = likeCountOf(obj);
  const isLiked = isLikedByMe(obj) || obj.viewer_has_liked || false;
  const comments = normalizeComments(obj.comment || obj.comments || obj.commentList || obj.replies || []);
  return { id, content, createdAt, authorName, likeCount, isLiked, comments, raw: obj };
}

function normalizeComments(list: any[]): CommentItem[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => {
      if (!c) return null;
      const id = c._id ?? c.id ?? c.commentId ?? c.comment_id ?? c.uuid;
      if (id == null) return null;
      const content = c.content ?? c.text ?? c.message ?? c.body ?? '';
      const createdAt = c.createdAt ?? c.created_at ?? c.timestamp ?? undefined;
      const authorName = fullName(c.createdBy) ?? fullName(c.author) ?? c.authorName ?? undefined;
      return { id, content, createdAt, authorName, raw: c } as CommentItem;
    })
    .filter(Boolean) as CommentItem[];
}

function extractList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.statuses)) return data.statuses;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function qs(params: Record<string, any>) {
  const esc = encodeURIComponent;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${esc(k)}=${esc(String(v))}`)
    .join('&');
  return query ? `?${query}` : '';
}

export interface PagedStatuses {
  items: StatusItem[];
  hasMore: boolean;
  nextPage?: number;
  nextCursor?: string | null;
  nextUrl?: string | null;
}

export async function fetchStatuses(
  token: string | null
): Promise<StatusItem[]> {
  const data: any = await fetchJson('/status', { method: 'GET', token });
  const list = extractList(data);
  return list.map((s) => normalizeStatus(s)).filter(Boolean) as StatusItem[];
}

export async function fetchStatusesPage(
  {
    token,
    page = 1,
    limit = 10,
    cursor,
  }: { token: string | null; page?: number; limit?: number; cursor?: string | null }
): Promise<PagedStatuses> {
  // Prefer page/limit, include cursor if provided. Server may ignore unknown params.
  const query = qs({ page, limit, cursor });
  const data: any = await fetchJson(`/status${query}`, { method: 'GET', token });
  const list = extractList(data);
  const items = list.map((s) => normalizeStatus(s)).filter(Boolean) as StatusItem[];

  // Heuristics to detect pagination info
  const meta = data?.meta || data?.pagination || data?.pageInfo || {};
  const nextUrl = data?.next ?? data?.links?.next ?? null;
  const nextCursor = data?.nextCursor ?? data?.cursor?.next ?? null;
  const totalPages = meta.totalPages ?? meta.total_pages ?? undefined;
  const hasMoreFromMeta =
    meta.hasMore ?? meta.has_more ?? (typeof totalPages === 'number' ? page < totalPages : undefined);

  const hasMore =
    (typeof hasMoreFromMeta === 'boolean' && hasMoreFromMeta) ||
    !!nextUrl ||
    !!nextCursor ||
    items.length === limit; // fallback heuristic

  const nextPage = hasMore ? page + 1 : undefined;
  return { items, hasMore, nextPage, nextCursor: nextCursor || null, nextUrl: nextUrl || null };
}

export async function fetchStatusById(id: string | number, token: string | null): Promise<StatusItem | null> {
  const res: any = await fetchJson(`/status/${id}`, { method: 'GET', token });
  const obj = res?.data ?? res;
  return normalizeStatus(obj);
}

export async function createStatus(content: string, token: string | null): Promise<StatusItem | null> {
  const body = { content };
  const res: any = await fetchJson('/status', { method: 'POST', token, body });
  const obj = res?.data ?? res;
  return normalizeStatus(obj);
}

export async function addComment(
  statusId: string | number,
  content: string,
  token: string | null
): Promise<StatusItem | null> {
  const body = { statusId: String(statusId), content };
  const res: any = await fetchJson('/comment', { method: 'POST', token, body });
  const obj = res?.data ?? res;
  return normalizeStatus(obj);
}

export async function removeComment(
  commentId: string | number,
  statusId: string | number,
  token: string | null
): Promise<StatusItem | null> {
  const body = { statusId: String(statusId) };
  const res: any = await fetchJson(`/comment/${commentId}`, { method: 'DELETE', token, body });
  const obj = res?.data ?? res;
  return normalizeStatus(obj);
}

export async function likeStatus(statusId: string | number, token: string | null): Promise<StatusItem | null> {
  const body = { statusId: String(statusId) };
  const res: any = await fetchJson('/like', { method: 'POST', token, body });
  const obj = res?.data ?? res;
  return normalizeStatus(obj);
}

export async function unlikeStatus(statusId: string | number, token: string | null): Promise<StatusItem | null> {
  const body = { statusId: String(statusId) };
  // Server supports DELETE /like for unlike behavior
  const res: any = await fetchJson('/like', { method: 'DELETE', token, body });
  const obj = res?.data ?? res;
  return normalizeStatus(obj);
}

function normalizeMember(obj: any): MemberUser | null {
  if (!obj) return null;
  const id = obj._id ?? obj.id ?? obj.userId ?? obj.uuid;
  const name = fullName(obj) ?? obj.username ?? obj.email ?? 'ไม่ระบุชื่อ';
  const email = obj.email ?? obj.contact?.email ?? undefined;
  const image = obj.image ?? obj.avatar ?? undefined;
  return { id, name, email, image, raw: obj } as MemberUser;
}

export async function fetchClassMembers(year: string | number, token: string | null): Promise<MemberUser[]> {
  const res: any = await fetchJson(`/class/${year}`, { method: 'GET', token });
  const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  return list.map((u: any) => normalizeMember(u)).filter(Boolean) as MemberUser[];
}

export async function fetchProfile(token: string | null): Promise<ProfileData | null> {
  try {
    const res: any = await fetchJson('/profile', { method: 'GET', token });
    return (res?.data ?? res) as ProfileData;
  } catch {
    return null;
  }
}

export async function deleteStatus(id: string | number, token: string | null): Promise<boolean> {
  try {
    await fetchJson(`/status/${id}`, { method: 'DELETE', token });
    return true;
  } catch {
    return false;
  }
}
