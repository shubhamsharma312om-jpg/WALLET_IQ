import { classifyEmailType, detectCadence, isPromotionalEmail, hasRecurringEvidence, hasPaymentEvidence, hasSubscriptionEvidence, extractAmountFromText, extractMerchantFromSender } from './backend/adapters/gmail.provider.ts';

function testExtract(subject: string, bodyText: string, from: string): boolean {
  const combinedText = `${subject} ${bodyText}`.toLowerCase();
  
  const merchantFromSender = extractMerchantFromSender(from);
  let merchant = merchantFromSender !== 'Unknown Sender' ? merchantFromSender : null;

  if (!merchant || ['gmail', 'yahoo', 'outlook'].some(d => from.toLowerCase().includes(d))) {
    const knownMerchants = ['Spotify', 'Netflix', 'Amazon', 'Hulu', 'Disney', 'Apple', 'Adobe', 'Gym', 'Fitness', 'Dropbox', 'Microsoft', 'Uber'];
    for (const m of knownMerchants) {
      if (new RegExp(`\\b${m}\\b`, 'i').test(combinedText)) {
        merchant = m;
        break;
      }
    }
  }

  const amountResult = extractAmountFromText(combinedText);
  const cadence = detectCadence(subject, bodyText.slice(0, 500));

  if (!merchant) return false;

  const isPromo = isPromotionalEmail(subject, combinedText);
  const hasRec = hasRecurringEvidence(combinedText) || (cadence !== null);
  const hasPay = hasPaymentEvidence(combinedText);
  const hasSub = hasSubscriptionEvidence(combinedText);

  let isCandidate = false;
  if (isPromo) {
    if (amountResult && hasPay && hasSub) {
      isCandidate = true;
    }
  } else {
    if ((hasPay && hasRec && amountResult) || hasSub) {
      isCandidate = true;
    }
  }
  return isCandidate;
}

const cases = [
  { name: 'TEST 1: Marketing offer only', subject: 'Get Spotify Premium for $9.99/month', body: 'Sign up now.', from: 'Spotify <no-reply@spotify.com>', expected: false },
  { name: 'TEST 2: Genuine subscription candidate', subject: 'Spotify Premium payment confirmation', body: 'Your Spotify Premium monthly payment of $9.99 was processed. Next billing date: October 19.', from: 'Spotify <no-reply@spotify.com>', expected: true },
  { name: 'TEST 3: Amazon order payment', subject: 'Amazon order confirmation', body: 'Your Amazon order payment of ₹2,500 was successful.', from: 'Amazon <no-reply@amazon.in>', expected: false },
  { name: 'TEST 4: Uber payment', subject: 'Uber trip receipt', body: 'Your Uber payment of ₹450 was successful.', from: 'Uber <receipts@uber.com>', expected: false },
  { name: 'TEST 5: Electricity bill', subject: 'Bill Payment', body: 'Your electricity bill payment of ₹1,200 was successful.', from: 'Power Co <billing@power.com>', expected: false },
  { name: 'TEST 6: Free trial start', subject: 'Welcome to Premium', body: 'Start your 30-day free trial.', from: 'Netflix <info@netflix.com>', expected: false },
  { name: 'TEST 7: Free trial conversion', subject: 'Trial ended', body: 'Your free trial has ended and your monthly payment of $12.99 was processed. Your subscription is active.', from: 'Netflix <info@netflix.com>', expected: true },
  { name: 'TEST 8: Course promotion', subject: 'AI Masterclass', body: 'AI Masterclass — only ₹999 today!', from: 'CourseHub <offers@coursehub.com>', expected: false },
  { name: 'TEST 9: Newsletter with subscription keyword', subject: 'Weekly Newsletter', body: 'Read about the new subscription model for our product at $19.', from: 'Tech News <newsletter@technews.com>', expected: false },
  { name: 'TEST 10: Generic Gmail sender', subject: 'Spotify Premium payment confirmation', body: 'Your Spotify Premium monthly payment of $10.99 was processed. Your next billing date is October 19.', from: 'random@gmail.com', expected: true }
];

let failed = 0;
cases.forEach((c) => {
  const result = testExtract(c.subject, c.body, c.from);
  if (result === c.expected) {
    console.log(`✅ ${c.name} passed.`);
  } else {
    console.log(`❌ ${c.name} failed. Expected ${c.expected}, got ${result}.`);
    failed++;
  }
});
if (failed === 0) { console.log('All tests passed!'); process.exit(0); } else { console.log(`${failed} tests failed.`); process.exit(1); }
