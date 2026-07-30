# AI Career Guidance Platform

A modern AI-powered career guidance platform designed to help students and professionals discover career opportunities, evaluate their resume strength, and receive personalized career insights.

## ✨ What This Project Does

The platform combines a modern frontend experience with a robust backend API to support the following experiences:

- User registration and authentication
- Secure login with JWT-based access control
- Resume upload and storage
- PDF resume text extraction
- AI-powered resume analysis using Gemini
- Career role suggestions and skill gap analysis
- Personalized feedback for improving job readiness

This project is structured as a monorepo with a separate frontend and backend layer, making it easy to expand with additional AI-driven career features in the future.

---

## 🎨 Project Highlights

- Clean, modular architecture for scalability
- Authentication-ready backend with protected routes
- Resume processing pipeline for PDF analysis
- AI integration for career guidance recommendations
- Separate frontend and backend responsibilities for maintainability

---

## 🧱 Project Structure

```text
AI-Career-Guidance-Platform/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validations/
│   └── uploads/
│       └── resumes/
├── docs/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       └── features/
└── README.md
```

---

## 🚀 Features Implemented So Far

### 1. Authentication System

The backend includes user registration and login flows with JWT-based access protection.

Implemented capabilities:

- User registration
- User login
- JWT issuance
- Protected route handling using auth middleware
- Profile endpoint for authenticated users

### 2. Resume Upload Workflow

The platform supports uploading PDF resumes through a dedicated upload route.

Implemented capabilities:

- PDF upload through multipart form data
- File storage inside the `uploads/resumes` folder
- Filename normalization with timestamps to prevent collisions
- File size limit enforcement
- PDF-only validation

### 3. Resume Parsing and AI Analysis

Uploaded resumes are processed by the backend for deeper insights.

Implemented capabilities:

- PDF text extraction
- Resume content validation
- AI-powered analysis using Gemini
- Structured career analysis output including:
  - candidate summary
  - technical skills
  - soft skills
  - missing skills
  - strengths
  - weaknesses
  - career roles
  - ATS score
  - suggestions

### 4. Resume History and Management

Authenticated users can manage the resumes they have uploaded.

Implemented capabilities:

- View resume history
- Retrieve a specific resume
- Delete a resume record and associated stored file

### 5. API Layer

The backend exposes a clean API that supports both public and protected actions.

Implemented capabilities:

- Health check endpoint
- Auth endpoints
- Resume upload and management endpoints
- Configurable middleware architecture for validation and authentication

---

## 🛠️ Tech Stack

### Frontend

- Next.js
- React
- TypeScript-ready structure
- Component-based UI organization

### Backend

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Multer for file uploads
- PDF parsing library
- Google Gemini AI integration

---

## 📂 Documentation

The project documentation is organized in the `docs` folder:

- [docs/architecture.md](docs/architecture.md) — high-level system design
- [docs/api-endpoints.md](docs/api-endpoints.md) — backend API reference
- [docs/database-schema.md](docs/database-schema.md) — overview of the core data model

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

Set up the required environment variables for the backend, including:

- `MONGO_URI` for database connection
- `JWT_SECRET` for signing authentication tokens
- `GEMINI_API_KEY` for AI resume analysis
- `PORT` if needed

### 3. Run the Applications

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

---

## 🔐 Authentication Flow

The platform uses a token-based auth flow:

1. User registers or logs in
2. Backend returns a JWT
3. Frontend stores the token and sends it in the `Authorization` header
4. Protected routes validate the token before access is granted

---

## 🧠 AI Career Guidance Flow

The current resume analysis experience follows this flow:

1. User uploads a resume PDF
2. Backend validates the file type and size
3. PDF content is extracted
4. Resume text is sent to Gemini AI
5. AI returns structured guidance and skill analysis
6. Results are stored and returned to the user

---

## 📌 Notes

This repository is evolving into a full-featured AI career guidance platform. The current implementation already covers the foundational user, authentication, file upload, and AI analysis flow, and it is ready to be expanded with richer dashboard experiences and career planning modules.
