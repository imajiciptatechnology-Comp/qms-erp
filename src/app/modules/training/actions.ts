"use server";

import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "training");

export type TrainingParticipant = {
  userId?: string;
  name: string;
  department: string;
  result?: "Pass" | "Fail" | "Attended";
  score?: number;
  certificateNo?: string;
  certificateExpiry?: string;
};

export type EffectivenessEvaluation = {
  evaluatorName?: string;
  evaluationDate?: string;
  method?: "Observation" | "Test/Exam" | "Interview" | "Work Result Review";
  result?: "Effective" | "Partially Effective" | "Not Effective";
  notes?: string;
  nextAction?: string;
};

export type TrainingRecord = {
  id: string;
  trainingNo: string;
  title: string;
  type: "Internal" | "External" | "On-the-Job" | "E-Learning" | "Certification";
  category: string;
  department: string;
  trainer: string;
  plannedDate: string;
  actualDate?: string;
  durationHours?: number;
  status: "Planned" | "Completed" | "Cancelled";
  objectives?: string;
  participants: TrainingParticipant[];
  evidenceFileName?: string;
  isoClause?: string;
  effectiveness?: EffectivenessEvaluation;
  passingScore?: number;
  ncReferenceId?: string;
  ncReferenceNo?: string;
  isMandatory?: boolean;
  reminderSent?: boolean;
  creatorId: string;
  lastUpdated: string;
};

export async function getTrainings(): Promise<TrainingRecord[]> {
  const trainings = await prisma.training.findMany({
    orderBy: { plannedDate: 'desc' }
  });

  return trainings.map(t => ({
    id: t.id,
    trainingNo: t.trainingNo,
    title: t.title,
    type: t.type as any,
    category: t.category,
    department: t.department,
    trainer: t.trainer,
    plannedDate: t.plannedDate,
    actualDate: t.actualDate || undefined,
    durationHours: t.durationHours || undefined,
    status: t.status as any,
    objectives: t.objectives || undefined,
    participants: JSON.parse(t.participantsJson),
    evidenceFileName: t.evidenceFileName || undefined,
    isoClause: t.isoClause || undefined,
    effectiveness: t.effectivenessJson ? JSON.parse(t.effectivenessJson) : undefined,
    passingScore: t.passingScore || undefined,
    ncReferenceId: t.ncReferenceId || undefined,
    ncReferenceNo: t.ncReferenceNo || undefined,
    isMandatory: t.isMandatory,
    reminderSent: t.reminderSent,
    creatorId: t.creatorId,
    lastUpdated: t.lastUpdated
  }));
}

export async function getTrainingById(id: string): Promise<TrainingRecord | null> {
  const t = await prisma.training.findUnique({ where: { id } });
  if (!t) return null;

  return {
    id: t.id,
    trainingNo: t.trainingNo,
    title: t.title,
    type: t.type as any,
    category: t.category,
    department: t.department,
    trainer: t.trainer,
    plannedDate: t.plannedDate,
    actualDate: t.actualDate || undefined,
    durationHours: t.durationHours || undefined,
    status: t.status as any,
    objectives: t.objectives || undefined,
    participants: JSON.parse(t.participantsJson),
    evidenceFileName: t.evidenceFileName || undefined,
    isoClause: t.isoClause || undefined,
    effectiveness: t.effectivenessJson ? JSON.parse(t.effectivenessJson) : undefined,
    passingScore: t.passingScore || undefined,
    ncReferenceId: t.ncReferenceId || undefined,
    ncReferenceNo: t.ncReferenceNo || undefined,
    isMandatory: t.isMandatory,
    reminderSent: t.reminderSent,
    creatorId: t.creatorId,
    lastUpdated: t.lastUpdated
  };
}

