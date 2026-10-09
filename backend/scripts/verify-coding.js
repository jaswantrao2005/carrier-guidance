// Live smoke check: only synthetic programs are sent to the configured Judge0.
const assert = require('node:assert/strict');
const { execute } = require('../src/services/interview/coding.service');

process.env.JUDGE0_URL ||= 'https://ce.judge0.com';
const cases = [
  { name: 'JavaScript correct sum', language: 'javascript', problem: 'sum_integers', passed: true,
    code: "const s=require('fs').readFileSync(0,'utf8').trim(); console.log(s ? s.split(/\\s+/).reduce((sum,n)=>sum+Number(n),0) : 0);" },
  { name: 'Python correct sum', language: 'python', problem: 'sum_integers', passed: true,
    code: "import sys\nprint(sum(map(int, sys.stdin.read().split())))" },
  { name: 'Java correct sum', language: 'java', problem: 'sum_integers', passed: true,
    code: "import java.util.Scanner; public class Main { public static void main(String[] args) { Scanner in=new Scanner(System.in); long total=0; while(in.hasNextLong()) total+=in.nextLong(); System.out.println(total); }}" },
  { name: 'C++ correct sum', language: 'cpp', problem: 'sum_integers', passed: true,
    code: "#include <iostream>\nint main(){long long value,total=0;while(std::cin>>value)total+=value;std::cout<<total<<'\\n';}" },
  { name: 'JavaScript incorrect sum', language: 'javascript', problem: 'sum_integers', passed: false,
    code: 'console.log(999)' },
  { name: 'Python correct first unique', language: 'python', problem: 'first_unique', passed: true,
    code: "import sys\nfrom collections import Counter\ns=sys.stdin.read().strip()\ncounts=Counter(s)\nprint(next((c for c in s if counts[c]==1), 'NONE'))" },
  { name: 'Java compilation failure', language: 'java', problem: 'sum_integers', passed: false, executed: false,
    code: 'this is intentionally invalid Java' },
];

(async () => {
  console.log(`Sandbox: ${new URL(process.env.JUDGE0_URL).origin}`);
  for (const check of cases) {
    const start = Date.now();
    const result = await execute(check.language, check.code, check.problem);
    assert.equal(result.passed, check.passed, `${check.name}: correctness verdict mismatch\n${result.output}`);
    assert.equal(result.executed, check.executed ?? true, `${check.name}: execution verdict mismatch\n${result.output}`);
    assert.equal(result.testedCases, 3);
    console.log(`PASS ${check.name}: ${result.passedCases}/${result.testedCases} tests, ${Date.now() - start}ms request`);
  }
  console.log('PASS all live coding checks');
})().catch(error => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
