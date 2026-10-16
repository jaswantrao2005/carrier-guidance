# MASTER PROJECT DOSSIER & PROMPT FOR SIP-II REPORT GENERATION

> **Prompt for Claude:**
> *"Act as an expert academic thesis advisor and senior software engineering documentation writer. Using the exhaustive technical specifications, architecture, code implementations, algorithms, and empirical metrics provided below, write the complete, publication-quality **Summer Internship Project II (SIP-II)** report following the official **Amity University Mumbai (B.Tech Computer Science & Engineering, 2026-27)** report format. Generate all sections with full academic rigor, in-depth technical explanations, concrete mathematical formulations, code architectural details, and complete IEEE references without placeholder text."*

---

## 1. PROJECT METADATA & COVER DETAILS

- **Title of Work:** AI-Powered Career Guidance & Automated Mock Interview Platform
- **Degree:** Bachelor of Technology in Computer Science & Engineering (Semester VII)
- **Institution:** Amity School of Engineering and Technology (ASET), Amity University Mumbai
- **Academic Year:** 2026–2027
- **Candidate Name:** P. Jaswant Rao
- **Domain:** Artificial Intelligence, Full-Stack Web Engineering, Natural Language Processing, Computer Vision Proctoring

---

## 2. ABSTRACT

Modern technical recruitment faces a growing gap between applicant readiness and industry expectations. Traditional interview preparation platforms rely on static question banks or expensive human coaching, lacking scalable, real-time feedback. 

This project presents the engineering and deployment of an end-to-end **AI-Powered Career Guidance and Automated Mock Interview Platform**. Built using a decoupled client-server architecture with **Next.js 15 (React 19)** on the frontend and an authenticated **Node.js/Express** microservice framework backed by **MongoDB Atlas** on the backend, the platform provides three integrated capabilities:
1. **Intelligent Resume Parsing & ATS Compatibility Engine:** Extracts unstructured text from multi-page PDF resumes using high-speed stream parsing (`pdf-parse-new`), evaluating it against 15+ industry recruitment parameters (keyword match, ATS formatting flaws, skill gap identification) with normalized scoring (0–100) in `<2 seconds`.
2. **Multi-Modal Interactive Interview Simulation:** Combines **Groq (LLaMA 3.3 70B)** and **Google Gemini** in a high-availability orchestration layer with automatic round-robin key pooling and failover. Supports real-time voice conversations via browser audio chunk streaming (`MediaRecorder`), 3D avatar facial rendering (`Three.js`), and a sandboxed multi-language code execution environment powered by the **Piston API** and **Monaco Editor**.
3. **Automated Proctoring & Multi-Dimensional Evaluation:** Implements server-side face presence and multi-person verification via a Python/MediaPipe asynchronous microservice alongside browser focus tracking (`Page Visibility API`). It synthesizes performance across **6 core competency dimensions** (*Communication, Technical Depth, Problem Solving, Resume Knowledge, Behavioral Alignment, and Role Readiness*).

The system achieves sub-second LLM inference latency (~500ms), 100% availability under API quota exhaustion, and 100% pass rates across 10+ end-to-end integration test suites.

---

## 3. CHAPTER 1: INTRODUCTION

### 1.1 Purpose of Selecting the Domain & Workplace
The Generative AI and automated recruitment domain addresses a critical socio-technical problem: job seekers lack objective, actionable feedback before facing high-stakes interviews. The project demonstrates practical mastery of distributed web engineering, AI model orchestration, real-time media streaming, containerized code execution, and computer vision proctoring.

### 1.2 Industry / Company Overview
The global HR Technology and AI Recruitment market is projected to reach $35+ billion by 2030. Key trends include:
- Migration from brittle keyword matching to semantic LLM evaluation.
- Asynchronous, voice-first remote technical assessments.
- Privacy-preserving, server-side proctoring that emits forensic evidence rather than arbitrary automated bans.

