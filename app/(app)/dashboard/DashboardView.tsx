"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Grid3x3, School, Users, Vote, Percent } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useLiveStats } from "@/hooks/useLiveStats";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ProgressBar } from "@/components/ProgressBar";
import { ChartCard } from "@/components/ChartCard";
import { CardsSkeleton, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/LiveIndicator";
import { NoElection } from "@/components/NoElection";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CandidateBars, ProgressChart } from "@/components/charts/Charts";
import { fmtNum, fmtPct, ratio } from "@/utils/format";

export function DashboardView() {
  const { election, profile } = useApp();
  const params = useSearchParams();
  const { data: s, loading, error, reload, live } = useLiveStats(election?.id);

  useEffect(() => {
    if (params.get("denied")) toast.error("Su rol no tiene acceso a ese módulo.");
  }, [params]);

  if (!election) return <><PageHeader title="Dashboard" /><NoElection /></>;

  const pending = (s?.status_counts.pendiente ?? 0) + (s?.status_counts.en_registro ?? 0);
  const observed = s?.status_counts.observada ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={<LiveIndicator status={live.status} updatedAt={s?.generated_at} />}
        actions={profile.role !== "consulta" && (
          <Link href="/registro"><Button>Registrar resultados</Button></Link>
        )}
      />

      {error ? <Card><ErrorState message={error} onRetry={reload} /></Card> : !s ? (
        <div className="space-y-4"><CardsSkeleton n={8} /></div>
      ) : (
        <div className={loading ? "opacity-80 transition-opacity" : undefined}>
          {/* Avance principal */}
          <Card className="mb-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">Mesas procesadas</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-ink sm:text-4xl">
                  {fmtNum(s.processed_tables)} <span className="text-xl font-normal text-ink-muted">/ {fmtNum(s.total_tables)}</span>
                </p>
              </div>
              <p className="text-3xl font-semibold tabular-nums text-brand sm:text-4xl">{fmtPct(ratio(s.processed_tables, s.total_tables))}</p>
            </div>
            <ProgressBar value={s.processed_tables} max={s.total_tables} className="mt-4 h-3" label="Avance de mesas procesadas" />
            <p className="mt-2 text-xs text-ink-muted">Se consideran procesadas las mesas con acta Registrada o Validada. Las observadas no se suman hasta su resolución.</p>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Locales" value={fmtNum(s.total_places)} icon={<School className="h-4 w-4" />} />
            <StatCard label="Mesas" value={fmtNum(s.total_tables)} icon={<Grid3x3 className="h-4 w-4" />} />
            <StatCard label="Mesas registradas" value={fmtNum(s.processed_tables)} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />}
              sub={`${fmtNum(s.status_counts.validada ?? 0)} validadas`} />
            <StatCard label="Mesas pendientes" value={fmtNum(pending)} icon={<Clock className="h-4 w-4" />}
              sub={`${fmtNum(s.status_counts.en_registro ?? 0)} en registro`} />
            <StatCard label="Mesas observadas" value={fmtNum(observed)} tone={observed ? "warn" : "default"} icon={<AlertTriangle className="h-4 w-4" />} />
            <StatCard label="Electores habilitados" value={fmtNum(s.registered_voters_total)} icon={<Users className="h-4 w-4" />}
              sub={`${fmtNum(s.registered_voters_counted)} en mesas procesadas`} />
            <StatCard label="Votos registrados" value={fmtNum(s.votes_cast)} icon={<Vote className="h-4 w-4" />}
              sub={`${fmtNum(s.valid_votes)} válidos`} />
            <StatCard label="Participación" value={fmtPct(ratio(s.votes_cast, s.registered_voters_counted))} icon={<Percent className="h-4 w-4" />}
              sub="sobre mesas procesadas" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <ChartCard title="Votos por candidato" description={`Resultados parciales · ${fmtNum(s.valid_votes)} votos válidos contabilizados`}
              actions={<Link href="/estadisticas" className="text-sm text-brand hover:underline">Ver estadísticas</Link>}>
              <CandidateBars stats={s} />
            </ChartCard>
            <ChartCard title="Avance del conteo" description="Mesas por estado">
              <ProgressChart stats={s} />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  );
}
