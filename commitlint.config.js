const requiredBodySections = ['변경:', '이유:', 'AI 검토:']

const subjectHasKorean = ({ subject }) => [
  /[가-힣]/.test(subject ?? ''),
  '커밋 요약에는 한글을 한 글자 이상 포함해야 합니다.',
]

const bodyHasRequiredSections = ({ body }) => {
  const commitBody = body ?? ''
  const missingSections = requiredBodySections.filter(
    (section) => !commitBody.includes(section),
  )

  return [
    missingSections.length === 0,
    `커밋 본문에 ${missingSections.join(', ')} 항목이 필요합니다.`,
  ]
}

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'body-required-sections': bodyHasRequiredSections,
        'subject-has-korean': subjectHasKorean,
      },
    },
  ],
  rules: {
    'body-empty': [2, 'never'],
    'body-required-sections': [2, 'always'],
    'header-max-length': [2, 'always', 100],
    'scope-empty': [2, 'never'],
    'subject-has-korean': [2, 'always'],
  },
}
