import { commerce } from "@/lib/commerce";
import { PageHeader } from "@repo/admin-ui/primitives";
import { AgentClientForm } from "../agent-client-form";

export default async function NewAgentPage() {
  const offers = await commerce.offers.list();

  return (
    <div>
      <PageHeader title="Nuevo agente" />
      <AgentClientForm offers={offers.map((offer) => ({ id: offer.id, name: offer.name }))} />
    </div>
  );
}
