import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { getPublicSetting } from '../api/settings'
import { sanitizeRichText } from '../utils/richText'

export default function AboutPage() {
  const [aboutMessage, setAboutMessage] = useState('')

  useEffect(() => {
    getPublicSetting('about_message')
      .then(setAboutMessage)
      .catch(() => setAboutMessage(''))
  }, [])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-900/30 dark:text-blue-300">
            <Info size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1E293B] dark:text-[#F1F5F9]">About</h1>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">Information about this workspace.</p>
          </div>
        </div>

        <div
          className="mt-6 text-sm text-[#1E293B] dark:text-[#F1F5F9] leading-6 [&_p]:mb-3 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(aboutMessage) }}
        />
      </div>
    </div>
  )
}
