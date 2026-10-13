"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export type SurveyResponse = {
  respondentName?: string;
  score: number; // 1-5
  comments?: string;
  submittedAt: string;
};

export type SatisfactionSurvey = {
  id: string;
  surveyNo: string;
  title: string;
  period: string;
  status: "Open" | "Closed";
  createdAt: string;
  closedAt?: string;
  responses: SurveyResponse[];
  avgScore?: number;
};

export async function getSurveys(): Promise<SatisfactionSurvey[]> {
  const surveys = await prisma.satisfactionSurvey.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  return surveys.map(s => ({
    id: s.id,
    surveyNo: s.surveyNo,
    title: s.title,
    period: s.period,
    status: s.status as any,
    createdAt: s.createdAt,
    closedAt: s.closedAt || undefined,
    avgScore: s.avgScore || undefined,
    responses: JSON.parse(s.responsesJson)
  }));
}

export async function createSurvey(data: { title: string; period: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const id = `SUR-${Date.now().toString().slice(-5)}`;
  const year = new Date().getFullYear();
  const count = await prisma.satisfactionSurvey.count() + 1;
  const surveyNo = `CSAT-${year}-${count.toString().padStart(3, "0")}`;

  await prisma.satisfactionSurvey.create({
    data: {
      id,
      surveyNo,
      title: data.title,
      period: data.period,
      status: "Open",
      createdAt: new Date().toISOString(),
      responsesJson: "[]"
    }
  });

  revalidatePath("/modules/complaint");
  return { success: true };
}

export async function addSurveyResponse(surveyId: string, response: Omit<SurveyResponse, "submittedAt">) {
  const survey = await prisma.satisfactionSurvey.findUnique({ where: { id: surveyId } });
  if (!survey) return { success: false };

  const responses = JSON.parse(survey.responsesJson) as SurveyResponse[];
  responses.push({ ...response, submittedAt: new Date().toISOString() });
  
  const scores = responses.map(r => r.score);
  const avgScore = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));

  await prisma.satisfactionSurvey.update({
    where: { id: surveyId },
    data: {
      responsesJson: JSON.stringify(responses),
      avgScore
    }
  });

  revalidatePath("/modules/complaint");
  return { success: true };
}

export async function closeSurvey(surveyId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.satisfactionSurvey.update({
    where: { id: surveyId },
    data: {
      status: "Closed",
      closedAt: new Date().toISOString().split("T")[0]
    }
  });

  revalidatePath("/modules/complaint");
  return { success: true };
}

export type ComplaintItem = {
  id: string;
  complaintNo: string;
  source: "Phone" | "Email" | "Walk-in" | "Survey" | "Social Media" | "Other";
  customerName: string;
  customerContact?: string;
  productService: string;
  complaintDate: string;
  description: string;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "Under Investigation" | "Action Taken" | "Closed" | "Rejected";
  immediateResponse?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  picName?: string;
  targetDate?: string;
  actualCloseDate?: string;
  customerSatisfied?: boolean;
  satisfactionScore?: number;
  feedbackNotes?: string;
  ncReferenceId?: string;
  ncReferenceNo?: string;
  slaTargetDays?: number; // SLA in working days
  history?: { id: string; date: string; userName: string; action: string; note?: string }[];
  createdAt: string;
};

export async function getComplaints(): Promise<ComplaintItem[]> {
  const complaints = await prisma.complaint.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  return complaints.map(c => ({
    id: c.id,
    complaintNo: c.complaintNo,
    source: c.source as any,
    customerName: c.customerName,
    customerContact: c.customerContact || undefined,
    productService: c.productService,
    complaintDate: c.complaintDate,
    description: c.description,
    category: c.category,
    severity: c.severity as any,
    status: c.status as any,
    immediateResponse: c.immediateResponse || undefined,
    rootCause: c.rootCause || undefined,
    correctiveAction: c.correctiveAction || undefined,
    preventiveAction: c.preventiveAction || undefined,
    picName: c.picName || undefined,
    targetDate: c.targetDate || undefined,
    actualCloseDate: c.actualCloseDate || undefined,
    customerSatisfied: c.customerSatisfied === null ? undefined : c.customerSatisfied,
    satisfactionScore: c.satisfactionScore || undefined,
    feedbackNotes: c.feedbackNotes || undefined,
    ncReferenceId: c.ncReferenceId || undefined,
    ncReferenceNo: c.ncReferenceNo || undefined,
    slaTargetDays: c.slaTargetDays,
    history: JSON.parse(c.historyJson),
    createdAt: c.createdAt
  }));
}