export async function addTraining(formData: FormData) {
  try {
    const user = await getCurrentUser();
    
    const year = new Date().getFullYear();
    const count = await prisma.training.count() + 1;
    const trainingNo = `TRG-${year}-${count.toString().padStart(3, "0")}`;

    const durationRaw = formData.get("durationHours") as string;
    const passingScoreRaw = formData.get("passingScore") as string;
    const ncReferenceId = formData.get("ncReferenceId") as string;
    const ncReferenceNo = formData.get("ncReferenceNo") as string;

    const id = Date.now().toString();

    await prisma.training.create({
      data: {
        id,
        trainingNo,
        title: formData.get("title") as string,
        type: formData.get("type") as string,
        category: formData.get("category") as string,
        department: formData.get("department") as string,
        trainer: formData.get("trainer") as string,
        plannedDate: formData.get("plannedDate") as string,
        durationHours: durationRaw ? parseFloat(durationRaw) : null,
        status: "Planned",
        objectives: (formData.get("objectives") as string) || null,
        isoClause: (formData.get("isoClause") as string) || null,
        passingScore: passingScoreRaw ? parseInt(passingScoreRaw) : null,
        ncReferenceId: ncReferenceId || null,
        ncReferenceNo: ncReferenceNo || null,
        isMandatory: formData.get("isMandatory") === "true",
        participantsJson: "[]",
        creatorId: user?.id || "system",
        lastUpdated: new Date().toISOString().split("T")[0],
      }
    });

    revalidatePath("/modules/training");

    // Notify users
    try {
      const { createNotificationForPermission } = await import("@/app/actions/notifications");
      await createNotificationForPermission(
        "training",
        `New training scheduled: ${trainingNo} — "${formData.get("title")}" (${formData.get("department")}, ${formData.get("plannedDate")})`,
        "/modules/training"
      );
    } catch {}

    return { success: true, message: "Training scheduled", id };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Failed to add training" };
  }
}

export async function editTraining(id: string, formData: FormData) {
  try {
    const durationRaw = formData.get("durationHours") as string;
    const passingScoreRaw = formData.get("passingScore") as string;
    const ncReferenceId = formData.get("ncReferenceId") as string;
    const ncReferenceNo = formData.get("ncReferenceNo") as string;

    await prisma.training.update({
      where: { id },
      data: {
        title: formData.get("title") as string,
        type: formData.get("type") as string,
        category: formData.get("category") as string,
        department: formData.get("department") as string,
        trainer: formData.get("trainer") as string,
        plannedDate: formData.get("plannedDate") as string,
        durationHours: durationRaw ? parseFloat(durationRaw) : null,
        objectives: (formData.get("objectives") as string) || null,
        isoClause: (formData.get("isoClause") as string) || null,
        passingScore: passingScoreRaw ? parseInt(passingScoreRaw) : null,
        ncReferenceId: ncReferenceId || null,
        ncReferenceNo: ncReferenceNo || null,
        isMandatory: formData.get("isMandatory") === "true",
        lastUpdated: new Date().toISOString().split("T")[0],
      }
    });

    revalidatePath("/modules/training");
    revalidatePath(`/modules/training/${id}`);
    return { success: true };
  } catch {
    return { success: false, message: "Failed to update training" };
  }
}

export async function updateEffectivenessEval(id: string, evaluation: EffectivenessEvaluation) {
  try {
    await prisma.training.update({
      where: { id },
      data: {
        effectivenessJson: JSON.stringify(evaluation),
        lastUpdated: new Date().toISOString().split("T")[0]
      }
    });
    revalidatePath(`/modules/training/${id}`);
    return { success: true };
  } catch {
    return { success: false, message: "Failed to save evaluation" };
  }
}

export async function updateTrainingStatus(id: string, status: string, actualDate?: string) {
  try {
    const dataToUpdate: any = { status, lastUpdated: new Date().toISOString().split("T")[0] };
    if (actualDate) dataToUpdate.actualDate = actualDate;
    
    await prisma.training.update({
      where: { id },
      data: dataToUpdate
    });
    revalidatePath("/modules/training");
    revalidatePath(`/modules/training/${id}`);
    return { success: true };
  } catch { return { success: false, message: "Failed to update" }; }
}

