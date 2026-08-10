import { agentAccess } from "@/lib/agent-access";
import { PageHeader, Table, TableHeadCell, TableRow, TableCell, EmptyState, Button, StatusPill } from "@repo/admin-ui/primitives";

export default async function AgentsPage() {
  const clients = await agentAccess.apiClients.list();

  return (
    <div>
      <PageHeader
        title="Agentes"
        description="Identidades de agentes externos (Claude/MCP) con acceso a la API dedicada."
        actions={
          <div className="flex gap-2">
            <Button href="/agents/audit" variant="secondary">
              Ver auditoría
            </Button>
            <Button href="/agents/new">+ Nuevo agente</Button>
          </div>
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          title="Todavía no hay agentes"
          description="Crea el primer ApiClient para emitirle una ApiKey y que un agente pueda usar apps/agent-api."
          action={<Button href="/agents/new">+ Nuevo agente</Button>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell className="w-[30%]">Nombre</TableHeadCell>
              <TableHeadCell className="w-[20%]">Estado</TableHeadCell>
              <TableHeadCell className="w-[20%]">Alcance</TableHeadCell>
              <TableHeadCell className="w-[15%]">Solo lectura</TableHeadCell>
              <TableHeadCell className="w-[15%]" />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="break-words font-medium">{client.name}</TableCell>
                <TableCell>
                  <StatusPill tone={client.status === "ACTIVE" ? "success" : "danger"}>
                    {client.status === "ACTIVE" ? "Activo" : "Suspendido"}
                  </StatusPill>
                </TableCell>
                <TableCell className="break-words text-ink-muted">
                  {client.allowedOfferIds === null
                    ? "Todas las Offers"
                    : client.allowedOfferIds.length === 0
                      ? "Ninguna Offer"
                      : `${client.allowedOfferIds.length} Offer(s)`}
                </TableCell>
                <TableCell>{client.forceReadOnly ? <StatusPill tone="warning">Sí</StatusPill> : "No"}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button href={`/agents/${client.id}`} variant="ghost" size="sm">
                      Detalle
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
