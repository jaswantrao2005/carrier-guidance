# Architecture Overview

The AI Career Guidance Platform is organized as a modular monorepo with a clear separation between the frontend experience, the backend API, and the AI-driven resume analysis pipeline.

## 1. Overall Architecture

The system is divided into three primary layers:

### Frontend Layer

The frontend is built with Next.js and provides the user-facing experience for:

- authentication screens
- resume upload experience
- dashboard and user interactions
- future career guidance experiences

It communicates with the backend through HTTP requests and sends authentication tokens when needed.

### Backend Layer

The backend is built with Node.js and Express and is responsible for:

- handling user authentication
- protecting API routes
- processing resume uploads
- validating uploaded files
- extracting text from PDF resumes
- calling the AI analysis service
- storing resume metadata and analysis results

### Data and Storage Layer

The platform uses MongoDB for structured data persistence and the local filesystem for uploaded PDF files.

This design keeps the database focused on metadata and analysis results, while the file itself is stored in the `uploads/resumes` folder.

---

## 2. Component Breakdown

### Frontend Modules

The frontend structure is organized around feature-oriented folders:

- `app/` for page routes and layout
- `components/` for reusable UI components
- `features/` for domain-specific feature modules

### Backend Modules

The backend is organized into functional folders:

- `routes/` for endpoint definitions
- `controllers/` for request handling
- `middlewares/` for auth, error handling, and upload handling
- `services/` for business logic and external integrations
- `models/` for persistence models
- `validations/` for request validation
- `config/` for environment and database configuration

---

## 3. Request Flow

### Authentication Flow

1. A user registers or logs in through the auth routes.
2. The backend verifies credentials and returns a JWT.
3. The client includes the token in the `Authorization` header.
4. Protected routes validate the token before granting access.

### Resume Upload and Analysis Flow

1. The user uploads a PDF through the resume upload endpoint.
2. Multer validates the file type and size.
3. The file is stored in the upload directory.
4. The backend reads the PDF content.
5. The resume text is sent to the Gemini AI service.
6. The analysis result is stored alongside the file metadata.
7. The response is returned to the client.

---

## 4. Security Design

The platform currently implements:

- JWT-based authentication for protected endpoints
- route-level middleware protection
- file type and size enforcement for uploads
- error handling middleware for consistent API responses

This creates a strong base for secure user-driven file processing.

---

## 5. AI Integration Design

The AI layer is separated into a dedicated service module:

- `services/gemini/career.service.js` handles the Gemini API call
- `services/resume/resume.service.js` handles PDF extraction

This separation makes the workflow easier to maintain and test independently.

---

## 6. Scalability Considerations

The architecture is designed to evolve in a structured way:

- New features can be added as new frontend features or backend routes
- AI logic can be extended without changing the route layer
- Additional services can be plugged into the existing controller flow
- The current structure supports future dashboard, roadmap, and recommendation features

---

## 7. Summary

The platform follows a clean three-layer architecture:

- frontend for interaction and presentation
- backend for authentication, file handling, and business logic
- database and storage for persistence and uploaded files

This layout provides a solid foundation for an AI-driven career guidance application that can grow over time.
