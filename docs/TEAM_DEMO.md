# Team demo on Windows

Run these commands from the `analysis` folder. The launcher starts the production web app, the backend with its report evaluation worker, and the optional Python video-review service when its installed environment and model are present.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1 -OpenBrowser
```

Open `http://localhost:3000`. Servers run in the background without opening terminal windows. Running the command again reuses processes that the launcher owns. It refuses occupied ports owned by other processes.

## Before the presentation

1. Keep MongoDB running and check that `backend/.env` contains the database connection, JWT secret, and selected AI provider key.
2. Keep the existing frontend configuration pointed at the local backend. The default backend port is `5000`, and the frontend port is `3000`.
3. Check local prerequisites without starting servers or calling the AI provider.

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\check-demo.ps1 -Preflight
   ```

4. If the frontend changed since the last build, stop the demo and rebuild on startup.

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1
   powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1 -Rebuild -OpenBrowser
   ```

5. Use the fictional `demo/sample-resume.pdf` and matching `demo/sample-job-description.txt`. Resume uploads accept PDF; job-description attachments also accept TXT and DOCX. Rehearse the flow below once with the same account and browser you will use for the meeting.
6. Keep an internet connection for Gemini, remote code execution, and the editor's browser assets. API quotas and provider outages can affect requests even when local health checks pass.

The launcher does not install packages, rewrite environment files, delete data, or start MongoDB. Install Node.js 22 or newer and run `npm ci` in `backend` and `frontend` if dependencies are missing. The first launch builds the frontend if a production build is absent. A rebuild can take several minutes.

## A short presentation flow

1. Sign in and upload a sample resume. Open the analysis and point out that its suggestions are practice guidance.
2. Open the mentor chat and ask for a short learning plan for a role.
3. Start an interview with transcript consent. Meet the visible Alex interviewer, select Join with voice for the spoken greeting, then respond Ready to begin or A little nervous. Alex acknowledges the readiness check before asking the first real question. Join without audio remains available. Rehearse microphone permission on the presentation laptop beforehand; joining alone does not enable it. Optional recording has its own separate Start recording action.

   If an unfinished interview exists, the setup button says Resume interview and opens that saved room. During report generation it says View interview progress. Finish or explicitly discard an unfinished interview before starting one with new settings.
4. After Alex asks a question, choose Speak answer and allow the microphone, then use Finish answer. Gemini transcribes the response and the app submits it. Keep each spoken answer under two minutes. Subsequent questions can start listening automatically after playback once the microphone was explicitly enabled. Show that Captions and Type instead are optional. To demonstrate recovery, type part of another answer, reload, and show that its draft survives. A concrete project answer can receive one focused follow-up. Show the saved conversation, then pause and resume the same saved interview.
5. For a coding interview, choose a supported language and run a small solution. Explain execution output and the test result separately.
6. Finish the interview and open the saved report. AI evaluation can take some time. A failed evaluation has a retry action, and the saved answers remain available.
7. If demonstrating video, enable its consent, start recording explicitly, answer a question, stop recording, and finish. Show the recording playback in the report. Run the optional presence review only when it was consented to. It reports video observations separately from the interview score.
8. Show deletion with a disposable demo report or resume.

Use synthetic resume and interview content for this rehearsal. Keep a completed sample report in the account so you can discuss a result while another evaluation is processing.

## Coding example for the presentation

Choose a quick Coding / Programming Interview. Join and complete the welcome/readiness check. The first actual question is a coding task. When it asks for the sum of integers from standard input, use JavaScript:

```javascript
const fs = require('fs');
const input = fs.readFileSync(0, 'utf8').trim();
const values = input ? input.split(/\s+/).map(Number) : [];
console.log(values.reduce((sum, value) => sum + value, 0));
```

The three server-owned cases cover positive numbers, negative numbers and empty input. Change the final line to `console.log(0)` to show failed correctness cases. Restore the correct program before submitting. For questions without a defined task, the result explicitly says execution only. Java submissions must use `class Main`.

Code runs go to the configured official public Judge0 service at `https://ce.judge0.com`. This endpoint needs no API key. Keep submitted code synthetic. See [CODING_SETUP.md](CODING_SETUP.md) for private or RapidAPI options and all-language smoke checks.

## Storage check

With uploads idle, run the read-only audit:

```powershell
npm --prefix backend run storage:check
```

It prints aggregate missing-file, unsafe-path, orphan-chunk and byte-counter counts without filenames or personal information. Exit code `0` means no issues, `2` means findings, and `1` means the audit could not finish. It never modifies files or database records. Automated repair and retention are separate deployment work.

## Check and stop

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-demo.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1
```

Logs and process identities are under `test-results/demo/`, which Git ignores. The stop command checks each recorded process's creation time, executable, and command before stopping it. It preserves other applications and MongoDB.

Saved resumes, sessions, reports, and recording files remain after stopping and restarting. The default upload directory is `backend/uploads`; an optional `UPLOADS_DIR` setting can point to another persistent local folder. The Python service uses the same recording directory.

## If something fails

| Message or symptom | Action |
| --- | --- |
| MongoDB preflight fails | Start the configured MongoDB server and verify the connection locally in `backend/.env`. The check never prints the connection string. |
| A port is already occupied | Stop the specific server you previously started on that port. The launcher never terminates an untracked process. |
| Frontend build fails | Read the terminal error, fix the build, then rerun with `-Rebuild`. |
| Backend or frontend stops during startup | Read that service's `stderr.log` under `test-results/demo/`. |
| AI request fails | Check the selected provider's quota and key in the backend environment. Retry the saved operation from the app. |
| Camera or microphone fails | Continue with typed answers, or grant browser permissions and start recording again. |
| Video review is unavailable | Confirm `integrity-service/.venv/Scripts/python.exe` and the downloaded model exist. The default review port is `8001`. |
| Python is intentionally not needed | Start with `-WithoutVideoReview`. Transcript interviews and recording playback remain available. |

This workflow runs a local team demo. Hosting, backups, upload retention, and monitoring need separate deployment work. Health checks confirm local servers and configuration; actual AI and code execution requests verify external services.

## Launcher verification

Checked on 9 October 2026 on this Windows workspace:

- Local preflight passed for Node.js 22, provider configuration, and a real MongoDB connection.
- An unreachable MongoDB address failed preflight without starting application services or printing credentials.
- Initial startup and repeat startup passed for the backend, production frontend, and Python service on port `8001`.
- The stop command removed all managed service listeners, including the Windows Python interpreter child. MongoDB remained running.
- The health check reported database and storage ready, Gemini and code execution configured, and video review reachable.

Live provider and feature test results are recorded separately in [VERIFICATION.md](VERIFICATION.md).

## Prepared local demo account

The rehearsal created a synthetic account and completed report. Open ignored `test-results/demo/demo-login.txt` for login details and the report URL. Sign in at http://localhost:3000/login, then open the saved report or interview history. The report uses fictional answers/code and a simulated camera/microphone; no personal media was recorded.

The final report passed layout checks at 390, 768 and 1366 pixels, with no horizontal overflow or browser runtime errors. Its optional review is saved. Keep internet available during the presentation.

The conversational rehearsal has a separate fictional account in ignored `test-results/demo/conversation-login.txt`, with a completed Gemini report. Start a new interview to demonstrate the visible person, joining and readiness check, then use a concrete project answer to demonstrate a relevant follow-up. Saved interviews with answers resume their current question.
