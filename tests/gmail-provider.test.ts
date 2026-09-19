import {
  extractMerchantFromSender,
  extractAmountFromText,
  classifyEmailType,
  detectCadence,
} from '../backend/adapters/gmail.provider.ts';
import { EmailEvent } from '../backend/models/index.ts';

export async function testGmailProvider(): Promise<Array<{ name: string; passed: boolean; message?: string }>> {
  const results: Array<{ name: string; passed: boolean; message?: string }> = [];

  // ==========================================================================
  // Merchant Extraction Tests
  // ==========================================================================
  const merchantTests = [
    { input: 'Netflix <billing@netflix.com>', expected: 'Netflix' },
    { input: 'noreply@spotify.com', expected: 'Spotify' },
    { input: 'Amazon Prime Membership <no-reply@amazon.com>', expected: 'Amazon Prime Membership' },
    { input: '', expected: 'Unknown Sender' },
    { input: 'invalid-email-format', expected: 'Unknown Sender' },
  ];

  for (const test of merchantTests) {
    const output = extractMerchantFromSender(test.input);
    results.push({
      name: `Gmail - Merchant Extractor - "${test.input}"`,
      passed: output === test.expected,
      message: output !== test.expected ? `Expected "${test.expected}", got "${output}"` : undefined,
    });
  }

  // ==========================================================================
  // Amount Extraction Tests
  // ==========================================================================
  const amountTests = [
    { input: 'You were charged $14.99 for your subscription', expected: { amount: 14.99, currency: 'USD' } },
    { input: 'Your bill: USD 29.99', expected: { amount: 29.99, currency: 'USD' } },
    { input: '₹199.00 debited', expected: { amount: 199.00, currency: 'INR' } },
    { input: 'No amount here', expected: null },
    { input: '€9.99 monthly', expected: { amount: 9.99, currency: 'EUR' } },
    { input: '£12.50 next month', expected: { amount: 12.5, currency: 'GBP' } },
  ];

  for (const test of amountTests) {
    const output = extractAmountFromText(test.input);
    let passed = false;
    if (test.expected === null) {
      passed = output === null;
    } else {
      passed = output !== null && output.amount === test.expected.amount && output.currency === test.expected.currency;
    }
    results.push({
      name: `Gmail - Amount Extractor - "${test.input}"`,
      passed,
      message: !passed ? `Expected ${JSON.stringify(test.expected)}, got ${JSON.stringify(output)}` : undefined,
    });
  }

  // ==========================================================================
  // Email Classification Tests
  // ==========================================================================
  const classTests = [
    { subject: 'Upcoming price increase for your plan', snippet: '', expected: 'price_increase' },
    { subject: 'Your free trial is ending soon', snippet: '', expected: 'trial_ending' },
    { subject: 'Subscription renewed', snippet: '', expected: 'renewal_notice' },
    { subject: 'Your payment receipt', snippet: '', expected: 'receipt' },
    { subject: 'Cancellation confirmation', snippet: '', expected: 'cancellation_confirmation' },
    { subject: 'Welcome to our newsletter', snippet: '', expected: 'other' },
  ];

  for (const test of classTests) {
    const output = classifyEmailType(test.subject, test.snippet);
    results.push({
      name: `Gmail - Classifier - "${test.subject}"`,
      passed: output === test.expected,
      message: output !== test.expected ? `Expected "${test.expected}", got "${output}"` : undefined,
    });
  }

  // ==========================================================================
  // Cadence Detection Tests
  // ==========================================================================
  const cadenceTests = [
    { subject: 'Your monthly subscription', snippet: '', expected: 'monthly' },
    { subject: 'Annual plan renewed', snippet: '', expected: 'yearly' },
    { subject: 'Weekly digest', snippet: '', expected: 'weekly' },
    { subject: 'Quarterly billing statement', snippet: '', expected: 'quarterly' },
    { subject: 'One time purchase', snippet: '', expected: null },
  ];

  for (const test of cadenceTests) {
    const output = detectCadence(test.subject, test.snippet);
    results.push({
      name: `Gmail - Cadence - "${test.subject}"`,
      passed: output === test.expected,
      message: output !== test.expected ? `Expected "${test.expected}", got "${output}"` : undefined,
    });
  }

  return results;
}
