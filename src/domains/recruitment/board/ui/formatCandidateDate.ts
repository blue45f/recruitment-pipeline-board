const candidateCompactDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Seoul',
  year: 'numeric',
})

export function formatCandidateCompactDate(dateTime: string) {
  return candidateCompactDateFormatter.format(new Date(dateTime))
}