export async function addParticipant(trainingId: string, participant: Omit<TrainingParticipant, "result">) {
  try {
    const training = await prisma.training.findUnique({ where: { id: trainingId } });
    if (!training) return { success: false, message: "Training not found" };

    const participants = JSON.parse(training.participantsJson) as TrainingParticipant[];
    if (participants.find(p => p.name === participant.name)) return { success: false, message: "Participant already added" };

    participants.push({ ...participant, result: "Attended" });
    
    await prisma.training.update({
      where: { id: trainingId },
      data: {
        participantsJson: JSON.stringify(participants),
        lastUpdated: new Date().toISOString().split("T")[0]
      }
    });
    revalidatePath(`/modules/training/${trainingId}`);
    return { success: true };
  } catch { return { success: false, message: "Failed to add participant" }; }
}

export async function updateParticipantResult(
  trainingId: string,
  participantName: string,
  updates: Pick<TrainingParticipant, "result" | "score" | "certificateNo" | "certificateExpiry">
) {
  try {
    const training = await prisma.training.findUnique({ where: { id: trainingId } });
    if (!training) return { success: false, message: "Not found" };
    
    const participants = JSON.parse(training.participantsJson) as TrainingParticipant[];
    const pIdx = participants.findIndex(p => p.name === participantName);
    if (pIdx === -1) return { success: false, message: "Participant not found" };

    const passingScore = training.passingScore;
    let finalResult = updates.result;
    if (passingScore !== null && passingScore !== undefined && updates.score !== undefined) {
      finalResult = updates.score >= passingScore ? "Pass" : "Fail";
    }

    participants[pIdx] = { ...participants[pIdx], ...updates, result: finalResult };
    
    await prisma.training.update({
      where: { id: trainingId },
      data: {
        participantsJson: JSON.stringify(participants),
        lastUpdated: new Date().toISOString().split("T")[0]
      }
    });
    revalidatePath(`/modules/training/${trainingId}`);
    return { success: true };
  } catch { return { success: false, message: "Failed to update" }; }
}

export async function addParticipantsBulk(trainingId: string, participants: Omit<TrainingParticipant, "result">[]) {
  try {
    const training = await prisma.training.findUnique({ where: { id: trainingId } });
    if (!training) return { success: false, message: "Training not found" };

    const existingParticipants = JSON.parse(training.participantsJson) as TrainingParticipant[];
    const existingNames = new Set(existingParticipants.map(p => p.name));
    
    const newOnes = participants.filter(p => !existingNames.has(p.name));
    newOnes.forEach(p => existingParticipants.push({ ...p, result: "Attended" }));
    
    await prisma.training.update({
      where: { id: trainingId },
      data: {
        participantsJson: JSON.stringify(existingParticipants),
        lastUpdated: new Date().toISOString().split("T")[0]
      }
    });
    revalidatePath(`/modules/training/${trainingId}`);
    return { success: true, added: newOnes.length, skipped: participants.length - newOnes.length };
  } catch { return { success: false, message: "Failed to add participants" }; }
}

export async function removeParticipant(trainingId: string, participantName: string) {
  try {
    const training = await prisma.training.findUnique({ where: { id: trainingId } });
    if (!training) return { success: false };
    
    let participants = JSON.parse(training.participantsJson) as TrainingParticipant[];
    participants = participants.filter(p => p.name !== participantName);
    
    await prisma.training.update({
      where: { id: trainingId },
      data: {
        participantsJson: JSON.stringify(participants),
        lastUpdated: new Date().toISOString().split("T")[0]
      }
    });
    revalidatePath(`/modules/training/${trainingId}`);
    return { success: true };
  } catch { return { success: false }; }
}

