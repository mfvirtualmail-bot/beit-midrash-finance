'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

function PaymentSuccessContent() {
  const params = useSearchParams()
  const memberId = params.get('member_id')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={44} className="text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">תשלום התקבל!</h1>
          <p className="text-gray-500 text-sm">תודה על תשלומך. הרשומה עודכנה אוטומטית.</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700">התשלום עובד בהצלחה דרך Stripe ויופיע בדף החשבון שלך.</p>
        </div>
        <div className="flex flex-col gap-2">
          {memberId && (
            <Link
              href={`/members/${memberId}`}
              className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm"
            >
              צפה בדף החבר
            </Link>
          )}
          <Link
            href="/"
            className="block w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm"
          >
            חזרה לדף הראשי
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessContent />
    </Suspense>
  )
}
