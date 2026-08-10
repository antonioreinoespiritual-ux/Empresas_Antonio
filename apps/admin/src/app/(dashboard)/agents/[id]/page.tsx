import { notFound } from "next/navigation";
import { agentAccess } from "@/lib/agent-access";
import { commerce } from "@/lib/commerce";
import { Card, PageHeader, Table, TableHeadCell, EmptyState, Button } from "@repo/admin-ui/primitives";
import { AllowedOfferIdsEditor } from "./allowed-offer-ids-editor";
import { ApiKeyRow } from "./api-key-row";
import { ClientStatusToggle } from "./client-status-toggle";
import { ForceReadOnlyToggle } from "./force-read-only-toggle";
import { IssueKeyButton } from "./issue-key-button";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const client = await agentAccess.apiClients.findById(params.id);
  if (!client) {
    notFound();
  }

  const [keys, offers] = await Promise.all([agentAccess.apiKeys.listByClient(client.id), commerce.offers.list()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={client.description ?? undefined}
        actions={<Button href="/agents" variant="ghost">
          ← Agentes
        </Button>}
      />

      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink">Estado:</span>
            <ClientStatusToggle clientId={client.id} status={client.status} />
          </div>
          <ForceReadOnlyToggle clientId={client.id} forceReadOnly={client.forceReadOnly} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Alcance de Offers</h2>
        <AllowedOfferIdsEditor
          clientId={client.id}
          allowedOfferIds={client.allowedOfferIds}
          offers={offers.map((offer) => ({ id: offer.id, name: offer.name }))}
        />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">ApiKeys</h2>
          <IssueKeyButton clientId={client.id} />
        </div>
        {keys.length === 0 ? (
          <EmptyState title="Sin keys todavía" description="Emití la primera key para que este agente pueda autenticarse." />
        ) : (
          <Table>
            <thead>
              <tr>
                <TableHeadCell className="w-[25%]">Prefix</TableHeadCell>
                <TableHeadCell className="w-[35%]">Scopes</TableHeadCell>
                <TableHeadCell className="w-[20%]">Estado</TableHeadCell>
                <TableHeadCell className="w-[20%]" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <ApiKeyRow key={key.id} clientId={client.id} apiKey={key} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
