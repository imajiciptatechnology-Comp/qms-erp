export function getCalibrationStatus(nextDate?: string, status?: string): "Valid" | "Warning" | "Overdue" | "N/A" {
  if (status !== "Active") return "N/A";
  if (!nextDate) return "Overdue"; // Assuming active measuring equipment needs calibration

  const today = new Date();
  today.setHours(0,0,0,0);
  const next = new Date(nextDate);
  const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays <= 30) return "Warning";
  return "Valid";
}
