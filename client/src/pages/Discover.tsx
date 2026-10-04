import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../lib/api';
import { RoomCard } from '../components/RoomCard';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { useCreateRoom } from '../components/CreateRoom';
import { Icon } from '../components/ui/Icon';
import type { RoomCardData } from '../lib/types';

const FILTERS = [['all', 'All'], ['live', 'Live now'], ['playing', 'Playing']] as const;
const PAGE = 12;

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const filter = (params.get('filter') as 'all' | 'live' | 'playing') || 'all';
  const sort = (params.get('sort') as 'active' | 'new') || 'active';
  const openCreate = useCreateRoom();

  const [items, setItems] = useState<RoomCardData[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => { document.title = 'Discover · MovieFlex Watch Party'; }, []);

  const load = useCallback(async (offset: number) => {
    const my = ++seq.current;
    offset ? setMore(true) : setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ filter, sort, limit: String(PAGE), offset: String(offset) });
      if (q) qs.set('q', q);
      const d = await api.get<{ items: RoomCardData[]; hasMore: boolean }>(`/rooms/discover?${qs}`);
      if (my !== seq.current) return;                          // a newer search superseded this one
      setItems((cur) => (offset ? [...cur, ...d.items.filter((n) => !cur.some((c) => c.id === n.id))] : d.items));
      setHasMore(d.hasMore);
    } catch (e) { if (my === seq.current) setError(errMsg(e)); }
    finally { if (my === seq.current) { setLoading(false); setMore(false); } }
  }, [q, filter, sort]);

  useEffect(() => { void load(0); }, [load]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  // debounce the in-page search box
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => update({ q: text.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1>Discover</h1><p className="muted-2">Public rooms hosted by the community. Private rooms never appear here.</p></div></div>
      <div className="toolbar">
        <div className="search wide"><Icon name="search" size={16} />
          <input aria-label="Search rooms" placeholder="Search by room, video or host" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} /></div>
        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.map(([v, label]) => <button key={v} className={`chip ${filter === v ? 'active' : ''}`} aria-pressed={filter === v} onClick={() => update({ filter: v === 'all' ? '' : v })}>{label}</button>)}
        </div>
        <select className="select" aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'active' ? '' : e.target.value })}>
          <option value="active">Recently active</option><option value="new">Newest</option>
        </select>
      </div>

      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={() => load(0)} /> :
        items.length ? (
          <>
            <div className="grid">{items.map((r) => <RoomCard key={r.id} room={r} />)}</div>
            {hasMore && <div className="center"><button className="btn btn-secondary" disabled={more} onClick={() => load(items.length)}>{more ? 'Loading…' : 'Load more'}</button></div>}
          </>
        ) : (
          <EmptyState icon="compass" title={q || filter !== 'all' ? 'No rooms match' : 'No public rooms yet'}
            text={q || filter !== 'all' ? 'Try a different search or filter.' : 'Create the first public room for the community.'}
            action={<button className="btn btn-primary" onClick={() => openCreate()}>Create a room</button>} />
        )}
    </div>
  );
}
