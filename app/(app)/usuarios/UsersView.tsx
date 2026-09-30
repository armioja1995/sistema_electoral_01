"use client";
import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Info } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/DataTable";
import { EntityForm, type FieldDef } from "@/components/EntityForm";
import { FilterBar, SearchInput } from "@/components/FilterBar";
import { Pill } from "@/components/StatusBadge";
import { createUser, listProfiles, resetPassword, updateProfile } from "@/services/users";
import { ROLE_LABELS } from "@/lib/permissions";
import { fmtDate, fullName } from "@/utils/format";
import type { Profile, UserRole } from "@/types";

const ROLE_OPTS = (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const PW = { pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, patternMessage: "Mínimo 8 caracteres, con letras y números." };

const EDIT_FIELDS: FieldDef[] = [
  { name: "first_name", label: "Nombre", required: true, maxLength: 80 },
  { name: "last_name", label: "Apellido", required: true, maxLength: 80 },
  { name: "role", label: "Rol", type: "select", required: true, options: ROLE_OPTS },
  { name: "active", label: "Estado", type: "select", required: true,
    options: [{ value: "true", label: "Activo" }, { value: "false", label: "Inactivo (sin acceso)" }] },
];
const NEW_FIELDS: FieldDef[] = [
  { name: "first_name", label: "Nombre", required: true, maxLength: 80 },
  { name: "last_name", label: "Apellido", required: true, maxLength: 80 },
  { name: "email", label: "Correo electrónico", type: "email", required: true, full: true, maxLength: 200,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, patternMessage: "Correo no válido." },
  { name: "password", label: "Contraseña inicial", type: "password", required: true, ...PW,
    hint: "Comuníquela al usuario por un canal seguro." },
  { name: "role", label: "Rol", type: "select", required: true, options: ROLE_OPTS },
];

export function UsersView({ canCreate, meId }: { canCreate: boolean; meId: string }) {
  const { data, loading, error, reload } = useAsync(listProfiles, []);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [edit, setEdit] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [pwFor, setPwFor] = useState<Profile | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data ?? []).filter((p) =>
      (!role || p.role === role) &&
      (!s || `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(s)));
  }, [data, search, role]);

  const columns: Column<Profile>[] = [
    { key: "name", header: "Usuario", cell: (p) => (
      <div>
        <div className="font-medium">{fullName(p) || "(sin nombre)"} {p.id === meId && <span className="text-xs text-ink-muted">· usted</span>}</div>
        <div className="text-xs text-ink-muted">{p.email}</div>
      </div>
    ) },
    { key: "role", header: "Rol", cell: (p) => <Pill tone={p.role === "administrador" ? "ok" : "neutral"}>{ROLE_LABELS[p.role]}</Pill> },
    { key: "active", header: "Estado", cell: (p) => <Pill tone={p.active ? "ok" : "off"}>{p.active ? "Activo" : "Inactivo"}</Pill> },
    { key: "created", header: "Creado", hideSm: true, cell: (p) => <span className="tabular-nums text-ink-soft">{fmtDate(p.created_at)}</span> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, align: "right", cell: (p) => (
      <div className="flex justify-end gap-1">
        <Button size="icon" variant="ghost" aria-label="Editar usuario" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
        {canCreate && (
          <Button size="icon" variant="ghost" aria-label="Restablecer contraseña" onClick={() => setPwFor(p)}><KeyRound className="h-4 w-4" /></Button>
        )}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Usuarios" description="Perfiles, roles y acceso al sistema."
        actions={canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nuevo usuario</Button>} />

      {!canCreate && (
        <div className="mb-4 flex gap-3 rounded-lg border border-line bg-brand-soft/60 px-4 py-3 text-sm text-ink-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p>
            Para crear usuarios desde aquí configure <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> en el servidor.
            Mientras tanto, créelos en Supabase → Authentication → Users (entran con rol <strong>Consulta</strong>) y asigne el rol en esta pantalla.
          </p>
        </div>
      )}

      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o correo" />
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-48" aria-label="Filtrar por rol">
            <option value="">Todos los roles</option>
            {ROLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterBar>
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={reload}
          emptyTitle="No se encontraron usuarios" />
      </Card>

      <EntityForm open={!!edit} onClose={() => setEdit(null)} title="Editar usuario" description={edit?.email}
        fields={EDIT_FIELDS}
        initial={edit ? { first_name: edit.first_name, last_name: edit.last_name, role: edit.role, active: String(edit.active) } : undefined}
        onSubmit={async (v) => {
          await updateProfile(edit!.id, { first_name: v.first_name, last_name: v.last_name, role: v.role as UserRole, active: v.active === "true" });
          reload();
        }} />

      <EntityForm open={creating} onClose={() => setCreating(false)} title="Nuevo usuario"
        description="El usuario podrá ingresar de inmediato con el correo y la contraseña indicados."
        fields={NEW_FIELDS} submitLabel="Crear usuario"
        onSubmit={async (v) => {
          await createUser({ email: v.email, password: v.password, first_name: v.first_name, last_name: v.last_name, role: v.role as UserRole });
          reload();
        }} />

      <EntityForm open={!!pwFor} onClose={() => setPwFor(null)} title="Restablecer contraseña" description={pwFor?.email}
        fields={[{ name: "password", label: "Nueva contraseña", type: "password", required: true, full: true, ...PW }]}
        submitLabel="Restablecer"
        onSubmit={async (v) => { await resetPassword(pwFor!.id, v.password); }} />
    </>
  );
}
