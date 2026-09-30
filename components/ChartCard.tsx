import type { ReactNode } from "react";
import { Card, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function ChartCard({ title, description, children, loading, height = 280, actions }: {
  title: string; description?: string; children: ReactNode; loading?: boolean; height?: number; actions?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} actions={actions} />
      <div className="p-3 sm:p-4" style={{ minHeight: height }}>
        {loading ? <Skeleton className="w-full" /> : children}
      </div>
    </Card>
  );
}
