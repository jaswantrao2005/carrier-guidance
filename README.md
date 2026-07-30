# 🚀 AI Career Guidance Platform

A modern, AI-powered career guidance platform designed to help students and professionals discover career opportunities, evaluate their resume strength, and receive personalized career insights.

## ✨ What This Project Does

The platform combines a beautiful, glassmorphism frontend experience with a robust backend API to support the following experiences:

- **Authentication**: Secure user registration and login with JWT-based access control.
- **Resume Upload**: A seamless drag-and-drop file upload zone that validates and securely transmits PDF files.
- **AI-Powered Analysis**: The backend parses PDF text and interfaces with **Google Gemini AI** to extract skills, evaluate ATS scores, and recommend tailored career paths.
- **Career Dashboard**: A dynamic user dashboard displaying visual ATS score gauges, categorized skill tags (Technical, Soft, Missing), and role recommendations.
- **History Tracking**: Users can view their past resume uploads and track their career growth over time.

---

## 🎨 Project Highlights

- **Premium Aesthetics**: Features a modern glassmorphism design, vibrant gradients, and smooth entrance/micro-animations powered by `framer-motion`.
- **Responsive UI**: Built with Tailwind CSS v3 to ensure flawless layout scaling across mobile and desktop devices.
- **Modular Architecture**: Separate frontend (Next.js) and backend (Express.js) environments for maximum maintainability and scalability.
- **Robust Error Handling**: Frontend validation blocks incorrect files (e.g., >5MB or non-PDFs), and the backend uses an actively maintained PDF parser (`pdf-parse-new`) compatible with modern Node.js environments to prevent engine crashes.

---

## 🧱 Project Structure

```text
AI-Career-Guidance-Platform/
├── backend/
│   ├── src/
│   │   ├── config/       # Database & Environment config
│   │   ├── controllers/  # Route logic
│   │   ├── middlewares/  # JWT Auth & Multer upload handling
│   │   ├── models/       # Mongoose schemas (User, Resume)
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Gemini AI & PDF Parsing logic
│   │   ├── app.js
│   │   └── server.js
│   └── uploads/resumes/  # Local temporary file storage
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router (Pages, Layouts)
│   │   ├── components/   # Reusable UI components (Button, Input, ATSGauge, FileUpload)
│   │   └── features/     # API Client (Axios) & AuthContext
│   ├── tailwind.config.ts
│   └── tsconfig.json
└── docs/               # System architecture & API documentation
```

---

## 🚀 Features Implemented

### 1. The Frontend Experience (Next.js + Tailwind)
- **Landing Page**: A stunning Hero section with animated text, glowing background elements, and clear value propositions.
- **Global Navigation**: A sticky, smart Navbar that toggles layout based on user authentication state.
- **Authentication Pages**: Clean `/login` and `/register` interfaces seamlessly integrated with the backend JWT flow via Axios interceptors.
- **Resume Upload (`/resume-upload`)**: A highly interactive drag-and-drop component with visual feedback, loading spinners, and strict file validation.
- **AI Career Dashboard (`/dashboard`)**:
  - **ATS Score Gauge**: An animated, color-coded SVG circular progress bar.
  - **Skills Gap Analysis**: Categorized tags highlighting Technical Skills, Soft Skills, and Missing Growth Areas.
  - **Role Matching**: Sleek cards outlining AI-recommended career trajectories.
  - **Resume History**: A sidebar listing past resume uploads, linking to detailed historical views (`/dashboard/resume/[id]`).

### 2. The Backend Engine (Node.js + Express)
- **Secure Authentication**: Password hashing (bcrypt) and JWT issuance.
- **Resume Processing Pipeline**:
  - `multer` handles incoming multipart form data.
  - `pdf-parse-new` extracts raw text from the uploaded document.
  - The text is passed to **Google Gemini AI** with a strict prompt to return a structured JSON analysis.
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

### Backend
- **Runtime**: Node.js v20+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JSON Web Tokens (JWT) & bcrypt
- **File Uploads**: Multer
- **AI Integration**: `@google/generative-ai` (Gemini API)
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
GEMINI_API_KEY=your_google_gemini_api_key
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
