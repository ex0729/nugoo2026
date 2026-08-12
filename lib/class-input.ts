export type ClassInput = {
  title?: string;
  institution?: string;
  contact?: string;
  classDate?: string;
  startTime?: string;
  endTime?: string;
  address?: string;
  targetGroup?: string;
  grade?: string;
  participantCount?: number;
  description?: string;
  assistantCount?: number;
  leadFee?: number;
  assistantFee?: number;
  feeNotes?: string;
  deadlineDate?: string;
  deadlineTime?: string;
  creationKey?: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function parseClassInput(body: ClassInput | null, options: { allowPastDeadline?: boolean } = {}) {
  const title = clean(body?.title);
  const institution = clean(body?.institution);
  const classDate = clean(body?.classDate);
  const startTime = clean(body?.startTime);
  const endTime = clean(body?.endTime);
  const address = clean(body?.address);
  const deadlineDate = clean(body?.deadlineDate);
  const deadlineTime = clean(body?.deadlineTime);
  const participantCount = Number(body?.participantCount);
  const assistantCount = Number(body?.assistantCount);
  const leadFee = Number(body?.leadFee);
  const assistantFee = assistantCount === 0 ? 0 : Number(body?.assistantFee);

  const responseDeadline = new Date(`${deadlineDate}T${deadlineTime}:00+09:00`);
  const classStartsAt = new Date(`${classDate}T${startTime}:00+09:00`);
  const invalid = title.length < 2 || title.length > 120
    || institution.length < 2 || institution.length > 120
    || address.length < 2 || address.length > 240
    || !datePattern.test(classDate) || !datePattern.test(deadlineDate)
    || !timePattern.test(startTime) || !timePattern.test(endTime) || !timePattern.test(deadlineTime)
    || startTime >= endTime || !Number.isInteger(participantCount) || participantCount < 1 || participantCount > 10000
    || !Number.isInteger(assistantCount) || assistantCount < 0 || assistantCount > 2
    || !Number.isInteger(leadFee) || leadFee < 0
    || !Number.isInteger(assistantFee) || assistantFee < 0
    || Number.isNaN(responseDeadline.getTime()) || Number.isNaN(classStartsAt.getTime())
    || responseDeadline >= classStartsAt
    || (!options.allowPastDeadline && responseDeadline <= new Date());

  if (invalid) return null;
  return {
    title,
    institution,
    contact: clean(body?.contact) || null,
    class_date: classDate,
    start_time: startTime,
    end_time: endTime,
    address,
    target_group: clean(body?.targetGroup) || "미정",
    grade: clean(body?.grade) || "미정",
    participant_count: participantCount,
    description: clean(body?.description),
    lead_count: 1,
    assistant_count: assistantCount,
    lead_fee: leadFee,
    assistant_fee: assistantFee,
    fee_notes: clean(body?.feeNotes),
    response_deadline: responseDeadline.toISOString(),
  };
}
