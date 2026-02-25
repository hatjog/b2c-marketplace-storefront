import { Footer, Header } from "@/components/organisms"
import { resolveMarketConfig } from "@/lib/portal"
import { retrieveCustomer } from "@/lib/data/customer"
import { checkRegion } from "@/lib/helpers/check-region"
import { Session } from "@talkjs/react"
import { redirect } from "next/navigation"

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const APP_ID = process.env.NEXT_PUBLIC_TALKJS_APP_ID
  const { locale } = await params
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || ""
  const { marketConfig, usedFallback } = await resolveMarketConfig(marketId)
  const showFallbackBanner =
    usedFallback && process.env.NODE_ENV === "development"

  const user = await retrieveCustomer()
  const regionCheck = await checkRegion(locale)

  if (!regionCheck) {
    return redirect("/")
  }

  if (!APP_ID || !user)
    return (
      <>
        {showFallbackBanner && (
          <div className="bg-yellow-100 px-4 py-2 text-sm text-yellow-900">
            Korzystasz z fallback MarketConfig. Payload API jest niedostępne.
          </div>
        )}
        <Header locale={locale} marketConfig={marketConfig} />
        {children}
        <Footer />
      </>
    )

  return (
    <>
      <Session appId={APP_ID} userId={user.id}>
        {showFallbackBanner && (
          <div className="bg-yellow-100 px-4 py-2 text-sm text-yellow-900">
            Korzystasz z fallback MarketConfig. Payload API jest niedostępne.
          </div>
        )}
        <Header locale={locale} marketConfig={marketConfig} />
        {children}
        <Footer />
      </Session>
    </>
  )
}
