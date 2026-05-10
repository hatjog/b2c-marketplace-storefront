import { redirect } from 'next/navigation';

import { StorefrontStateSignal } from '@/components/atoms/StorefrontStateSignal/StorefrontStateSignal';
import { RegisterForm } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';
import { getMarketId } from '@/lib/helpers/market-filter';
import { resolveStorefrontState } from '@/lib/helpers/storefront-state';
import { logStorefrontStateEvaluated } from '@/lib/helpers/storefront-state-logger';

export default async function RegisterPage() {
  const user = await retrieveCustomer();

  if (user) {
    redirect('/user');
  }

  const _marketId = getMarketId();
  const _stateResult = resolveStorefrontState({ market_id: _marketId, is_recovered: true });
  logStorefrontStateEvaluated(_stateResult, 'auth-register', 'auth-register');

  return (
    <>
      <StorefrontStateSignal
        route="auth-register"
        state={_stateResult.state}
        stateDetail={_stateResult.state_detail}
        market={_stateResult.market_id}
        freshness={_stateResult.freshness}
      />
      <RegisterForm />
    </>
  );
}
