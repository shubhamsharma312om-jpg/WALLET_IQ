/**
 * SPENDGUARDIAN — Master Test Runner
 *
 * Runs all contract validation, adapter error handling, savings rules,
 * and canonical demo case tests. Can be invoked directly via CLI (`npm test` / `tsx tests/run-all-tests.ts`)
 * or imported into the backend API.
 */

import { testContracts } from './contracts.test.ts';
import { testAdapters } from './adapters.test.ts';
import { testSavingsRules } from './savings-rules.test.ts';
import { testGuardrailsAndCases } from './guardrails-and-cases.test.ts';
import { testBlock1Integration } from './block1-integration.test.ts';
import { testBlock2Engine } from './block2-decision-engine.test.ts';
import { testBlock3ActionEngine } from './block3-action-engine.test.ts';

export interface TestSuiteResult {
  suite: string;
  tests: Array<{ name: string; passed: boolean; message?: string }>;
  passedCount: number;
  totalCount: number;
}

export async function runAllTests(): Promise<{
  allPassed: boolean;
  totalTests: number;
  totalPassed: number;
  suites: TestSuiteResult[];
}> {
  const suites: TestSuiteResult[] = [];

  const contractTests = await testContracts();
  suites.push({
    suite: '1. Module Contracts & Schema Validation',
    tests: contractTests,
    passedCount: contractTests.filter((t) => t.passed).length,
    totalCount: contractTests.length,
  });

  const adapterTests = await testAdapters();
  suites.push({
    suite: '2. Adapter Error States & Fault Tolerance',
    tests: adapterTests,
    passedCount: adapterTests.filter((t) => t.passed).length,
    totalCount: adapterTests.length,
  });

  const savingsTests = await testSavingsRules();
  suites.push({
    suite: '3. Savings Rules Invariants (Potential vs Confirmed)',
    tests: savingsTests,
    passedCount: savingsTests.filter((t) => t.passed).length,
    totalCount: savingsTests.length,
  });

  const demoCaseTests = await testGuardrailsAndCases();
  suites.push({
    suite: '4. Guardrail Policies & Canonical Demo Cases (1, 2, 3)',
    tests: demoCaseTests,
    passedCount: demoCaseTests.filter((t) => t.passed).length,
    totalCount: demoCaseTests.length,
  });

  const block1Tests = await testBlock1Integration();
  suites.push({
    suite: '5. Block 1 Integration & Friend 1 Schema Transformation',
    tests: block1Tests,
    passedCount: block1Tests.filter((t) => t.passed).length,
    totalCount: block1Tests.length,
  });

  const block2Tests = await testBlock2Engine();
  suites.push({
    suite: '6. Block 2 Decision, Scoring & Guardrail Engine',
    tests: block2Tests,
    passedCount: block2Tests.filter((t) => t.passed).length,
    totalCount: block2Tests.length,
  });

  const block3Tests = await testBlock3ActionEngine();
  suites.push({
    suite: '7. Block 3 Action Execution & Escalation Engine',
    tests: block3Tests,
    passedCount: block3Tests.filter((t) => t.passed).length,
    totalCount: block3Tests.length,
  });

  const { testGmailProvider } = await import('./gmail-provider.test.ts');
  const gmailTests = await testGmailProvider();
  suites.push({
    suite: '8. Gmail Provider (Practical Mode)',
    tests: gmailTests,
    passedCount: gmailTests.filter((t) => t.passed).length,
    totalCount: gmailTests.length,
  });

  const totalTests = suites.reduce((sum, s) => sum + s.totalCount, 0);
  const totalPassed = suites.reduce((sum, s) => sum + s.passedCount, 0);
  const allPassed = totalPassed === totalTests;

  return {
    allPassed,
    totalTests,
    totalPassed,
    suites,
  };
}

// If executed directly from CLI via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('================================================================');
  console.log('SPENDGUARDIAN — Architecture & Contract Validation Test Runner');
  console.log('================================================================\n');

  runAllTests()
    .then((summary) => {
      for (const suite of summary.suites) {
        console.log(`\n--- ${suite.suite} (${suite.passedCount}/${suite.totalCount}) ---`);
        for (const t of suite.tests) {
          const statusIcon = t.passed ? '✓ PASS' : '✗ FAIL';
          console.log(`  [${statusIcon}] ${t.name}`);
          if (!t.passed && t.message) {
            console.log(`         Error: ${t.message}`);
          }
        }
      }

      console.log('\n================================================================');
      console.log(`TOTAL: ${summary.totalPassed}/${summary.totalTests} tests passed`);
      console.log('================================================================\n');

      if (!summary.allPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

