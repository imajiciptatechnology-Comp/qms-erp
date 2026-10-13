import { getTrainingById } from "../../actions";
import { getCurrentUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import PrintAttendance from "./PrintAttendance";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const training = await getTrainingById(id);
  if (!training) redirect("/modules/training");

  return <PrintAttendance training={training} />;
}