export async function addComplaint(data: {
  source: ComplaintItem["source"];
  customerName: string;
  customerContact?: string;
  productService: string;
  description: string;
  category: string;
  severity: ComplaintItem["severity"];
  picName?: string;
  targetDate?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const id = `COM-${Date.now().toString().slice(-5)}`;
  const year = new Date().getFullYear();
  const count = await prisma.complaint.count() + 1;
  const complaintNo = `CC-${year}-${count.toString().padStart(3, "0")}`;

  const slaDays: Record<string, number> = { Critical: 1, High: 3, Medium: 7, Low: 14 };

  const historyEntry = { id: Date.now().toString(), date: new Date().toISOString(), userName: user.name, action: "Complaint registered" };

  await prisma.complaint.create({
    data: {
      id,
      complaintNo,
      source: data.source,
      customerName: data.customerName,
      customerContact: data.customerContact,
      productService: data.productService,
      complaintDate: new Date().toISOString().split("T")[0],
      description: data.description,
      category: data.category,
      severity: data.severity,
      picName: data.picName,
      targetDate: data.targetDate,
      slaTargetDays: slaDays[data.severity] ?? 7,
      status: "Open",
      createdAt: new Date().toISOString(),
      historyJson: JSON.stringify([historyEntry])
    }
  });

  revalidatePath("/modules/complaint");
  return { success: true };
}

export async function updateComplaint(id: string, updates: Partial<ComplaintItem>, logAction?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) return { success: false };

  const dataToUpdate: any = {};
  if (updates.source) dataToUpdate.source = updates.source;
  if (updates.customerName) dataToUpdate.customerName = updates.customerName;
  if (updates.customerContact) dataToUpdate.customerContact = updates.customerContact;
  if (updates.productService) dataToUpdate.productService = updates.productService;
  if (updates.description) dataToUpdate.description = updates.description;
  if (updates.category) dataToUpdate.category = updates.category;
  if (updates.severity) dataToUpdate.severity = updates.severity;
  if (updates.picName) dataToUpdate.picName = updates.picName;
  if (updates.targetDate) dataToUpdate.targetDate = updates.targetDate;
  if (updates.immediateResponse !== undefined) dataToUpdate.immediateResponse = updates.immediateResponse;
  if (updates.rootCause !== undefined) dataToUpdate.rootCause = updates.rootCause;
  if (updates.correctiveAction !== undefined) dataToUpdate.correctiveAction = updates.correctiveAction;
  if (updates.preventiveAction !== undefined) dataToUpdate.preventiveAction = updates.preventiveAction;
  if (updates.customerSatisfied !== undefined) dataToUpdate.customerSatisfied = updates.customerSatisfied;
  if (updates.satisfactionScore !== undefined) dataToUpdate.satisfactionScore = updates.satisfactionScore;
  if (updates.feedbackNotes !== undefined) dataToUpdate.feedbackNotes = updates.feedbackNotes;
  if (updates.status) dataToUpdate.status = updates.status;

  if (updates.status === "Closed" && !updates.actualCloseDate) {
    dataToUpdate.actualCloseDate = new Date().toISOString().split("T")[0];
  } else if (updates.actualCloseDate) {
    dataToUpdate.actualCloseDate = updates.actualCloseDate;
  }

  if (logAction) {
    const history = JSON.parse(complaint.historyJson);
    history.push({ id: Date.now().toString(), date: new Date().toISOString(), userName: user.name, action: logAction });
    dataToUpdate.historyJson = JSON.stringify(history);
  }

  await prisma.complaint.update({
    where: { id },
    data: dataToUpdate
  });

  revalidatePath("/modules/complaint");
  return { success: true };
}

export async function escalateComplaintToNCR(complaintId: string, dueDate: string, severity: "Minor" | "Major" | "Critical") {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return { success: false, message: "Complaint not found" };

  if (complaint.ncReferenceId) return { success: false, message: "Sudah ada NCR terkait" };

  const { addNCR } = await import("@/app/modules/nc/actions");
  const result = await addNCR({
    source: "Customer Complaint",
    department: "Quality Assurance",
    description: `[Eskalasi dari ${complaint.complaintNo}] ${complaint.description}`,
    severity,
    dueDate,
    findingType: "NC",
  });

  if (!result.success) return { success: false };

  const ncNumber = result.data?.ncNumber;
  const ncId = result.data?.id;

  const history = JSON.parse(complaint.historyJson);
  history.push({ id: Date.now().toString(), date: new Date().toISOString(), userName: user.name, action: `Escalated to NCR: ${ncNumber}` });

  await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      ncReferenceId: ncId,
      ncReferenceNo: ncNumber,
      status: "Under Investigation",
      historyJson: JSON.stringify(history)
    }
  });

  revalidatePath("/modules/complaint");
  return { success: true, ncNumber, ncId };
}

export async function deleteComplaint(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.complaint.delete({ where: { id } });
  revalidatePath("/modules/complaint");
  return { success: true };
}
