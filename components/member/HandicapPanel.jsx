'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { addDays, toDateKey } from '@/lib/booking/utils';
import Panel from './Panel';
import {
  COURSE,
  calculateDifferential,
  formatShortDate,
  getDateParts,
} from '@/lib/member/utils';
import { useLocale } from '@/components/i18n/LocaleProvider';

const SOURCE_LABELS = { caddy: 'Caddy', marshal: 'Marshal', self: 'Self-reported' };

function HandicapChart({ trend }) {
  const { locale, text } = useLocale();
  const W = 640;
  const H = 220;
  const pad = { top: 22, right: 24, bottom: 32, left: 46 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = trend.map((point) => point.index);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);

  // Sumbu dibalik: handicap lebih rendah (lebih baik) tampil lebih tinggi
  const x = (i) => pad.left + (i / (trend.length - 1)) * innerW;
  const y = (value) => pad.top + ((value - min) / (max - min)) * innerH;

  const line = trend
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.index).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(trend.length - 1).toFixed(1)},${H - pad.bottom} L${x(0).toFixed(1)},${H - pad.bottom} Z`;
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);

  const first = getDateParts(trend[0].dateKey, locale);
  const last = trend[trend.length - 1];
  const lastParts = getDateParts(last.dateKey, locale);

  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={text(`Handicap index trend from ${trend[0].index.toFixed(1)} to ${last.index.toFixed(1)} over ${trend.length} updates`, `Tren indeks handicap dari ${trend[0].index.toFixed(1)} menjadi ${last.index.toFixed(1)} selama ${trend.length} pembaruan`)}
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="handicap-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A96E" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#C9A96E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-[#F6F2EA]/10"
              strokeWidth="1"
            />
            <text
              x={pad.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-[#F6F2EA]/45 text-[11px] tabular-nums"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#handicap-fill)" />
        <motion.path
          d={line}
          fill="none"
          className="stroke-[#C9A96E]"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />

        {trend.length <= 14 &&
          trend.map((point, i) => (
            <circle key={point.dateKey + i} cx={x(i)} cy={y(point.index)} r="3" className="fill-[#0F2A20] stroke-[#C9A96E]" strokeWidth="1.5" />
          ))}

        <circle cx={x(trend.length - 1)} cy={y(last.index)} r="6" className="fill-[#C9A96E]" />
        <text
          x={x(trend.length - 1)}
          y={y(last.index) - 14}
          textAnchor="end"
          className="fill-[#F6F2EA] text-[13px] font-semibold tabular-nums"
        >
          {last.index.toFixed(1)}
        </text>

        <text x={pad.left} y={H - 8} className="fill-[#F6F2EA]/45 text-[11px]">
          {first.day} {first.month}
        </text>
        <text x={W - pad.right} y={H - 8} textAnchor="end" className="fill-[#F6F2EA]/45 text-[11px]">
          {lastParts.day} {lastParts.month}
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-[#F6F2EA]/45">{text('Lower is better. The line moves up as you improve.', 'Semakin rendah semakin baik. Garis bergerak naik saat permainan Anda membaik.')}</figcaption>
    </figure>
  );
}

function LogRoundForm({ now, rounds, dispatch }) {
  const { text } = useLocale();
  const maxKey = toDateKey(now);
  const minKey = toDateKey(addDays(now, -60));
  const [dateKey, setDateKey] = useState(maxKey);
  const [gross, setGross] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const score = Number(gross);

    if (!dateKey || dateKey > maxKey || dateKey < minKey) {
      setError(text('Choose a date within the last 60 days.', 'Pilih tanggal dalam 60 hari terakhir.'));
      return;
    }
    if (!Number.isInteger(score) || score < 50 || score > 150) {
      setError(text('Enter a gross score between 50 and 150.', 'Masukkan skor gross antara 50 dan 150.'));
      return;
    }
    if (rounds.some((round) => round.dateKey === dateKey)) {
      setError(text('A round is already logged for this date.', 'Ronde untuk tanggal ini sudah dicatat.'));
      return;
    }

    setError(null);
    dispatch({ type: 'LOG_ROUND', id: `round-${Date.now()}`, dateKey, gross: score });
    setGross('');
  };

  const inputClass = (invalid) =>
    `w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-base text-[#F6F2EA] transition-colors [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#C9A96E] ${
      invalid ? 'border-red-300/60' : 'border-[#C9A96E]/25 focus:border-[#C9A96E]'
    }`;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="mt-8 rounded-xl border border-[#C9A96E]/20 bg-[#0F2A20]/40 p-5"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">{text('Log a Round', 'Catat Ronde')}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="round-date" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">
            {text('Date played', 'Tanggal bermain')}
          </label>
          <input
            id="round-date"
            type="date"
            min={minKey}
            max={maxKey}
            value={dateKey}
            onChange={(event) => setDateKey(event.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'round-error' : undefined}
            className={inputClass(Boolean(error))}
          />
        </div>
        <div>
          <label htmlFor="round-gross" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">
            {text('Gross score', 'Skor gross')}
          </label>
          <input
            id="round-gross"
            type="number"
            inputMode="numeric"
            min="50"
            max="150"
            placeholder={text('e.g. 86', 'contoh: 86')}
            value={gross}
            onChange={(event) => setGross(event.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'round-error' : undefined}
            className={`${inputClass(Boolean(error))} placeholder:text-[#F6F2EA]/30`}
          />
        </div>
        <button
          type="submit"
          className="rounded-full border border-[#C9A96E] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A96E] transition-colors duration-300 hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
        >
          {text('Add Round', 'Tambah Ronde')}
        </button>
      </div>
      {error && (
        <p id="round-error" role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}

export default function HandicapPanel({ rounds, handicap, trend, now, dispatch }) {
  const { locale, text } = useLocale();
  const recentRounds = [...rounds]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.id.localeCompare(a.id))
    .slice(0, 8);

  const reference = trend.length > 5 ? trend[trend.length - 6] : trend[0];
  const latest = trend[trend.length - 1];
  const delta = trend.length > 1 ? Math.round((latest.index - reference.index) * 10) / 10 : 0;

  return (
    <Panel id="handicap" eyebrow={text('Handicap Locker', 'Catatan Handicap')} title={text('Your Game', 'Permainan Anda')}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-[family-name:var(--font-heading)] text-7xl font-semibold tabular-nums leading-none text-[#C9A96E]">
            {handicap.index === null ? '—' : handicap.index.toFixed(1)}
          </p>
          <p className="mt-3 text-sm text-[#F6F2EA]/60">
            {handicap.index === null
              ? text(`Log ${3 - handicap.sample} more ${3 - handicap.sample === 1 ? 'round' : 'rounds'} to calculate your index.`, `Catat ${3 - handicap.sample} ronde lagi untuk menghitung indeks.`)
              : text(`Best ${handicap.used} of your last ${handicap.sample} differentials`, `${handicap.used} differential terbaik dari ${handicap.sample} ronde terakhir`)}
          </p>
        </div>

        {handicap.index !== null && trend.length > 1 && (
          <p
            className={`rounded-full border px-4 py-2 text-sm tabular-nums ${
              delta < 0
                ? 'border-emerald-300/40 text-emerald-300'
                : delta > 0
                  ? 'border-amber-300/40 text-amber-300'
                  : 'border-[#F6F2EA]/20 text-[#F6F2EA]/60'
            }`}
          >
            {delta < 0 ? '▼' : delta > 0 ? '▲' : '●'} {Math.abs(delta).toFixed(1)} over{' '}
            {text(trend.length > 5 ? '5 rounds' : `${trend.length - 1} ${trend.length - 1 === 1 ? 'update' : 'updates'}`, trend.length > 5 ? '5 ronde' : `${trend.length - 1} pembaruan`)}
          </p>
        )}
      </div>

      {trend.length > 1 ? (
        <HandicapChart trend={trend} />
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-[#C9A96E]/25 px-6 py-8 text-center text-sm text-[#F6F2EA]/55">
          {text('Your handicap trend appears here after your fourth round.', 'Tren handicap akan tampil setelah ronde keempat Anda.')}
        </p>
      )}

      <div className="mt-8">
        <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">{text('Recent Rounds', 'Ronde Terbaru')}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <caption className="sr-only">Delapan ronde terakhir beserta skor gross dan differential</caption>
            <thead>
              <tr className="border-b border-[#C9A96E]/20 text-[0.65rem] uppercase tracking-[0.2em] text-[#F6F2EA]/50">
                <th scope="col" className="py-3 pr-4 font-medium">{text('Date', 'Tanggal')}</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">Gross</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">Diff.</th>
                <th scope="col" className="py-3 pr-4 font-medium">{text('Verified by', 'Diverifikasi oleh')}</th>
                <th scope="col" className="py-3 text-right font-medium">Counts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C9A96E]/10">
              {recentRounds.map((round) => {
                const counted = handicap.counted.has(round.id);
                return (
                  <tr key={round.id} className="text-[#F6F2EA]/85">
                    <td className="py-3.5 pr-4">{formatShortDate(round.dateKey, locale)}</td>
                    <td className="py-3.5 pr-4 text-right font-semibold tabular-nums text-[#F6F2EA]">{round.gross}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums">{calculateDifferential(round.gross).toFixed(1)}</td>
                    <td className="py-3.5 pr-4">
                      <span className={round.verified ? 'text-[#F6F2EA]/75' : 'text-amber-300'}>
                        {round.verified ? (round.source === 'self' ? text('Self-reported', 'Dilaporkan sendiri') : SOURCE_LABELS[round.source]) : text('Pending verification', 'Menunggu verifikasi')}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {counted ? (
                        <span className="text-[#C9A96E]" aria-label={text('Counted in handicap', 'Dihitung dalam handicap')}>● {text('Yes', 'Ya')}</span>
                      ) : (
                        <span className="text-[#F6F2EA]/30" aria-label="Tidak dihitung">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <LogRoundForm now={now} rounds={rounds} dispatch={dispatch} />

      <p className="mt-5 text-xs leading-relaxed text-[#F6F2EA]/45">
        {text(`Indicative index based on rounds at the ${COURSE.name} (rating ${COURSE.rating}, slope ${COURSE.slope}). Your official handicap is issued by your golf association.`, `Indeks indikatif berdasarkan ronde di ${COURSE.name} (rating ${COURSE.rating}, slope ${COURSE.slope}). Handicap resmi diterbitkan oleh asosiasi golf Anda.`)}
      </p>
    </Panel>
  );
}