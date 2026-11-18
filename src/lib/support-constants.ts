// Brauzerda ham ishlatiladigan support konstantalari (Node modullarisiz)
export const SUPPORT_LIMITS = {
  NAME_MAX: 80, SUBJECT_MAX: 120, MESSAGE_MIN: 10, MESSAGE_MAX: 2000, REPLY_MAX: 4000,
  PER_EMAIL_HOUR: 3, PER_IP_HOUR: 5,
} as const;

// Formadagi mavzu kodlari → admin ko'radigan matn
export const SUPPORT_SUBJECTS: Record<string, string> = {
  general: "Umumiy savol", payment: "To'lov muammosi", account: "Akkaunt muammosi",
  trainer: "Trener bo'lish", bug: "Xatolik xabari", suggestion: "Taklif",
};
