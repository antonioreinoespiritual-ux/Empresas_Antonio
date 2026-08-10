import { agentAccess } from "@/lib/agent-access";
import { Button, EmptyState, PageHeader, Select, Table, TableCell, TableHeadCell, TableRow } from "@repo/admin-ui/primitives";

const PAGE_LIMIT = 50;

export default async function AgentAuditPage({
  searchParams,
}: {
  searchParams: { clientId?: string; cursor?: string };
}) {
  const clients = await agentAccess.apiClients.list();
  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

  const { items: logs, nextCursor } = await agentAccess.agentAuditLogs.list({
    apiClientId: searchParams.clientId,
    cursor: searchParams.cursor,
    limit: PAGE_LIMIT,
  });

  const filterQuery = searchParams.clientId ? `&clientId=${searchParams.clientId}` : "";

  return (
    <div>
      <PageHeader title="Auditoría de agentes" description="Cada request autenticada o denegada contra apps/agent-api." />

      <form method="get" className="mb-4 flex items-center gap-2">
        <Select name="clientId" defaultValue={searchParams.clientId ?? ""} className="max-w-xs">
          <option value="">Todos los agentes</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="secondary">
          Filtrar
        </Button>
      </form>

      {logs.length === 0 ? (
        <EmptyState title="Sin registros" description="Todavía no hay actividad de agentes que coincida con este filtro." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <TableHeadCell>Fecha</TableHeadCell>
                <TableHeadCell>Agente</TableHeadCell>
                <TableHeadCell>Método</TableHeadCell>
                <TableHeadCell>Recurso</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Resultado</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-ink-muted">{log.createdAt.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="break-words">
                    <a href={`/agents/${log.apiClientId}`} className="text-accent-strong hover:underline">
                      {clientNameById.get(log.apiClientId) ?? log.apiClientId}
                    </a>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.method}</TableCell>
                  <TableCell className="break-words text-ink-muted">
                    {log.resourceType}
                    {log.resourceId ? ` (${log.resourceId})` : ""}
                  </TableCell>
                  <TableCell className="tabular-nums">{log.statusCode}</TableCell>
                  <TableCell className="break-words text-ink-muted">{log.outcome}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>

          {nextCursor && (
            <div className="mt-4 flex justify-end">
              <Button href={`/agents/audit?cursor=${nextCursor}${filterQuery}`} variant="secondary" size="sm">
                Siguiente página →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
