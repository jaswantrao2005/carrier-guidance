# 🚀 AI Career Guidance Platform

A modern, AI-powered career guidance platform designed to help students and professionals discover career opportunities, evaluate their resume strength, practice live interviews, and receive personalized career insights.

## ✨ What This Project Does

The platform combines a beautiful, glassmorphism frontend experience with a robust backend API to support the following experiences:

- **Authentication**: Secure user registration and login with JWT-based access control.
- **Resume Upload**: A seamless drag-and-drop file upload zone that validates and securely transmits PDF files.
- **AI-Powered Analysis**: The backend parses PDF text and interfaces with **Groq AI (Llama-3.3-70b-versatile)** to extract skills, evaluate ATS scores, and recommend tailored career paths.
- **Career Dashboard**: A dynamic user dashboard displaying visual ATS score gauges, categorized skill tags (Technical, Soft, Missing), and role recommendations.
- **AI Career Mentor Chatbot**: An intelligent, context-aware chatbot powered by **Groq** that uses the user's latest resume analysis to generate personalized, step-by-step roadmaps for their dream role.
- **AI Voice Mock Interview**: An immersive mock interview room with a text-to-speech (TTS) and speech-to-text (STT) interface. Practices custom or standard career roles over a 10-question funnel (introduction, background, resume deep-dive, technical challenges, and behavioral questions) with detailed performance coaching reports.
- **History Tracking**: Users can view their past resume uploads and complete mock interview history with dynamic score roadmaps.

---

## 🎨 Project Highlights

- **Premium Aesthetics**: Features a modern glassmorphism design, vibrant gradients, a cinematic staggered per-character "Career AI" reveal intro screen, and smooth micro-animations.
- **GPU-Accelerated Smooth Scroll**: Fully optimized touch inertial scrolling and GPU compositing layers running at 60 FPS on both mobile and desktop screens.
- **Robust Error Handling**: Frontend validation blocks incorrect files, and the backend uses an actively maintained PDF parser (`pdf-parse-new`) and Express error-catcher configurations.
- **Clean Backend Request Logger**: Middleware that logs HTTP methods, request paths, status codes, execution timings, and automatically redacts sensitive payload parameters (like passwords and tokens).

---

## 🧱 Project Structure

```text
AI-Career-Guidance-Platform/
├── backend/
│   ├── src/
│   │   ├── config/       # Database & Environment config
│   │   ├── controllers/  # Route logic (auth, resume, chat, interview)
│   │   ├── middlewares/  # JWT Auth, Multer, Logger, & Error handling
│   │   ├── models/       # Mongoose schemas (User, Resume, Interview)
│   │   ├── routes/       # API endpoints (auth, resume, chat, interview)
│   │   ├── services/     # Groq AI (Resume, Chatbot, & Mock Interview Engines)
│   │   ├── app.js
│   │   └── server.js
│   └── uploads/resumes/  # Local temporary file storage
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router (Pages, Layouts, Mock Interview)
│   │   ├── components/   # UI components (ATSGauge, FileUpload, InterviewRoom, InterviewReport, IntroScreen)
│   │   └── features/     # API Client (Axios) & AuthContext
│   ├── tailwind.config.ts
│   └── tsconfig.json
└── docs/               # System architecture & API documentation
```

---

## 🚀 Features Implemented

### 1. The Frontend Experience (Next.js + Tailwind)
- **Intro Screen Reveal**: A staggered text reveal for "Career AI" followed by an ultra-smooth curtain slide transition.
- **Landing Page**: A stunning Hero section with animated text, glowing background elements, and clear value propositions.
- **Global Navigation**: A sticky, smart Navbar that toggles layout based on user authentication state.
- **Authentication Pages**: Clean `/login` and `/register` interfaces seamlessly integrated with the backend JWT flow via Axios interceptors.
- **Resume Upload (`/resume-upload`)**: A highly interactive drag-and-drop component with visual feedback, loading spinners, and strict file validation.
- **AI Career Dashboard (`/dashboard`)**:
  - **ATS Score Gauge**: An animated, color-coded SVG circular progress bar.
  - **Skills Gap Analysis**: Categorized tags highlighting Technical Skills, Soft Skills, and Missing Growth Areas.
  - **Role Matching**: Sleek cards outlining AI-recommended career trajectories.
  - **AI Career Mentor Chatbot**: A dynamic chat interface that automatically pulls in your resume context to answer questions and build custom learning roadmaps for your target roles.
  - **Resume History**: A sidebar listing past resume uploads, linking to detailed historical views (`/dashboard/resume/[id]`).
- **AI Voice Mock Interview (`/mock-interview`)**:
  - **Setup and Config**: Select a target role or input a custom dream role.
  - **Interview Room**: Features dynamic waveform animations, question progress timers, and automatic Web Speech API STT/TTS voice integration.
  - **Performance Report**: Shows an overall performance score out of 100, visual progress charts for categories, transcript-by-transcript review panels, and a custom roadmap.

### 2. The Backend Engine (Node.js + Express)
- **Secure Authentication**: Password hashing (bcrypt) and JWT issuance.
- **Resume Processing Pipeline**:
  - `multer` handles incoming multipart form data.
  - `pdf-parse-new` extracts raw text from the uploaded document.
  - The text is passed to **Groq Llama-3.3-70b-versatile** to return a structured JSON analysis.
- **AI Mock Interview Engine**:
  - Generates adaptive questions sequentially, matching the user's resume context and target domain.
  - Evaluates completed transcripts on overall performance, communication styles, technical gaps, and improvement roadmaps.
- **Data Persistence**: Stores users, original file metadata, and the full structured AI analysis payload inside MongoDB.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v3
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Speech Engine**: Web Speech API (`speechSynthesis` & `webkitSpeechRecognition`)

### Backend
- **Runtime**: Node.js v20+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JSON Web Tokens (JWT) & bcrypt
- **File Uploads**: Multer
- **AI Integration**: `groq-sdk` (Llama-3.3-70b-versatile for resume parsing, chatbot, & mock interviews)
- **PDF Parsing**: `pdf-parse-new`

---

## ▶️ Getting Started

### 1. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

### 2. Environment Variables

Create `.env` files in both the frontend and backend directories.

**Backend (`backend/.env`)**:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
CLIENT_URL=http://localhost:3000
```

**Frontend (`frontend/.env.local`)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Run the Development Servers

Run these commands in two separate terminal windows:

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm run dev
```

Finally, open `http://localhost:3000` in your browser to explore the platform!


