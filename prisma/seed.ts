import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';

const dataDir = path.join(process.cwd(), '.data');

function readJson(filename: string) {
  const filepath = path.join(dataDir, filename);
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

async function main() {
  console.log("Seeding database from JSON files...");

  // 1. NCRs
  const ncrs = readJson('ncr.json');
  for (const nc of ncrs) {
    await prisma.nCR.create({
      data: {
        id: nc.id,
        ncNumber: nc.ncNumber,
        source: nc.source || "System",
        department: nc.department,
        process: nc.process,
        description: nc.description,
        severity: nc.severity || "Minor",
        dateRaised: nc.dateRaised,
        dueDate: nc.dueDate,
        status: nc.status,
        findingType: nc.findingType,
        auditId: nc.auditId || null,
        containmentAction: nc.containmentAction || null,
        rcaJson: nc.rca ? JSON.stringify(nc.rca) : null,
        actionPlanJson: nc.actionPlan ? JSON.stringify(nc.actionPlan) : null,
        verificationJson: nc.verification ? JSON.stringify(nc.verification) : null,
        historyJson: JSON.stringify(nc.history || []),
      }
    });
  }
  console.log(`Seeded ${ncrs.length} NCRs`);

  // 2. Audits
  const audits = readJson('audits.json');
  for (const a of audits) {
    await prisma.audit.create({
      data: {
        id: a.id,
        auditNo: a.auditNo,
        department: a.department,
        plannedDate: a.plannedDate,
        actualDate: a.actualDate || null,
        leadAuditor: a.leadAuditor,
        leadAuditorId: a.leadAuditorId,
        status: a.status,
        auditType: a.auditType || null,
        findingsCount: a.findingsCount || 0,
        ofiCount: a.ofiCount || 0,
        findings: {
          create: a.findings?.map((f: any) => ({
            id: f.id,
            description: f.description,
            requirement: f.requirement,
            type: f.type,
            status: f.status,
            correctiveAction: f.correctiveAction || null,
          })) || []
        }
      }
    });
  }
  console.log(`Seeded ${audits.length} Audits`);

  // 3. HSE
  const hseData = readJson('hse.json');
  const incidents = hseData.incidents || [];
  const patrols = hseData.patrols || [];
  
  for (const i of incidents) {
    await prisma.incident.create({
      data: {
        id: i.id,
        date: i.date,
        time: i.time,
        location: i.location,
        type: i.type,
        description: i.description,
        severity: i.severity,
        status: i.status,
        actionsJson: JSON.stringify(i.actions || [])
      }
    });
  }
  
  for (const p of patrols) {
    await prisma.patrol.create({
      data: {
        id: p.id,
        date: p.date,
        area: p.area,
        inspector: p.inspector,
        findings: p.findings,
        isCompliance: p.isCompliance
      }
    });
  }
  console.log(`Seeded ${incidents.length} Incidents and ${patrols.length} Patrols`);

  console.log("Seeding complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