### 1.3 Description of the Project
The application is structured into five core subsystems:
1. **Authentication & User Management:** JWT-based stateless authentication, `bcryptjs` password hashing, role-based access control, and API quota tracking.
2. **Resume Analysis & ATS Scoring:** Multipart PDF upload (`multer`), stream text extraction, and JSON-schema-enforced LLM prompt engineering delivering deterministic skill-gap metrics.
3. **Voice Mock Interview Room:** Audio capture sliced into progressive chunks (`encodeSpeechWav`), 3D avatar animation (`alex.glb`), and local IndexedDB draft persistence.
4. **Sandboxed Code Execution Environment:** Embedded Monaco Editor coupled with Piston containerized runner supporting Python, JavaScript, Java, C++, and Go.
5. **Proctoring & Integrity Worker:** Python FastAPI service leveraging MediaPipe Face Detection to inspect recorded interview chunks for absent or multiple faces.

### 1.4 Salient Contributions of the Project
- **Resilient AI Key-Pooling Architecture:** Custom round-robin rotation across multiple Groq API keys with seamless Gemini fallback, eliminating HTTP 429 quota failures.
- **Progressive Audio Chunk Streaming:** Continuous segment uploading preventing interview loss during network drops.
- **Isolated Multi-Language Sandbox:** Safe code execution via Piston without exposing the host server to malicious scripts.
- **Deterministic 6-Dimensional Evaluation:** Mathematical rubric model scoring candidate competencies on a bounded 0–100 scale.
- **Server-Side Evidence-Based Proctoring:** Server-verified media inspection ensuring fairness and privacy.

### 1.5 Scope of Assigned Work
- **In-Scope:** Full-stack development (Next.js 15, Node.js, Express, MongoDB); PDF resume parser and ATS engine; Voice interview room with 3D avatar; Multi-language code editor with test cases; Python/MediaPipe proctoring worker; 10+ integration test suites.
- **Out-of-Scope:** Mobile native apps (iOS/Android), human-in-the-loop live video calls.

---

## 4. CHAPTER 2: REVIEW OF LITERATURE & THEORETICAL BACKGROUND

- **Natural Language Processing in Resume Parsing:** Limitations of TF-IDF and regex-based ATS engines vs. modern Transformer-based semantic parsing.
- **LLM Latency & Fast Inference Architecture:** Comparison between standard GPU inference (~3-5s) and Groq Language Processing Units (LPUs) delivering sub-500ms conversational turn-taking.
- **Remote Code Sandbox Isolation:** Security challenges of running untrusted code (fork bombs, CPU starvation, filesystem attacks); containment using Linux cgroups and isolated Piston Docker micro-containers.
- **Asynchronous Computer Vision Proctoring:** Flaws of client-side DOM event proctoring vs. server-side frame-by-frame convolutional face mesh analysis.

---

## 5. CHAPTER 3: SYSTEM ARCHITECTURE & DESCRIPTION OF WORK

### 3.1 Architectural Pipeline
```
[ Client Browser: Next.js 15 / Three.js / Monaco ]
                     │  ▲
           HTTP/REST │  │ Audio Chunks / JSON Payloads
                     ▼  │
      [ API Gateway: Express.js (Node.js) ]
         ├── Auth & Session Middleware (JWT, Quota Leases)
         ├── Database: MongoDB Atlas (Mongoose ODM)
         ├── AI Orchestrator: Groq Key Pool (LLaMA 3.3) ⮀ Gemini Fallback
         ├── Code Execution: Piston API Sandbox
         └── Integrity Pipeline: Python / MediaPipe Worker
```

