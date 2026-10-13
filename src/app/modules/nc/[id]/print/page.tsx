import { getNCRById } from "../../actions";
import { getCurrentUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import PrintCapa from "./PrintCapa";

export default async function NcPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const ncr = await getNCRById(id);
  if (!ncr) redirect("/modules/nc");

  return <PrintCapa ncr={ncr} />;
}
