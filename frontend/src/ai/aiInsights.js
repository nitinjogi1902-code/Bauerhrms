/*
 * Lightweight deterministic insight helpers.
 * These do not call an AI model. They provide immediate UI intelligence
 * while the backend AI layer is being connected.
 */

export function buildBasicInsights({
  employees = [],
  attendance = [],
  agreements = [],
  recruitment = {},
}) {
  const insights = [];

  const employeeRows = Array.isArray(employees) ? employees : [];
  const attendanceRows = Array.isArray(attendance) ? attendance : [];
  const agreementRows = Array.isArray(agreements) ? agreements : [];

  const incomplete = employeeRows.filter((employee) => {
    const missing = [
      employee?.department,
      employee?.designation,
      employee?.dateOfJoining,
    ].filter((v) => !v);
    return missing.length >= 1;
  });

  if (incomplete.length) {
    insights.push({
      type: "warning",
      title: "Employee data quality",
      text: `${incomplete.length} employee record(s) need data-quality review.`,
      action: "Review employee data",
    });
  }

  const lateRows = attendanceRows.filter((row) => {
    const time = String(row?.inTime || row?.checkIn || "");
    return time && time > "09:30";
  });

  if (lateRows.length) {
    insights.push({
      type: "info",
      title: "Attendance pattern",
      text: `${lateRows.length} attendance record(s) show late check-in after 09:30.`,
      action: "Review attendance",
    });
  }

  if (agreementRows.length) {
    const expiring = agreementRows.filter((agreement) => {
      const date = new Date(agreement?.endDate || agreement?.end || "");
      if (Number.isNaN(date.getTime())) return false;
      const days = (date - new Date()) / 86400000;
      return days >= 0 && days <= 60;
    });

    if (expiring.length) {
      insights.push({
        type: "warning",
        title: "Vendor agreements",
        text: `${expiring.length} agreement(s) expire within the next 60 days.`,
        action: "Review vendor agreements",
      });
    }
  }

  const candidates = Array.isArray(recruitment?.candidates)
    ? recruitment.candidates
    : [];

  if (candidates.length) {
    insights.push({
      type: "success",
      title: "Recruitment pipeline",
      text: `${candidates.length} candidate record(s) are currently available for pipeline review.`,
      action: "Open recruitment",
    });
  }

  return insights.slice(0, 6);
}
