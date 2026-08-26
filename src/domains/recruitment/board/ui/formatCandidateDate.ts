const candidateCompactDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Seoul',
  year: 'numeric',
})

const candidateDetailDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'long',
  timeZone: 'Asia/Seoul',
})

export function formatCandidateCompactDate(dateTime: string) {
  return candidateCompactDateFormatter.format(new Date(dateTime))
}

export function formatCandidateDate(dateTime: string) {
  return candidateDetailDateFormatter.format(new Date(dateTime))
}
