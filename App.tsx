import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  useWindowDimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  addComment,
  createStatus,
  fetchStatusById,
  fetchStatuses,
  likeStatus,
  fetchProfile,
  fetchClassMembers,
  signIn,
  unlikeStatus,
  removeComment,
  deleteStatus,
  type StatusItem,
} from './src/api/client';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<'feed' | 'members'>('feed');

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const saved = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') : null;
          if (saved) setToken(saved);
        } else {
          const saved = await SecureStore.getItemAsync('auth_token');
          if (saved) setToken(saved);
        }
      } catch {}
      finally {
        setBooting(false);
      }
    })();
  }, []);

  const handleSignedIn = useCallback(async (t: string) => {
    setToken(t);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage?.setItem('auth_token', t);
      } else {
        await SecureStore.setItemAsync('auth_token', t);
      }
    } catch {}
  }, []);

  const handleSignOut = useCallback(async () => {
    setToken(null);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage?.removeItem('auth_token');
      } else {
        await SecureStore.deleteItemAsync('auth_token');
      }
    } catch {}
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {booting ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : token ? (
        screen === 'feed' ? (
          <FeedScreen token={token} onSignOut={handleSignOut} onOpenMembers={() => setScreen('members')} />
        ) : (
          <MembersScreen token={token} onBack={() => setScreen('feed')} />
        )
      ) : (
        <SignInScreen onSignedIn={handleSignedIn} />
      )}
    </SafeAreaView>
  );
}

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    let json = '';
    // Prefer atob when available (web/Expo)
    // Fallback to Buffer on Node-like envs
    if (typeof atob === 'function') {
      const ascii = atob(b64);
      // JWT payloads are ASCII-safe; parse directly
      json = ascii;
    } else if (typeof Buffer !== 'undefined') {
      // @ts-ignore
      json = Buffer.from(b64, 'base64').toString('utf8');
    } else {
      return null;
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getAuthorName(item: StatusItem): string {
  const createdBy: any = (item as any).raw?.createdBy;
  const author = item.authorName;
  const name = author || (createdBy?.name as string | undefined);
  const first = createdBy?.firstname || createdBy?.firstName;
  const last = createdBy?.lastname || createdBy?.lastName;
  const combined = [first, last].filter(Boolean).join(' ');
  const email = createdBy?.email as string | undefined;
  const emailName = email && email.includes('@') ? email.split('@')[0] : undefined;
  return (name || combined || emailName || 'ไม่ระบุผู้เขียน') as string;
}

function SignInScreen({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!email || !password) {
      Alert.alert('กรอกข้อมูลให้ครบ', 'โปรดกรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const res = await signIn(email.trim(), password);
      if (!res.token) {
        Alert.alert('เข้าสู่ระบบไม่สำเร็จ', 'ระบบไม่ส่ง Token กลับมา');
        return;
      }
      onSignedIn(res.token);
    } catch (e: any) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', e?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [email, password, onSignedIn]);

  return (
    <View style={styles.signInScreen}>
      <View style={styles.brandWrap}>
        <View style={styles.brandLogo}><Text style={styles.brandLogoText}>KK</Text></View>
        <Text style={styles.brandTitle}>KKU CIS</Text>
        <Text style={styles.brandSubtitle}>Classroom Portal</Text>
      </View>

      <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>เข้าสู่ระบบ</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>ใช้บัญชีที่ได้รับอนุญาตจากระบบเท่านั้น</Text>
      </View>
    </View>
  );
}

function FeedScreen({ token, onSignOut, onOpenMembers }: { token: string; onSignOut: () => void; onOpenMembers: () => void }) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string | number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string | number, string>>({});
  const [visibleCount, setVisibleCount] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myUserId, setMyUserId] = useState<string | undefined>(undefined);
  const [myEmail, setMyEmail] = useState<string | undefined>(undefined);
  const [likePending, setLikePending] = useState<Record<string | number, boolean>>({});
  const { width } = useWindowDimensions();
  const contentMaxWidth = useMemo(() => (width >= 900 ? 800 : width >= 600 ? 680 : undefined), [width]);
  const headerInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0;

  const load = useCallback(async () => {
    try {
      const list = await fetchStatuses(token);
      const sorted = [...list].sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
      setStatuses(withLikeState(sorted, myUserId));
      setVisibleCount(10);
    } catch (e: any) {
      Alert.alert('โหลดฟีดไม่สำเร็จ', e?.message || 'เกิดข้อผิดพลาด');
    }
  }, [token, myUserId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    // Decode JWT early to know current user before profile returns
    const payload = decodeJwt(token);
    if (payload) {
      const uid = (payload.id || payload.sub || payload._id) as string | undefined;
      const email = (payload.email as string | undefined) || undefined;
      if (uid) setMyUserId(uid);
      if (email) setMyEmail(email);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      const profile = await fetchProfile(token);
      const uid = (profile?._id as string | undefined) || undefined;
      setMyUserId(uid);
      setMyEmail((profile?.email as string | undefined) || undefined);
    })();
  }, [token]);

  useEffect(() => {
    // recompute like state when myUserId becomes available
    setStatuses((prev) => withLikeState(prev, myUserId, myEmail));
  }, [myUserId, myEmail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loadingMore) return;
    if (visibleCount >= statuses.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((v) => Math.min(v + 10, statuses.length));
      setLoadingMore(false);
    }, 150);
  }, [loadingMore, visibleCount, statuses.length]);

  // Backfill comment author names after any status update
  useEffect(() => {
    setStatuses((prev) => {
      let changed = false;
      const next = prev.map((st) => {
        const comments = st.comments;
        if (!Array.isArray(comments) || comments.length === 0) return st;
        const rawMap = buildRawCommentMap(st as any);
        const fixed = comments.map((c) => {
          if (!c || (c.authorName && c.authorName !== 'ผู้ใช้')) return c;
          const createdBy = (c as any)?.raw?.createdBy || rawMap.get(String((c as any)?.id))?.createdBy;
          const name = nameFromUser(createdBy);
          if (name) { changed = true; return { ...c, authorName: name } as any; }
          return c;
        });
        if (changed) return { ...st, comments: fixed } as StatusItem;
        return st;
      });
      return changed ? next : prev;
    });
  }, [statuses]);

  const postStatus = useCallback(async () => {
    const trimmed = composer.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      const created = await createStatus(trimmed, token);
      if (created) setStatuses((prev) => [created, ...prev]);
      setComposer('');
    } catch (e: any) {
      Alert.alert('โพสต์ไม่สำเร็จ', e?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setPosting(false);
    }
  }, [composer, token]);

  const toggleLike = useCallback(
    async (s: StatusItem) => {
      if (likePending[s.id]) return;
      setLikePending((m) => ({ ...m, [s.id]: true }));
      // keep scroll position; avoid full feed reload here
      const optimistic: any = { ...s, raw: { ...(s as any).raw } };
      const likeArr: any[] = Array.isArray(optimistic.raw?.like) ? [...optimistic.raw.like] : [];
      if (s.isLiked) {
        optimistic.isLiked = false;
        optimistic.likeCount = Math.max(0, (s.likeCount || 0) - 1);
        // optimistic remove from like array by id/email
        const myId = myUserId ? String(myUserId) : undefined;
        const myEm = myEmail;
        const filtered = likeArr.filter((u) => {
          const uid = String((u as any)._id ?? (u as any).id ?? '');
          const email = (u as any).email as string | undefined;
          return (myId && uid === myId) || (myEm && email && email === myEm) ? false : true;
        });
        optimistic.raw.like = filtered;
        setStatuses((prev) => prev.map((x) => (x.id === s.id ? optimistic : x)));
        try {
          const updated = await unlikeStatus(s.id, token);
          if (updated) {
            const final = withLikeState([updated], myUserId, myEmail)[0];
            if (!myUserId && !myEmail) { final.isLiked = false; }
            setStatuses((prev) => prev.map((x) => (x.id === s.id ? final : x)));
          } else {
            const fresh = await fetchStatusById(s.id, token);
            if (fresh) {
              const final = withLikeState([fresh], myUserId, myEmail)[0];
              if (!myUserId && !myEmail) { final.isLiked = false; }
              setStatuses((prev) => prev.map((x) => (x.id === s.id ? final : x)));
            }
          }
        } catch (e: any) {
          // revert on error
          setStatuses((prev) => prev.map((x) => (x.id === s.id ? s : x)));
          Alert.alert('ยกเลิกถูกใจไม่สำเร็จ', e?.message || '');
        } finally { setLikePending((m) => ({ ...m, [s.id]: false })); }
      } else {
        optimistic.isLiked = true;
        optimistic.likeCount = (s.likeCount || 0) + 1;
        // optimistic add into like array (prefer string id to match server shape)
        const entry: any = myUserId ? String(myUserId) : (myEmail ? { email: myEmail } : { _id: myUserId });
        optimistic.raw.like = [...likeArr, entry];
        setStatuses((prev) => prev.map((x) => (x.id === s.id ? optimistic : x)));
        try {
          const updated = await likeStatus(s.id, token);
          if (updated) {
            const final = withLikeState([updated], myUserId, myEmail)[0];
            if (!myUserId && !myEmail) { final.isLiked = true; }
            setStatuses((prev) => prev.map((x) => (x.id === s.id ? final : x)));
          } else {
            const fresh = await fetchStatusById(s.id, token);
            if (fresh) {
              const final = withLikeState([fresh], myUserId, myEmail)[0];
              if (!myUserId && !myEmail) { final.isLiked = true; }
              setStatuses((prev) => prev.map((x) => (x.id === s.id ? final : x)));
            }
          }
        } catch (e: any) {
          // revert on error
          setStatuses((prev) => prev.map((x) => (x.id === s.id ? s : x)));
          Alert.alert('กดถูกใจไม่สำเร็จ', e?.message || '');
        } finally { setLikePending((m) => ({ ...m, [s.id]: false })); }
      }
    },
    [token, myUserId, myEmail, likePending]
  );

  const ensureDetailsLoaded = useCallback(
    async (s: StatusItem) => {
      // Always refresh details; preserve optimistic like state
      try {
        const full = await fetchStatusById(s.id, token);
        if (full) {
          setStatuses((prev) =>
            prev.map((x) => {
              if (x.id !== s.id) return x;
              const mergedRaw: any = { ...(x as any).raw, ...(full as any).raw };
              const prevLikes: any[] | undefined = (x as any).raw?.like;
              const newLikes: any[] | undefined = (full as any).raw?.like;
              const mergedLikes = mergeLikeArrays(prevLikes, newLikes, myUserId, myEmail, !!x.isLiked);
              if (mergedLikes) mergedRaw.like = mergedLikes;
              const merged = { ...x, ...full, raw: mergedRaw } as StatusItem;
              const final = withLikeState([merged], myUserId, myEmail)[0];
              // If still unknown who I am, preserve optimistic isLiked
              if (!myUserId && !myEmail) final.isLiked = x.isLiked;
              return final;
            })
          );
        }
      } catch {}
    },
    [token, myUserId, myEmail]
  );

  const submitComment = useCallback(
    async (s: StatusItem) => {
      const text = (commentInputs[s.id] || '').trim();
      if (!text) return;
      try {
        const updated = await addComment(s.id, text, token);
        if (updated) {
          const final = withLikeState([updated], myUserId, myEmail)[0];
          setStatuses((prev) => prev.map((x) => (x.id === s.id ? final : x)));
        }
        setCommentInputs((m) => ({ ...m, [s.id]: '' }));
      } catch (e: any) {
        Alert.alert('คอมเมนต์ไม่สำเร็จ', e?.message || 'เกิดข้อผิดพลาด');
      }
    },
    [commentInputs, token, myUserId, myEmail]
  );

  const isMyComment = useCallback((c: any) => {
    try {
      const createdBy: any = (c as any)?.raw?.createdBy;
      if (!createdBy) return false;
      if (typeof createdBy === 'string') {
        return !!myUserId && String(createdBy) === String(myUserId);
      }
      if (typeof createdBy === 'object') {
        const idVal = createdBy._id ?? createdBy.id ?? createdBy.userId;
        if (myUserId && idVal != null && String(idVal) === String(myUserId)) return true;
        const email = createdBy.email as string | undefined;
        if (myEmail && email && email === myEmail) return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [myUserId, myEmail]);

  const renderItem = useCallback(
    ({ item }: { item: StatusItem }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            {item.raw?.createdBy?.image ? (
              <Image source={{ uri: String(item.raw.createdBy.image) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#6b7280', fontWeight: '700' }}>{(getAuthorName(item).slice(0, 1) || '?').toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.author} numberOfLines={1}>{getAuthorName(item)}</Text>
              {!!item.createdAt && <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>}
            </View>
          </View>
          {myUserId && item.raw?.createdBy?._id && String(item.raw.createdBy._id) === String(myUserId) && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert('ลบโพสต์', 'ต้องการลบโพสต์นี้หรือไม่?', [
                  { text: 'ยกเลิก', style: 'cancel' },
                  {
                    text: 'ลบ', style: 'destructive', onPress: async () => {
                      const ok = await deleteStatus(item.id, token);
                      if (ok) setStatuses((prev) => prev.filter((x) => x.id !== item.id));
                      else Alert.alert('ลบโพสต์ไม่สำเร็จ');
                    }
                  }
                ]);
              }}
              style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
            >
              <Text style={[styles.actionText, { color: '#ef4444' }]}>ลบโพสต์</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.content}>{item.content}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => toggleLike(item)} style={styles.actionBtn} disabled={!!likePending[item.id]}>
            <Text style={[styles.actionText, item.isLiked && styles.liked]}>{likePending[item.id] ? '...' : (item.isLiked ? 'Unlike' : 'Like')}</Text>
          </TouchableOpacity>
          <Text style={styles.meta}>{likeCountDisplay(item)} likes • {(item.comments?.length ?? 0).toString()} comments</Text>
          <TouchableOpacity
            onPress={async () => {
              setExpanded((m) => ({ ...m, [item.id]: !m[item.id] }));
              if (!expanded[item.id]) await ensureDetailsLoaded(item);
            }}
            style={[styles.actionBtn, { marginLeft: 'auto' }]}
          >
            <Text style={styles.actionText}>💬 ความคิดเห็น</Text>
          </TouchableOpacity>
        </View>
        {expanded[item.id] && (
          <View style={styles.commentsWrap}>
            <View style={styles.commentComposer}>
              <TextInput
                style={styles.commentInput}
                placeholder="เขียนคอมเมนต์..."
                value={commentInputs[item.id] || ''}
                onChangeText={(t) => setCommentInputs((m) => ({ ...m, [item.id]: t }))}
                multiline
              />
              <TouchableOpacity style={styles.commentSend} onPress={() => submitComment(item)}>
                <Text style={styles.commentSendText}>ส่ง</Text>
              </TouchableOpacity>
            </View>
            {(item.comments || []).map((c) => (
              <View key={String(c.id)} style={styles.comment}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.commentAuthor}>{getCommentAuthorName(c, item)}</Text>
                  {isMyComment(c) && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('ลบคอมเมนต์', 'ต้องการลบคอมเมนต์นี้หรือไม่?', [
                        { text: 'ยกเลิก', style: 'cancel' },
                        {
                          text: 'ลบ', style: 'destructive', onPress: async () => {
                            const updated = await removeComment(c.id, item.id, token);
                            if (updated) {
                              const final = withLikeState([updated], myUserId)[0];
                              setStatuses((prev) => prev.map((x) => (x.id === item.id ? final : x)));
                            } else {
                              Alert.alert('ลบไม่สำเร็จ');
                            }
                          }
                        }
                      ]);
                    }}
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '600' }}>ลบ</Text>
                  </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    ),
    [expanded, toggleLike, ensureDetailsLoaded, commentInputs, submitComment]
  );

  const keyExtractor = useCallback((item: StatusItem) => String(item.id), []);

  return (
    <View style={styles.feedWrap}>
      <View style={[styles.feedHeader, { paddingTop: headerInset + 8 }]}>
        <Text style={styles.appTitle}>ฟีดสถานะ</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={onSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>ออกจากระบบ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenMembers} style={styles.membersBtn}>
            <Text style={styles.membersBtnText}>สมาชิกชั้นปี</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.composerWrap, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <TextInput
          style={styles.composerInput}
          placeholder="กำลังคิดอะไรอยู่..."
          value={composer}
          onChangeText={setComposer}
          multiline
        />
        <TouchableOpacity
          style={[styles.postButton, (!composer.trim() || posting) && styles.buttonDisabled]}
          onPress={postStatus}
          disabled={!composer.trim() || posting}
        >
          {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>โพสต์</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={statuses.slice(0, visibleCount)}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContent, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : (visibleCount < statuses.length ? <View style={{ height: 16 }} /> : null)}
          ListEmptyComponent={<Text style={styles.meta}>ยังไม่มีสถานะ</Text>}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
}


function likeCountDisplay(item: StatusItem) {
  const arr: any[] | undefined = (item as any).raw?.like;
  if (Array.isArray(arr)) return arr.length;
  return item.likeCount ?? 0;
}

function nameFromUser(u: any): string | undefined {
  try {
    if (!u) return undefined;
    if (typeof u === 'string') return undefined;
    if (u.username) return String(u.username);
    if (u.name) return String(u.name);
    if (u.displayName) return String(u.displayName);
    const f = u.firstname || u.firstName;
    const l = u.lastname || u.lastName;
    if (f || l) return [f, l].filter(Boolean).join(' ');
    if (typeof u.email === 'string' && u.email.includes('@')) return u.email.split('@')[0];
    return undefined;
  } catch { return undefined; }
}

function buildRawCommentMap(status: any): Map<string, any> {
  const out = new Map<string, any>();
  const list = status?.raw?.comment || status?.raw?.comments || [];
  if (Array.isArray(list)) {
    for (const c of list) {
      const id = c?._id ?? c?.id ?? c?.commentId ?? c?.uuid;
      if (id != null) out.set(String(id), c);
    }
  }
  return out;
}

// Fill missing authorName in comments from raw.createdBy without mutating server data
function mergeComments(prev?: any[], next?: any[]): any[] | undefined {
  if (!Array.isArray(next)) return prev;
  if (!Array.isArray(prev)) return next;
  const prevMap = new Map<string, any>();
  for (const p of prev) { if (p?.id != null) prevMap.set(String(p.id), p); }
  return next.map((c) => {
    if (!c) return c;
    if (c.authorName && c.authorName !== 'ผู้ใช้') return c;
    const createdBy = (c as any)?.raw?.createdBy;
    let name = nameFromUser(createdBy);
    if (!name) {
      const prevC = prevMap.get(String((c as any)?.id));
      const rawCb = (prevC as any)?.raw?.createdBy;
      name = nameFromUser(rawCb) || prevC?.authorName;
    }
    return name ? ({ ...c, authorName: name }) : c;
  });
}

function getCommentAuthorName(c: any, status: any): string {
  const direct = c?.authorName;
  if (direct && direct !== 'ผู้ใช้') return String(direct);
  const fromRaw = nameFromUser(c?.raw?.createdBy);
  if (fromRaw) return fromRaw;
  // try lookup in status raw comments by id
  const rawList = (status as any)?.raw?.comment || (status as any)?.raw?.comments || [];
  if (Array.isArray(rawList)) {
    const raw = rawList.find((rc: any) => String(rc?._id ?? rc?.id ?? rc?.commentId ?? rc?.uuid) === String(c?.id));
    const via = nameFromUser(raw?.createdBy);
    if (via) return via;
  }
  return 'ผู้ใช้';
}

function mergeLikeArrays(prevLikes?: any[], newLikes?: any[], myUserId?: string, myEmail?: string, shouldHaveMe?: boolean) {
  const a: any[] = Array.isArray(prevLikes) ? [...prevLikes] : [];
  const b: any[] = Array.isArray(newLikes) ? [...newLikes] : [];
  // base from server if present, else from prev
  let base: any[] = b.length ? b : a;
  base = dedupeLikes(base);
  if (shouldHaveMe) {
    const exists = hasMe(base, myUserId, myEmail);
    if (!exists) {
      const entry: any = myUserId ? String(myUserId) : (myEmail ? { email: myEmail } : null);
      if (entry) base = [...base, entry];
    }
  }
  return dedupeLikes(base);
}

function hasMe(likeArr: any[], myUserId?: string, myEmail?: string) {
  if (!Array.isArray(likeArr)) return false;
  return likeArr.some((u) => {
    if (typeof u === 'string') return !!myUserId && u === String(myUserId);
    const uid = u?._id ?? u?.id ?? u?.userId;
    const email = u?.email as string | undefined;
    if (myUserId && uid != null && String(uid) === String(myUserId)) return true;
    if (myEmail && email && email === myEmail) return true;
    return false;
  });
}

function dedupeLikes(likeArr: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const u of likeArr || []) {
    let key = '';
    if (typeof u === 'string') key = `id:${u}`;
    else {
      const uid = u?._id ?? u?.id ?? u?.userId;
      const email = u?.email as string | undefined;
      key = uid != null ? `id:${String(uid)}` : email ? `email:${email}` : `raw:${JSON.stringify(u)}`;
    }
    if (!seen.has(key)) {
      seen.add(key);
      out.push(u);
    }
  }
  return out;
}

function withLikeState(items: StatusItem[], myUserId?: string, myEmail?: string) {
  return items.map((s) => {
    const likeArr: any[] | undefined = (s as any).raw?.like;
    const likeCount = Array.isArray(likeArr) ? likeArr.length : (s.likeCount ?? 0);
    // Preserve current isLiked unless we positively know who I am
    let isLiked = s.isLiked ?? false;
    if (Array.isArray(likeArr) && (myUserId || myEmail)) {
      isLiked = likeArr.some((u) => {
        if (typeof u === 'string') {
          return myUserId ? u === String(myUserId) : false;
        }
        const uidVal = (u as any)?._id ?? (u as any)?.id ?? (u as any)?.userId;
        const uid = uidVal == null ? '' : String(uidVal);
        const email = (u as any)?.email as string | undefined;
        return (myUserId && uid === String(myUserId)) || (myEmail && email && email === myEmail);
      });
    }
    return { ...s, likeCount, isLiked } as StatusItem;
  });
}

function MembersScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const contentMaxWidth = useMemo(() => (width >= 900 ? 800 : width >= 600 ? 680 : undefined), [width]);
  const headerInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0;
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchProfile(token);
        const y = (profile as any)?.education?.enrollmentYear as string | undefined;
        if (y) setYear(String(y));
      } catch {}
    })();
  }, [token]);

  const load = useCallback(async () => {
    if (!year.trim()) return;
    setLoading(true);
    try {
      const list = await fetchClassMembers(year.trim(), token);
      setMembers(list);
    } catch (e: any) {
      Alert.alert('ดึงข้อมูลไม่สำเร็จ', e?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [year, token]);

  useEffect(() => {
    // auto-load when year is filled from profile
    if (year) { load(); }
  }, [year, load]);

  const keyExtractor = useCallback((it: any) => String(it.id), []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={styles.memberItem}>
      {item.image ? (
        <Image source={{ uri: String(item.image) }} style={styles.memberAvatar} />
      ) : (
        <View style={[styles.memberAvatar, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#6b7280', fontWeight: '700' }}>{(item.name || '?').slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{item.name}</Text>
        {!!item.email && <Text style={styles.memberEmail}>{item.email}</Text>}
      </View>
    </View>
  ), []);

  return (
    <View style={styles.feedWrap}>
      <View style={[styles.feedHeader, { paddingTop: headerInset + 8 }]}>
        <Text style={styles.appTitle}>สมาชิกชั้นปี</Text>
        <TouchableOpacity onPress={onBack} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.composerWrap, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}> 
        <TextInput
          style={styles.input}
          placeholder="ปีที่ศึกษา (เช่น 2566)"
          keyboardType="number-pad"
          value={year}
          onChangeText={setYear}
        />
        <TouchableOpacity onPress={load} style={[styles.postButton, { marginTop: 8 }]} disabled={!year.trim() || loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ค้นหา</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
          ListEmptyComponent={<Text style={styles.meta}>ไม่พบสมาชิก</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  signInWrap: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 12,
  },
  signInScreen: { flex: 1, padding: 16, backgroundColor: '#f8fafc', justifyContent: 'center' },
  brandWrap: { alignItems: 'center', marginBottom: 16 },
  brandLogo: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  brandLogoText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  brandTitle: { marginTop: 8, fontSize: 28, fontWeight: '900', color: '#0f172a' },
  brandSubtitle: { marginTop: 2, color: '#64748b' },
  loginCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#eef2f7', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  loginTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  signInTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  hint: {
    color: '#666',
    fontSize: 12,
  },
  feedWrap: {
    flex: 1,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  signOutText: {
    color: '#fff',
    fontWeight: '600',
  },
  membersBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#10b981',
  },
  membersBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  composerWrap: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  composerInput: {
    minHeight: 56,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  postButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  author: {
    fontWeight: '700',
    color: '#111',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  meta: {
    color: '#666',
    fontSize: 12,
  },
  content: {
    fontSize: 16,
    color: '#111',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  actionText: { color: '#0f172a', fontWeight: '700' },
  liked: {
    color: '#1877f2',
  },
  commentsWrap: {
    marginTop: 8,
    gap: 8,
  },
  commentComposer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  commentSend: {
    backgroundColor: '#1877f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  commentSendText: {
    color: '#fff',
    fontWeight: '700',
  },
  comment: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  commentAuthor: {
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  commentText: {
    color: '#111',
  },
  countText: { color: '#64748b', marginLeft: 8 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22 },
  memberName: { fontWeight: '700', color: '#0f172a' },
  memberEmail: { color: '#64748b', fontSize: 12 },
});





