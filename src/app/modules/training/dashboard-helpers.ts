export { getTrainings } from "./actions";

import type { TrainingRecord } from "./actions";

export function getExpiryAlertsFromTrainings(trainings: TrainingRecord[], withinDays: number) {
  const alerts: { name: string; dept: string; trainingTitle: string; expiry: string; daysLeft: number }[] = [];
  const today = new Date(); today.setHours(0,0,0,0);

  trainings.filter(t => t.status === "Completed").forEach(t => {
    t.participants.forEach(p => {
      if (p.certificateExpiry) {
        const exp = new Date(p.certificateExpiry);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000*60*60*24));
        if (daysLeft <= withinDays) {
          alerts.push({ name: p.name, dept: p.department, trainingTitle: t.title, expiry: p.certificateExpiry, daysLeft });
        }
      }
    });
  });

  return alerts;
}
