import {
  Card,
  StorefrontI18nLongContentProbe,
  StorefrontRouteStateSignal
} from '@/components/atoms';
import { ProfilePasswordForm } from '@/components/molecules/ProfilePasswordForm/ProfilePasswordForm';

export default async function ResetPasswordPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;

  return (
    <main className="container flex justify-center">
      <StorefrontRouteStateSignal
        route="auth-reset-password"
        surface="auth-forgot-password"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="password-reset"
      />
      <Card className="w-full max-w-lg">
        <ProfilePasswordForm token={token} />
      </Card>
    </main>
  );
}
