import { NextResponse } from 'next/server';
import { isStripeConfigured, getStripePublishableKey } from '@/lib/stripe';

export async function GET() {
  return NextResponse.json({
    configured: isStripeConfigured(),
    publishableKey: getStripePublishableKey(),
  });
}
