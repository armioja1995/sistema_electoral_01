"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useLiveStats } from "@/hooks/useLiveStats";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "@/components/ChartCard";
import { CardsSkeleton, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/LiveIndicator";
import { NoElection } from "@/components/NoElection";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateBars, DistributionDonut, ParticipationBars, ProgressChart, TimelineChart } from "@/components/charts/Charts";
import { exportResults } from "@/services/results";
import { downloadCsv } from "@/utils/csv";
import { fmtNum, fmtPct, ratio } from "@/utils/format";

export function StatsView() {
  const { election } = useApp();
  const { data: s, loading, error, reload, live } = useLiveStats(election?.id);
  const [exporting, setExporting] = useState(false);

  if (!election) return <><PageHeader title="Estadísticas" /><NoElection /></>;

  async function doExport() {
    setExporting(true);
    try {
      const rows = await exportResults(election!.id);
      if (!rows.length) { toast.info("No hay mesas para exportar."); return; }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      downloadCsv(`resultados-${stamp}.csv`, rows);
      toast.success(`Exportadas ${fmtNum(rows.length)} mesas.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const participation = s ? ratio(s.votes_cast, s.registered_voters_counted) : 0;

  return (
    <>
      <PageHeader
        title="Estadísticas"
        description={<LiveIndicator status={live.status} updatedAt={s?.generated_at} />}
        actions={<Button variant="secondary" onClick={doExport} loading={exporting}><Download className="h-4 w-4" />Exportar resultados CSV</Button>}
      />

      {error ? <Card><ErrorState message={error} onRetry={reload} /></Card> : !s ? (
        <div className="space-y-4">
          <CardsSkeleton n={4} />
          <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
        </div>
      ) : (
        <div className={loading ? "space-y-4 opacity-80 transition-opacity" : "space-y-4"}>
          <p className="rounded-md border border-line bg-paper-raised px-4 py-2.5 text-sm text-ink-soft">
            Resultados parciales sobre <strong className="tabular-nums">{fmtNum(s.processed_tables)}</strong> de{" "}
            <strong className="tabular-nums">{fmtNum(s.total_tables)}</strong> mesas procesadas ({fmtPct(ratio(s.processed_tables, s.total_tables))}).
            Las cifras corresponden solo a actas registradas o validadas.
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Votos emitidos" value={fmtNum(s.votes_cast)} sub={`de ${fmtNum(s.registered_voters_counted)} electores en mesas procesadas`} />
            <StatCard label="Votos válidos" value={fmtNum(s.valid_votes)} sub={fmtPct(ratio(s.valid_votes, s.votes_cast)) + " de emitidos"} />
            <StatCard label="Nulos / Blancos" value={`${fmtNum(s.null_votes)} / ${fmtNum(s.blank_votes)}`}
              sub={`${fmtPct(ratio(s.null_votes, s.votes_cast))} / ${fmtPct(ratio(s.blank_votes, s.votes_cast))} de emitidos`} />
            <StatCard label="Participación" value={fmtPct(participation)} sub={`Abstención ${fmtPct(s.registered_voters_counted ? 1 - participation : 0)}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="1 · Avance del conteo" description="Mesas según su estado">
              <ProgressChart stats={s} />
            </ChartCard>
            <ChartCard title="2 · Votos por candidato" description="Porcentaje sobre votos válidos contabilizados">
              <CandidateBars stats={s} />
            </ChartCard>
            <ChartCard title="3 · Distribución de votos" description="Válidos, nulos, blancos y no votaron (mesas procesadas)">
              <DistributionDonut stats={s} />
            </ChartCard>
            <ChartCard title="4 · Participación" description="Electores habilitados vs. votantes (mesas procesadas)">
              <ParticipationBars stats={s} />
            </ChartCard>
          </div>
          <ChartCard title="5 · Evolución del conteo" description="Votos acumulados a medida que se cierran actas">
            <TimelineChart stats={s} />
          </ChartCard>

          <Card>
            <CardHeader title="Detalle por candidato" description="Votos contabilizados en mesas procesadas" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-xs text-ink-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Candidato</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Partido</th>
                    <th className="px-4 py-2.5 text-right font-medium">Votos</th>
                    <th className="px-4 py-2.5 text-right font-medium">% válidos</th>
                    <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">% emitidos</th>
                  </tr>
                </thead>
                <tbody>
                  {s.candidates.map((c) => (
                    <tr key={c.id} className="border-b border-line/70 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: c.color }} aria-hidden />
                          <span className="font-medium">{c.full_name}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 text-ink-soft sm:table-cell">{c.party_name} ({c.acronym})</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(c.votes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtPct(ratio(c.votes, s.valid_votes))}</td>
                      <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{fmtPct(ratio(c.votes, s.votes_cast))}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-paper text-ink-soft">
                    <td className="px-4 py-2.5">Votos nulos</td><td className="hidden sm:table-cell" />
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(s.null_votes)}</td><td />
                    <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{fmtPct(ratio(s.null_votes, s.votes_cast))}</td>
                  </tr>
                  <tr className="bg-paper text-ink-soft">
                    <td className="px-4 py-2.5">Votos en blanco</td><td className="hidden sm:table-cell" />
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(s.blank_votes)}</td><td />
                    <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{fmtPct(ratio(s.blank_votes, s.votes_cast))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
