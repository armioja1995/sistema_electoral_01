"use client";
import { AlertTriangle, Info } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp } from "@/hooks/useApp";
import { useAsync } from "@/hooks/useAsync";
import { useRealtimeRefresh } from "@/hooks/useRealtimeStats";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ProgressBar } from "@/components/ProgressBar";
import { ChartCard } from "@/components/ChartCard";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/LiveIndicator";
import { NoElection } from "@/components/NoElection";
import { Card, CardHeader } from "@/components/ui/card";
import { getProjection } from "@/services/results";
import { fmtNum, fmtPct, ratio } from "@/utils/format";
import type { Projection } from "@/types";

const MIN_TABLES = 30;

export function ProjectionView() {
  const { election } = useApp();
  const eid = election?.id;
  const q = useAsync(() => (eid ? getProjection(eid) : Promise.resolve(null)), [eid]);
  const live = useRealtimeRefresh(eid, q.reload);

  if (!election) return <><PageHeader title="Proyección de resultados" /><NoElection /></>;
  const p = q.data;

  return (
    <>
      <PageHeader title="Proyección de resultados"
        description={<LiveIndicator status={live.status} updatedAt={p?.generated_at} />} />

      {/* Advertencia siempre visible, incluso mientras carga */}
      <div role="note" className="mb-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">
            Esta proyección es únicamente una estimación estadística basada en las mesas registradas. No representa un resultado oficial.
          </p>
          <p className="mt-1">
            Supone que las mesas pendientes se comportarán como las ya procesadas. Si las mesas llegan en un orden
            no aleatorio (por ejemplo, primero las urbanas), la estimación puede desviarse de forma importante.
          </p>
        </div>
      </div>

      {q.error ? <Card><ErrorState message={q.error} onRetry={q.reload} /></Card>
        : !p ? <CardsSkeleton n={4} />
        : p.processed_tables === 0 ? (
          <Card><EmptyState title="Aún no hay mesas procesadas"
            description="La estimación aparecerá cuando se registre o valide la primera acta." /></Card>
        ) : <ProjectionBody p={p} loading={q.loading} />}
    </>
  );
}