export async function uploadTrainingEvidence(trainingId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, message: "No file provided" };

  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const ext = path.extname(file.name);
    const fileName = `${trainingId}_${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);

    await prisma.training.update({
      where: { id: trainingId },
      data: { evidenceFileName: fileName, lastUpdated: new Date().toISOString().split("T")[0] }
    });

    revalidatePath(`/modules/training/${trainingId}`);
    return { success: true, message: "Evidence uploaded" };
  } catch {
    return { success: false, message: "Failed to upload evidence" };
  }
}

export async function getTrainingCSV(): Promise<string> {
  const { buildExcel } = await import("@/lib/excel");
  const list = await getTrainings();

  const rows = list.map(t => {
    const pass = t.participants.filter(p => p.result === "Pass").length;
    const fail = t.participants.filter(p => p.result === "Fail").length;
    const attended = t.participants.filter(p => p.result === "Attended").length;
    return {
      trainingNo:    t.trainingNo,
      title:         t.title,
      type:          t.type,
      category:      t.category,
      department:    t.department,
      trainer:       t.trainer || "-",
      plannedDate:   t.plannedDate,
      actualDate:    t.actualDate || "-",
      duration:      t.durationHours ? `${t.durationHours} jam` : "-",
      status:        t.status,
      mandatory:     t.isMandatory ? "Yes" : "No",
      isoClause:     t.isoClause || "-",
      participants:  t.participants.length,
      pass:          pass,
      fail:          fail,
      attended:      attended,
      passingScore:  t.passingScore !== undefined ? `≥ ${t.passingScore}` : "-",
      ncrRef:        t.ncReferenceNo || "-",
      effectiveness: t.effectiveness?.result || "-",
    };
  });

  return buildExcel({
    sheetName: "Training Records",
    title: "REKAP TRAINING & KOMPETENSI",
    subtitle: `ISO 9001:2015 Clause 6.2 & 7.2 — Generated: ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}`,
    columns: [
      { header: "Training No.",   key: "trainingNo",    width: 16 },
      { header: "Training Title", key: "title",         width: 40 },
      { header: "Type",           key: "type",          width: 14 },
      { header: "Category",       key: "category",      width: 18 },
      { header: "Department",     key: "department",    width: 20 },
      { header: "Trainer / Inst.", key: "trainer",      width: 22 },
      { header: "Planned Date",   key: "plannedDate",   width: 14 },
      { header: "Actual Date",    key: "actualDate",    width: 14 },
      { header: "Duration",       key: "duration",      width: 12 },
      { header: "Status",         key: "status",        width: 12 },
      { header: "Mandatory",      key: "mandatory",     width: 12 },
      { header: "ISO Clause",     key: "isoClause",     width: 14 },
      { header: "Participants",   key: "participants",  width: 10 },
      { header: "Pass",           key: "pass",          width: 8  },
      { header: "Fail",           key: "fail",          width: 8  },
      { header: "Attended",       key: "attended",      width: 10 },
      { header: "Min. Score",     key: "passingScore",  width: 12 },
      { header: "NCR Ref",        key: "ncrRef",        width: 16 },
      { header: "Efektivitas",    key: "effectiveness", width: 20 },
    ],
    rows,
  });
}

export async function sendUpcomingReminders() {
  return { sent: 0 };
}

export async function getMandatoryCompliance(allSystemUsers: { id: string; name: string; department: string }[]) {
  const trainings = await getTrainings();
  const mandatory = trainings.filter(t => t.isMandatory && t.status !== "Cancelled");

  return mandatory.map(t => {
    const targetUsers = t.department === "All Departments"
      ? allSystemUsers
      : allSystemUsers.filter(u => u.department === t.department);

    const completed = t.participants
      .filter(p => p.result === "Pass" || p.result === "Attended")
      .map(p => p.name);

    const pending = targetUsers.filter(u => !completed.includes(u.name)).map(u => u.name);

    return {
      id: t.id,
      trainingNo: t.trainingNo,
      title: t.title,
      department: t.department,
      plannedDate: t.plannedDate,
      status: t.status,
      completed,
      pending,
      complianceRate: targetUsers.length > 0 ? Math.round((completed.length / targetUsers.length) * 100) : 0,
    };
  });
}

export type MandatoryComplianceRow = Awaited<ReturnType<typeof getMandatoryCompliance>>[number];

export async function getEmployeeTranscript(employeeName: string) {
  const trainings = await getTrainings();
  const records = trainings
    .filter(t => t.participants.some(p => p.name === employeeName))
    .map(t => {
      const participant = t.participants.find(p => p.name === employeeName)!;
      return {
        trainingId: t.id,
        trainingNo: t.trainingNo,
        title: t.title,
        type: t.type,
        category: t.category,
        date: t.actualDate || t.plannedDate,
        status: t.status,
        durationHours: t.durationHours,
        result: participant.result,
        score: participant.score,
        certificateNo: participant.certificateNo,
        certificateExpiry: participant.certificateExpiry,
        isMandatory: t.isMandatory,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return records;
}

export type TranscriptRow = Awaited<ReturnType<typeof getEmployeeTranscript>>[number];

export type CompetencyRequirement = {
  id: string;
  department: string;
  requiredCategories: string[];
  lastUpdated: string;
};

export async function getCompetencyRequirements(): Promise<CompetencyRequirement[]> {
  const reqs = await prisma.competencyRequirement.findMany();
  return reqs.map(r => ({
    id: r.id,
    department: r.department,
    requiredCategories: JSON.parse(r.requiredCategories),
    lastUpdated: r.lastUpdated
  }));
}

export async function saveCompetencyRequirements(requirements: CompetencyRequirement[]) {
  try {
    for (const req of requirements) {
      await prisma.competencyRequirement.upsert({
        where: { id: req.id },
        update: {
          department: req.department,
          requiredCategories: JSON.stringify(req.requiredCategories),
          lastUpdated: req.lastUpdated
        },
        create: {
          id: req.id,
          department: req.department,
          requiredCategories: JSON.stringify(req.requiredCategories),
          lastUpdated: req.lastUpdated
        }
      });
    }
    revalidatePath("/modules/training");
    return { success: true };
  } catch { return { success: false }; }
}

export async function getCompetencyGap() {
  const [trainings, requirements] = await Promise.all([getTrainings(), getCompetencyRequirements()]);

  const employeeCompetencies = new Map<string, { dept: string; categories: Set<string> }>();

  trainings
    .filter(t => t.status === "Completed")
    .forEach(t => {
      t.participants.forEach(p => {
        if (p.result === "Pass" || p.result === "Attended") {
          if (!employeeCompetencies.has(p.name)) {
            employeeCompetencies.set(p.name, { dept: p.department, categories: new Set() });
          }
          employeeCompetencies.get(p.name)!.categories.add(t.category);
        }
      });
    });

  const gaps: {
    department: string;
    requiredCategories: string[];
    employees: { name: string; hasCategories: string[]; missingCategories: string[] }[];
  }[] = [];

  for (const req of requirements) {
    if (req.requiredCategories.length === 0) continue;

    const deptEmployees = Array.from(employeeCompetencies.entries())
      .filter(([, v]) => v.dept === req.department);

    gaps.push({
      department: req.department,
      requiredCategories: req.requiredCategories,
      employees: deptEmployees.map(([name, v]) => ({
        name,
        hasCategories: req.requiredCategories.filter(c => v.categories.has(c)),
        missingCategories: req.requiredCategories.filter(c => !v.categories.has(c)),
      })),
    });
  }

  return gaps;
}

export async function deleteTraining(id: string) {
  try {
    await prisma.training.delete({ where: { id } });
    revalidatePath("/modules/training");
    return { success: true };
  } catch { return { success: false }; }
}
