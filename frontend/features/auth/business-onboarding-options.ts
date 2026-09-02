export const initialBusinessOnboardingValues = {
  businessName: "",
  ownerName: "",
  industry: "",
  phone: "",
  businessSize: "",
  monthlyRevenueRange: "",
  primaryBusinessGoal: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

export type BusinessOnboardingValues =
  typeof initialBusinessOnboardingValues;

export const businessSizeOptions = [
  { value: "JUST_ME", label: "Just me" },
  { value: "2_TO_10", label: "2–10 people" },
  { value: "11_TO_50", label: "11–50 people" },
  { value: "51_TO_200", label: "51–200 people" },
  { value: "201_PLUS", label: "201+ people" },
] as const;

export const monthlyRevenueOptions = [
  { value: "PRE_REVENUE", label: "Pre-revenue" },
  { value: "UNDER_1_LAKH", label: "Under ₹1 lakh" },
  { value: "1_TO_5_LAKH", label: "₹1–5 lakh" },
  { value: "5_TO_25_LAKH", label: "₹5–25 lakh" },
  { value: "25_LAKH_TO_1_CRORE", label: "₹25 lakh–₹1 crore" },
  { value: "ABOVE_1_CRORE", label: "Above ₹1 crore" },
] as const;

export const primaryBusinessGoalOptions = [
  { value: "GROW_SALES", label: "Grow sales" },
  { value: "IMPROVE_MARKETING", label: "Improve marketing" },
  { value: "MANAGE_CUSTOMERS", label: "Manage customers" },
  { value: "CONTROL_FINANCES", label: "Control finances" },
  { value: "AUTOMATE_OPERATIONS", label: "Automate operations" },
  { value: "MANAGE_TEAM", label: "Manage my team" },
] as const;

export const timezoneOptions = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
] as const;

export const currencyOptions = ["INR", "USD", "GBP", "EUR", "AED", "SGD"] as const;
