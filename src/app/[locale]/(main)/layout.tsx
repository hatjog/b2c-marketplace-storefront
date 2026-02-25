import { Footer, Header } from "@/components/organisms"
import { fetchMarketConfig } from "@/lib/portal"
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
  const marketConfig = await fetchMarketConfig(
    process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID!
  )
  void marketConfig

  const user = await retrieveCustomer()
  const regionCheck = await checkRegion(locale)

  if (!regionCheck) {
    return redirect("/")
  }

  if (!APP_ID || !user)
    return (
      <>
        <Header locale={locale} />
        {children}
        <Footer />
      </>
    )

  return (
    <>
      <Session appId={APP_ID} userId={user.id}>
        <Header locale={locale} />
        {children}
        <Footer />
      </Session>
    </>
  )
}