function ProjectionBody({ p, loading }: { p: Projection; loading: boolean }) {
  const pending = p.total_tables - p.processed_tables;
  const projValid = p.projected_valid_votes ?? 0;
  const cands = p.candidates;
  const [first, second] = cands;
  const small = p.processed_tables < MIN_TABLES;
  const allCounted = pending === 0;

  const chartData = cands.map((c) => {
    const share = c.share ?? 0;
    return {
      name: c.full_name, acronym: c.acronym, color: c.color,
      share: share * 100,
      err: [Math.max(0, share - (c.share_low ?? share)) * 100, Math.max(0, (c.share_high ?? share) - share) * 100] as [number, number],
      low: (c.share_low ?? share) * 100, high: (c.share_high ?? share) * 100,
    };
  });

  const gap = first && second && first.share != null && second.share != null ? first.share - second.share : null;
  const overlap = first && second && first.share_low != null && second.share_high != null
    ? first.share_low <= second.share_high : null;

  return (
    <div className={loading ? "space-y-4 opacity-80 transition-opacity" : "space-y-4"}>
      <Card className="p-4 sm:p-5">
        <p className="text-base font-medium text-ink">
          Estimación basada en <span className="tabular-nums">{fmtNum(p.processed_tables)}</span> de{" "}
          <span className="tabular-nums">{fmtNum(p.total_tables)}</span> mesas registradas.
        </p>
        <ProgressBar value={p.processed_tables} max={p.total_tables} className="mt-3 h-2.5" label="Avance de mesas procesadas" />
        {small && !allCounted && (
          <p className="mt-3 flex gap-2 text-sm text-orange-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Con menos de {MIN_TABLES} mesas procesadas la estimación es muy inestable; los intervalos pueden no ser fiables.
          </p>
        )}
        {allCounted && (
          <p className="mt-3 text-sm text-ink-soft">
            Todas las mesas están procesadas: las cifras mostradas son el cómputo del sistema, sujeto a la validación oficial.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Votos contabilizados" value={fmtNum(p.votes_cast_counted)} sub={`${fmtNum(p.valid_votes_counted)} válidos`} />
        <StatCard label="Mesas procesadas" value={fmtNum(p.processed_tables)} tone="ok" />
        <StatCard label="Mesas pendientes" value={fmtNum(pending)} sub="incluye observadas y en registro" />
        <StatCard label="Porcentaje de avance" value={fmtPct(ratio(p.processed_tables, p.total_tables))}
          sub={`Participación observada ${fmtPct(p.turnout_observed)}`} />
      </div>

      <ChartCard title="Porcentaje estimado de votos válidos"
        description="Barra: proporción observada · línea: rango estimado (intervalo aproximado del 95 %)">
        {chartData.length === 0 ? <EmptyState title="No hay candidatos" /> : (
          <div style={{ height: Math.max(200, chartData.length * 60) }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#E9EDF1" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "#6B7788" }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#6B7788" }} />
                <Tooltip cursor={{ fill: "#E3ECF580" }}
                  contentStyle={{ borderRadius: 6, border: "1px solid #D6DCE3", fontSize: 13 }}
                  formatter={(_v, _n, item) => {
                    const d = item.payload as (typeof chartData)[number];
                    return [`${d.share.toFixed(1)} % (rango ${d.low.toFixed(1)}–${d.high.toFixed(1)} %)`, d.acronym];
                  }} />
                <Bar dataKey="share" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {chartData.map((d) => <Cell key={d.name} fill={d.color} fillOpacity={0.85} />)}
                  <ErrorBar dataKey="err" width={6} strokeWidth={1.5} stroke="#1B2A3A" direction="x" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <Card>
        <CardHeader title="Escenario estimado por candidato"
          description={`Si el comportamiento observado se mantuviera, el total de votos válidos rondaría ${fmtNum(projValid)}.`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs text-ink-muted">
                <th className="px-4 py-2.5 text-left font-medium">Candidato</th>
                <th className="px-4 py-2.5 text-right font-medium">Votos registrados</th>
                <th className="px-4 py-2.5 text-right font-medium">% observado</th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Rango estimado (%)</th>
                <th className="px-4 py-2.5 text-right font-medium">Estimación orientativa</th>
              </tr>
            </thead>
            <tbody>
              {cands.map((c) => {
                const est = c.share != null ? Math.round(c.share * projValid) : null;
                const lo = c.share_low != null ? Math.round(c.share_low * projValid) : null;
                const hi = c.share_high != null ? Math.round(c.share_high * projValid) : null;
                return (
                  <tr key={c.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: c.color }} aria-hidden />
                        <div><div className="font-medium">{c.full_name}</div><div className="text-xs text-ink-muted">{c.acronym}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(c.votes)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtPct(c.share)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-ink-soft md:table-cell">
                      {c.share_low != null && c.se != null ? `${fmtPct(c.share_low)} – ${fmtPct(c.share_high)}` : "no calculable"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      ≈ {fmtNum(est)}
                      {lo != null && hi != null && c.se != null && (
                        <div className="text-xs text-ink-muted">entre {fmtNum(lo)} y {fmtNum(hi)}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {first && second && gap != null && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-ink">Diferencia actual entre candidatos</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Con las mesas procesadas hasta ahora, <strong>{first.full_name}</strong> registra{" "}
            <strong className="tabular-nums">{fmtNum(first.votes - second.votes)}</strong> votos más que{" "}
            <strong>{second.full_name}</strong> ({fmtPct(gap)} de los votos válidos contabilizados).
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {overlap
              ? "Los rangos estimados de ambos candidatos se superponen: con la información disponible la diferencia no es concluyente y podría cambiar a medida que se registren más mesas."
              : "Los rangos estimados no se superponen, pero la situación puede variar si las mesas pendientes tienen un comportamiento distinto al observado."}
          </p>
        </Card>
      )}

      <details className="rounded-lg border border-line bg-paper-raised px-4 py-3 text-sm text-ink-soft">
        <summary className="cursor-pointer font-medium text-ink">¿Cómo se calcula esta estimación?</summary>
        <div className="mt-2 space-y-2">
          <p>El porcentaje de cada candidato es la razón entre sus votos y los votos válidos de todas las mesas procesadas.</p>
          <p>El total de votos válidos estimado escala los válidos contabilizados por la proporción de electores habilitados:
            válidos × (electores totales ÷ electores en mesas procesadas).</p>
          <p>El rango usa un estimador de razón tratando cada mesa como un conglomerado, con corrección por población finita
            (se reduce a medida que se procesan más mesas) y ±1,96 errores estándar. Es aproximado y asume que las mesas
            procesadas son representativas del total, lo que no está garantizado.</p>
        </div>
      </details>
    </div>
  );
}
