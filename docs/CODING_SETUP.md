# Coding execution for the local team demo

The backend runs coding submissions through Judge0. The four languages offered by the editor are JavaScript, Python, Java and C++. Two interview problems have three server-owned tests each. A successful run and a correct solution are separate verdicts; compiler and runtime errors are shown to the candidate.

## Public hosted Judge0

Set these values in the ignored `backend/.env`, then restart the backend:

```dotenv
JUDGE0_URL=https://ce.judge0.com
JUDGE0_API_KEY=
JUDGE0_AUTH_TOKEN=
```

This is the official public Judge0 CE endpoint. It requires an internet connection. The official endpoint was accessible without an API key during verification. Source code and test inputs are sent to that hosted service; use synthetic demo code and do not treat this as private storage or a service with guaranteed uptime.

The adapter submits with `wait=false` and polls the returned token. The official endpoint disables `wait=true`. The three test cases run concurrently with a shared 45-second deadline, 2-second CPU and 5-second wall limits per submission, a 128 MB memory limit, and networking disabled.

If the sandbox is unavailable or rate limited, the app shows an actionable error. A failed sandbox request does not prevent saving and submitting the answer for AI feedback.

## Re-run live verification

From the repository root:

```powershell
node backend/scripts/verify-coding.js
```

The script defaults to the official public endpoint. To test a different instance, set `JUDGE0_URL` in the shell first. It sends only synthetic programs, and verifies correct sums in all four languages, an incorrect JavaScript result, the first-unique-character problem, and a Java compiler error. Unlike the unit tests, this requires actual internet access and available Judge0 workers.

Live verification on 9 October 2026 passed all seven checks against `https://ce.judge0.com`: JavaScript, Python, Java and C++ each passed all three sum tests; deliberately incorrect JavaScript passed zero tests while still completing execution; Python passed all three first-unique tests; invalid Java failed compilation. Individual requests took approximately 0.8–2.8 seconds during this run. This proves current connectivity and execution, not future availability.

Run adapter tests without an external service:

```powershell
node --test backend/tests/coding.test.js backend/tests/analysis-safety.test.js
```

All eight tests in those two files passed, including queued submission recovery, authentication headers, and safe handling of malformed or unavailable sandboxes.

## Other Judge0 installations

- RapidAPI: set `JUDGE0_URL` to its Judge0 endpoint and `JUDGE0_API_KEY` to the RapidAPI key. The backend adds RapidAPI headers only for a RapidAPI hostname.
- Your own Judge0: set `JUDGE0_URL` to the installation URL. If authentication is enabled, set `JUDGE0_AUTH_TOKEN`; the backend sends it as `X-Auth-Token`.

The official Judge0 release supports Linux installations and requires a compatible sandbox/cgroup setup. Docker Desktop was installed on this Windows machine, but its Linux daemon was stopped. No containers or privileged services were started for this demo.

References: [official Judge0 CE API documentation](https://ce.judge0.com/), [official Judge0 installation and security release](https://github.com/judge0/judge0/releases/tag/v1.13.1).
