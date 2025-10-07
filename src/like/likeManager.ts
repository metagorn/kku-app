import type { StatusItem } from '../api/client';

export interface Me {
  id?: string;
  email?: string;
}

function cloneRawLike(status: StatusItem): any[] {
  const arr: any[] | undefined = (status as any).raw?.like;
  return Array.isArray(arr) ? arr.map((x) => ({ ...x })) : [];
}

export function deriveLikeState(status: StatusItem, me?: Me) {
  const likeArr = cloneRawLike(status);
  const likeCount = likeArr.length;
  const isLiked = likeArr.some((u) => matchesMe(u, me));
  return { likeCount, isLiked };
}

export function reconcileStatus(status: StatusItem, me?: Me): StatusItem {
  const { likeCount, isLiked } = deriveLikeState(status, me);
  return { ...status, likeCount, isLiked };
}

export function reconcileList(items: StatusItem[], me?: Me): StatusItem[] {
  return items.map((s) => reconcileStatus(s, me));
}

export function optimisticLike(status: StatusItem, me?: Me): StatusItem {
  const likeArr = cloneRawLike(status);
  if (me && !likeArr.some((u) => matchesMe(u, me))) {
    likeArr.push({ _id: me.id, email: me.email });
  }
  const next = attachRawLike(status, likeArr);
  return reconcileStatus(next, me);
}

export function optimisticUnlike(status: StatusItem, me?: Me): StatusItem {
  const likeArr = cloneRawLike(status).filter((u) => !matchesMe(u, me));
  const next = attachRawLike(status, likeArr);
  return reconcileStatus(next, me);
}

function attachRawLike(status: StatusItem, likeArr: any[]): StatusItem {
  const raw = { ...(status as any).raw, like: likeArr };
  return { ...status, raw } as StatusItem;
}

function matchesMe(user: any, me?: Me): boolean {
  if (!me) return false;
  const uid = String(user?._id ?? user?.id ?? '');
  const email = (user?.email as string | undefined) || undefined;
  if (me.id && uid && String(me.id) === uid) return true;
  if (me.email && email && me.email === email) return true;
  return false;
}

