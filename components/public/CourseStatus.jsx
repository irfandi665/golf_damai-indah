'use client';

import { useEffect, useState } from 'react';

const styles = {
  info: 'border-sky-300/30 bg-sky-950/20 text-sky-100',
  caution: 'border-amber-300/30 bg-amber-950/20 text-amber-100',
  closed: 'border-red-300/30 bg-red-950/20 text-red-100',
};

export default function CourseStatus() {
  const [updates, setUpdates] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/v1/course-updates', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load course status.');
        return response.json();
      })
      .then(setUpdates)
      .catch(() => setError(true));
  }, []);

  return (
    <section aria-labelledby="course-status-title" className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
      <p id="course-status-title" className="text-xs font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Course operations</p>
      {error ? <p className="mt-4 text-sm text-amber-100">Live operating status is temporarily unavailable. Please contact the club before travelling.</p>
        : updates === null ? <p className="mt-4 text-sm text-[#F6F2EA]/55">Loading operating updates…</p>
          : updates.length ? (
            <ul className="mt-4 space-y-3">
              {updates.map((update) => (
                <li key={update.id} className={`rounded-xl border p-4 ${styles[update.severity] || styles.info}`}>
                  <p className="font-medium">{update.title}</p>
                  <p className="mt-1 text-sm opacity-80">{update.message}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-[#F6F2EA]/55">No operational notices at this time. Check with the club for same-day weather and course conditions.</p>}
    </section>
  );
}
