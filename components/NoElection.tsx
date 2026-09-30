"use client";
import Link from "next/link";
import { useApp } from "@/hooks/useApp";
import { Card } from "./ui/card";
import { EmptyState } from "./States";
import { Button } from "./ui/button";

export function NoElection() {
  const { isAdmin } = useApp();
  return (
    <Card>
      <EmptyState
        title="No hay una elección activa"
        description={isAdmin
          ? "Cree un proceso electoral o cargue los datos demo y márquelo como activo para empezar."
          : "Un administrador debe configurar y activar el proceso electoral."}
        action={isAdmin ? <Link href="/configuracion"><Button>Ir a Configuración electoral</Button></Link> : undefined}
      />
    </Card>
  );
}
