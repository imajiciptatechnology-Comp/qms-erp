"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface DesignChange {
  id: string;
  date: string;
  description: string;
  impactAnalysis: string;
  requester: string;
  reviewer?: string;
  status: "Pending" | "Approved" | "Rejected";
  documentAction?: "Create New Document" | "Revise Existing Document" | "No Document Change Needed";
  targetDocumentId?: string;
}

export interface DesignTask {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  status: "Pending" | "In Progress" | "Completed";
}

export interface DesignProject {
  id: string;
  projectName: string;
  description: string;
  picName: string;
  department: string;
  startDate: string;
  expectedEndDate: string;
  status: "Planning" | "Inputs" | "Controls" | "Outputs" | "Completed" | "Cancelled";
  tasks?: DesignTask[];
  
  planning: {
    resourcesNeeded: string;
    responsibilities: string;
    completed: boolean;
    completedAt?: string;
  };
  
  inputs: {
    functionalReqs: string;
    statutoryReqs: string;
    otherReqs: string;
    completed: boolean;
    completedAt?: string;
  };
  
  controls: {
    reviewMethod: string;
    verificationMethod: string;
    validationMethod: string;
    completed: boolean;
    completedAt?: string;
  };
  
  outputs: {
    deliverables: string;
    acceptanceCriteria: string;
    completed: boolean;
    completedAt?: string;
  };
  
  changes: DesignChange[];
}

const defaultPlanning = { resourcesNeeded: "", responsibilities: "", completed: false };
const defaultInputs = { functionalReqs: "", statutoryReqs: "", otherReqs: "", completed: false };
const defaultControls = { reviewMethod: "", verificationMethod: "", validationMethod: "", completed: false };
const defaultOutputs = { deliverables: "", acceptanceCriteria: "", completed: false };

function safeParse(jsonString: string, fallback: any) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

export async function getDesignProjects(): Promise<DesignProject[]> {
  const projects = await prisma.designProject.findMany({
    include: { tasks: true, changes: true },
    orderBy: { startDate: 'desc' }
  });
  
  return projects.map(p => ({
    id: p.id,
    projectName: p.projectName,
    description: p.description,
    picName: p.picName,
    department: p.department,
    startDate: p.startDate,
    expectedEndDate: p.expectedEndDate,
    status: p.status as any,
    tasks: p.tasks.map(t => ({...t, status: t.status as any})),
    changes: p.changes.map(c => ({
      ...c,
      status: c.status as any,
      documentAction: c.documentAction as any,
      targetDocumentId: c.targetDocumentId || undefined,
      reviewer: c.reviewer || undefined
    })),
    planning: safeParse(p.planningJson, defaultPlanning),
    inputs: safeParse(p.inputsJson, defaultInputs),
    controls: safeParse(p.controlsJson, defaultControls),
    outputs: safeParse(p.outputsJson, defaultOutputs),
  }));
}

export async function getDesignProject(id: string): Promise<DesignProject | null> {
  const p = await prisma.designProject.findUnique({
    where: { id },
    include: { tasks: true, changes: true }
  });
  if (!p) return null;
  
  return {
    id: p.id,
    projectName: p.projectName,
    description: p.description,
    picName: p.picName,
    department: p.department,
    startDate: p.startDate,
    expectedEndDate: p.expectedEndDate,
    status: p.status as any,
    tasks: p.tasks.map(t => ({...t, status: t.status as any})),
    changes: p.changes.map(c => ({
      ...c,
      status: c.status as any,
      documentAction: c.documentAction as any,
      targetDocumentId: c.targetDocumentId || undefined,
      reviewer: c.reviewer || undefined
    })),
    planning: safeParse(p.planningJson, defaultPlanning),
    inputs: safeParse(p.inputsJson, defaultInputs),
    controls: safeParse(p.controlsJson, defaultControls),
    outputs: safeParse(p.outputsJson, defaultOutputs),
  };
}

export async function addDesignProject(data: {
  projectName: string;
  description: string;
  picName: string;
  department: string;
  startDate: string;
  expectedEndDate: string;
}) {
  const id = `DES-${Date.now().toString().slice(-5)}`;
  
  await prisma.designProject.create({
    data: {
      id,
      ...data,
      status: "Planning",
      planningJson: JSON.stringify(defaultPlanning),
      inputsJson: JSON.stringify(defaultInputs),
      controlsJson: JSON.stringify(defaultControls),
      outputsJson: JSON.stringify(defaultOutputs),
    }
  });
  
  revalidatePath("/modules/design");
  return { success: true, id, message: "Design project created" };
}

export async function updateDesignStage(
  id: string, 
  stage: "planning" | "inputs" | "controls" | "outputs", 
  data: any,
  markCompleted: boolean = false
) {
  const p = await prisma.designProject.findUnique({ where: { id } });
  if (!p) return { success: false, message: "Project not found" };

  let currentJson = "{}";
  if (stage === "planning") currentJson = p.planningJson;
  if (stage === "inputs") currentJson = p.inputsJson;
  if (stage === "controls") currentJson = p.controlsJson;
  if (stage === "outputs") currentJson = p.outputsJson;

  const currentObj = safeParse(currentJson, {});
  const newObj = {
    ...currentObj,
    ...data,
    completed: markCompleted,
    completedAt: markCompleted ? new Date().toISOString() : currentObj.completedAt
  };

  let newStatus = p.status;
  if (markCompleted) {
    if (stage === "planning") newStatus = "Inputs";
    else if (stage === "inputs") newStatus = "Controls";
    else if (stage === "controls") newStatus = "Outputs";
    else if (stage === "outputs") newStatus = "Completed";
  }

  const updateData: any = { status: newStatus };
  if (stage === "planning") updateData.planningJson = JSON.stringify(newObj);
  if (stage === "inputs") updateData.inputsJson = JSON.stringify(newObj);
  if (stage === "controls") updateData.controlsJson = JSON.stringify(newObj);
  if (stage === "outputs") updateData.outputsJson = JSON.stringify(newObj);

  await prisma.designProject.update({
    where: { id },
    data: updateData
  });

  revalidatePath(`/modules/design/${id}`);
  revalidatePath("/modules/design");
  return { success: true };
}

export async function submitDesignChange(projectId: string, data: Omit<DesignChange, "id" | "status">) {
  const id = `CHG-${Date.now().toString().slice(-5)}`;
  
  await prisma.designChange.create({
    data: {
      id,
      projectId,
      ...data,
      status: "Pending"
    }
  });
  
  revalidatePath(`/modules/design/${projectId}`);
  return { success: true, id };
}

export async function reviewDesignChange(projectId: string, changeId: string, status: DesignChange["status"], reviewerName: string) {
  await prisma.designChange.update({
    where: { id: changeId },
    data: {
      status,
      reviewer: reviewerName
    }
  });
  
  revalidatePath(`/modules/design/${projectId}`);
  return { success: true };
}

export async function deleteDesignProject(id: string) {
  await prisma.designProject.delete({ where: { id } });
  revalidatePath("/modules/design");
  return { success: true };
}

export async function updateDesignTasks(projectId: string, tasks: DesignTask[]) {
  // Clear existing tasks
  await prisma.designTask.deleteMany({ where: { projectId } });
  
  // Insert new tasks
  for (const t of tasks) {
    await prisma.designTask.create({
      data: {
        id: t.id,
        projectId,
        title: t.title,
        assignedTo: t.assignedTo,
        dueDate: t.dueDate,
        status: t.status
      }
    });
  }
  
  revalidatePath(`/modules/design/${projectId}`);
  return { success: true };
}