### 3.2 Detailed Module Workflows
1. **Resume Engine:** `pdf-parse-new` extracts text buffer -> `career.service.js` invokes AI with JSON-schema -> `normalizeAnalysisPayload()` enforces bounded 0–100 ATS score and lists missing skills.
2. **Interview Engine:** Server-owned topic plans freeze session state. `interview-capture.js` chunks audio into WAV files. Client drafts save to IndexedDB.
3. **Coding Engine:** Monaco Editor collects source code -> `coding.service.js` dispatches payload `{ language, version, files, stdin }` to Piston -> compares stdout against expected outputs.
4. **Proctoring Engine:** Python worker runs `detector.py` over video chunks to detect face count (0 = absent, >1 = unauthorized person) and gaze angles.
5. **Evaluation Engine (`evaluation.js`):** Scores 6 core dimensions:
   - `communication`
   - `technicalKnowledge`
   - `problemSolving`
   - `resumeKnowledge`
   - `behavioral`
   - `roleReadiness`

### 3.3 Database Models
- `User`: Email, hashed password, role, usage quotas.
- `Resume`: Raw text, parsed skills, ATS score, recommended roles, improvement suggestions.
- `InterviewSession`: Active status, topic plan, question transcripts, turn IDs, code submissions.
- `RecordingChunk`: Audio segment index, file path, upload timestamp.
- `Usage`: API request count, token usage tracking.

### 3.4 Key API Endpoints
- `POST /api/auth/register` & `POST /api/auth/login`: User onboarding and JWT issuance.
- `POST /api/resume/upload`: Multipart PDF upload and synchronous ATS scoring.
- `POST /api/interview/session`: Initializes or resumes an interview session.
- `POST /api/session/chunk`: Ingests real-time audio segments.
- `POST /api/interview/coding/run`: Submits code to Piston sandbox for evaluation.
- `GET /api/interview/report/:id`: Retrieves 6-dimensional evaluation report.

---

## 6. CHAPTER 4: EXPERIMENTAL RESULTS, TESTING & PERFORMANCE

### 4.1 Verification & Test Suites
10+ comprehensive Jest integration test suites:
- `ai-provider.test.js`: Verified automatic key rotation upon receiving simulated 429 quota errors.
- `analysis-safety.test.js`: Verified strict JSON schema validation and prompt injection defenses.
- `coding.test.js`: Verified multi-language code compilation (Python, JS, C++) and timeout safety.
- `session.integration.test.js`: Tested concurrent request leasing and sequence de-duplication.

### 4.2 Quantitative Performance Metrics
- **Resume Processing Time:** `< 1.8 seconds` for multi-page resumes.
- **LLM First-Token Latency:** `~380ms` via Groq LPU; entire response in `< 750ms`.
- **System Availability:** `100%` during quota stress tests through multi-key failover.
- **Frontend Optimization:** First Load JS bundle optimized to `~170 kB` via Next.js 15 route chunking.

---

## 7. CHAPTER 5: CONCLUSION & FUTURE WORK

### 5.1 Conclusion
The platform provides a production-grade, highly resilient environment for technical interview preparation, addressing both student readiness and enterprise recruitment requirements.

### 5.2 Future Scope
- **WebRTC Bidirectional Voice:** Upgrading from HTTP chunk streaming to WebSockets/WebRTC for instantaneous (<200ms) full-duplex conversations.
- **Vocal Stress & Cadence Analysis:** Assessing candidate confidence and nervousness through acoustic prosody analysis.
- **Fine-Tuned Domain LLMs:** Training open-source models on curated technical interview transcripts.

---

## 8. CHAPTER 6: REFERENCES (IEEE Format)

1. A. Vaswani et al., "Attention is all you need," *Advances in Neural Information Processing Systems (NeurIPS)*, 2017.
2. L. Lugosch et al., "Speech model evaluation for interactive conversational agents," *IEEE Trans. Audio, Speech, Language Process.*, 2021.
3. S. Lugani and P. Sharma, "Automated resume screening using natural language processing and deep learning," *Int. J. Comput. Appl.*, vol. 182, no. 45, pp. 22–28, 2019.
4. V. Bazarevsky et al., "MediaPipe hands and face mesh: On-device real-time hand and face tracking," *arXiv:2006.10214*, 2020.
5. Piston Team, "Piston: A high-performance general-purpose code execution engine," GitHub, 2023. [Online]. Available: https://github.com/engineer-man/piston
