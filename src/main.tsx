import { bootstrap } from '@/app/bootstrap'
import '@/styles/globals.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  console.error('애플리케이션을 표시할 root 요소를 찾지 못했습니다.')
} else {
  void bootstrap(rootElement).catch((error: unknown) => {
    console.error('애플리케이션을 시작하지 못했습니다.', error)
  })
}
