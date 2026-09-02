"use client";

import { useState } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

export interface AssignmentEmployee {
  id: string;
  firstName: string;
  lastName?: string | null;
  jobTitle?: string;
}

export function LeadAssignmentControl({
  inquiryId,
  assignedEmployeeId,
  employees,
  onChanged,
}: {
  inquiryId: string;
  assignedEmployeeId: string | null;
  employees: AssignmentEmployee[];
  onChanged: () => void;
}) {
  const { authorizedRequest } = useAuth();
  const [employeeId, setEmployeeId] = useState(assignedEmployeeId ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function assign() {
    if (reason.trim().length < 2) {
      setError("Add a reason for the assignment change.");
      return;
    }
    try {
      await authorizedRequest(`/inquiries/${inquiryId}/assignment`, {
        method: "PATCH",
        body: JSON.stringify({
          employeeId: employeeId || null,
          reason,
          responseTimeMinutes: 60,
        }),
      });
      setReason("");
      setError("");
      onChanged();
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "Unable to update assignment.",
      );
    }
  }

  return (
    <div className="manual-assignment">
      <label>
        <span>Lead owner</span>
        <select
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        >
          <option value="">Unassigned</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Reason</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this assignment changing?"
        />
      </label>
      <button
        disabled={
          (assignedEmployeeId ?? "") === employeeId || reason.trim().length < 2
        }
        onClick={() => void assign()}
      >
        Update owner
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}
