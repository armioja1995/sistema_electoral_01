"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ElectionStats, TableStatus } from "@/types";
import { TABLE_STATUS } from "@/components/StatusBadge";
import { fmtNum, fmtPct, ratio } from "@/utils/format";
import { EmptyState } from "@/components/States";

const tooltipStyle = {
  contentStyle: { borderRadius: 6, border: "1px solid #D6DCE3", fontSize: 13, fontFamily: "inherit" },
  labelStyle: { color: "#1B2A3A", fontWeight: 600 },
};
const axis = { fontSize: 12, fill: "#6B7788" };
const numTick = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

/** Gráfico 1: avance del conteo por estado de mesa */
export function ProgressChart({ stats }: { stats: ElectionStats }) {
  const order: TableStatus[] = ["registrada", "validada", "observada", "en_registro", "pendiente"];
  const data = order
    .map((s) => ({ name: TABLE_STATUS[s].label, value: stats.status_counts[s] ?? 0, color: TABLE_STATUS[s].color }))
    .filter((d) => d.value > 0);
  if (!data.length) return <EmptyState title="Sin mesas registradas en el sistema" />;
  const processed = stats.processed_tables;
  return (
    <div className="relative h-[260px]">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${fmtNum(v)} mesas (${fmtPct(ratio(v, stats.total_tables))})`, ""]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
        <div className="text-2xl font-semibold tabular-nums text-ink">{fmtPct(ratio(processed, stats.total_tables))}</div>
        <div className="text-xs text-ink-muted">procesadas</div>
      </div>
    </div>
  );
}

/** Gráfico 2: votos por candidato (barras horizontales con % sobre válidos) */
export function CandidateBars({ stats, height }: { stats: ElectionStats; height?: number }) {
  const data = stats.candidates.map((c) => ({
    name: c.full_name, party: c.acronym, votes: c.votes, color: c.color,
    pct: ratio(c.votes, stats.valid_votes),
  }));
  if (!data.length) return <EmptyState title="No hay candidatos registrados" />;
  const h = height ?? Math.max(180, data.length * 52);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#E9EDF1" />
          <XAxis type="number" tick={axis} tickFormatter={numTick} />
          <YAxis type="category" dataKey="name" width={120} tick={axis} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "#E3ECF580" }}
            formatter={(v: number, _n, p) => [`${fmtNum(v)} votos · ${fmtPct(p.payload.pct)} de válidos`, p.payload.party]} />
          <Bar dataKey="votes" radius={[0, 4, 4, 0]} maxBarSize={30}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            <LabelList dataKey="pct" position="right" formatter={(v: number) => fmtPct(v)} style={{ fontSize: 12, fill: "#44536A" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gráfico 3: distribución de votos (mesas procesadas) */
export function DistributionDonut({ stats }: { stats: ElectionStats }) {
  const data = [
    { name: "Válidos", value: stats.valid_votes, color: "#1F4E79" },
    { name: "Nulos", value: stats.null_votes, color: "#B42318" },
    { name: "En blanco", value: stats.blank_votes, color: "#A3AEBB" },
    { name: "No votaron", value: stats.did_not_vote, color: "#E4C77B" },
  ];
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <EmptyState title="Aún no hay actas procesadas" />;
  return (
    <div className="h-[260px]">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`${fmtNum(v)} (${fmtPct(ratio(v, total))})`, n]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gráfico 4: participación en mesas procesadas */
export function ParticipationBars({ stats }: { stats: ElectionStats }) {
  const data = [
    { name: "Electores habilitados", value: stats.registered_voters_counted, color: "#44536A" },
    { name: "Votantes", value: stats.votes_cast, color: "#1F4E79" },
    { name: "No votaron", value: stats.did_not_vote, color: "#E4C77B" },
  ];
  if (!stats.registered_voters_counted) return <EmptyState title="Aún no hay actas procesadas" />;
  return (
    <div className="h-[260px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#E9EDF1" />
          <XAxis dataKey="name" tick={axis} interval={0} />
          <YAxis tick={axis} tickFormatter={numTick} width={44} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "#E3ECF580" }}
            formatter={(v: number) => [`${fmtNum(v)} (${fmtPct(ratio(v, stats.registered_voters_counted))})`, ""]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={80}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            <LabelList dataKey="value" position="top" formatter={(v: number) => fmtNum(v)} style={{ fontSize: 12, fill: "#44536A" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gráfico 5: evolución del conteo (votos acumulados por mesas procesadas) */
export function TimelineChart({ stats }: { stats: ElectionStats }) {
  const data = stats.timeline.map((p) => ({
    ...p,
    time: new Date(p.at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
  }));
  if (!data.length) return <EmptyState title="El conteo aún no ha comenzado" description="La curva aparece al cerrarse la primera acta." />;
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#E9EDF1" />
          <XAxis dataKey="n" tick={axis} label={{ value: "Mesas procesadas", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "#6B7788" }} />
          <YAxis tick={axis} tickFormatter={numTick} width={44} />
          <Tooltip {...tooltipStyle}
            labelFormatter={(n, p) => `Mesa n.º ${n}${p?.[0] ? ` · ${p[0].payload.time}` : ""}`}
            formatter={(v: number, name: string) => [fmtNum(v), name]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="votes_cast" name="Votos emitidos acumulados" stroke="#44536A" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="valid_votes" name="Votos válidos acumulados" stroke="#1F4E79" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
