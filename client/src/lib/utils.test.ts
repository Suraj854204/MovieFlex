import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractVideoId } from './youtube';
import { timeAgo, formatClock, initials, targetTime } from './format';

describe('extractVideoId', () => {
  const id = 'dQw4w9WgXcQ';
  it('parses the common URL shapes and bare ids', () => {
    for (const s of [id, `https://www.youtube.com/watch?v=${id}&t=10s`, `youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=abc`,
      `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/shorts/${id}`, `https://music.youtube.com/watch?v=${id}`, `  ${id}  `]) {
      assert.equal(extractVideoId(s), id, s);
    }
  });
  it('rejects everything else', () => {
    for (const s of ['', 'hello', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'javascript:alert(1)', 'https://youtube.com/']) {
      assert.equal(extractVideoId(s), null, s);
    }
  });
});

describe('format helpers', () => {
  it('timeAgo', () => {
    const now = Date.now();
    assert.equal(timeAgo(now - 5_000, now), 'just now');
    assert.equal(timeAgo(now - 5 * 60_000, now), '5m ago');
    assert.equal(timeAgo(now - 3 * 3600_000, now), '3h ago');
    assert.equal(timeAgo(now - 2 * 86400_000, now), '2d ago');
    assert.equal(timeAgo('garbage', now), '');
  });
  it('formatClock', () => {
    assert.equal(formatClock(5), '0:05'); assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(3725), '1:02:05'); assert.equal(formatClock(-3), '0:00');
  });
  it('initials', () => { assert.equal(initials('Ada Lovelace'), 'AL'); assert.equal(initials('bob'), 'BO'); assert.equal(initials('  '), '?'); });
  it('targetTime advances only while playing', () => {
    assert.equal(targetTime({ playing: true, time: 10, updatedAt: 1000 }, 3500), 12.5);
    assert.equal(targetTime({ playing: false, time: 10, updatedAt: 1000 }, 3500), 10);
    assert.equal(targetTime({ playing: true, time: 10, updatedAt: 5000 }, 3500), 10);
  });
});
