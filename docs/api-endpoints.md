# API Endpoints Documentation

This document describes the available backend API endpoints for the AI Career Guidance Platform.

## Base URL

- Local development: `http://localhost:5000`

## Authentication

Some endpoints require a JSON Web Token (JWT). After logging in, include the token in the request header:

```http
Authorization: Bearer <token>
```

---

## 1. Health Check

### GET /api/health

Checks whether the backend server is running.

#### Response

```json
{
  "success": true,
  "message": "Server is running"
}
```

---

## 2. Register User

### POST /api/auth/register

Creates a new user account.

#### Request Body

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "strongpassword123"
}
```

#### Validation Rules

- `name` is required
- `email` is required and must be a valid email format
- `password` must be at least 8 characters long

#### Response

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "student"
  }
}
```

---

## 3. Login User

### POST /api/auth/login

Authenticates a user and returns a JWT.

#### Request Body

```json
{
  "email": "jane@example.com",
  "password": "strongpassword123"
}
```

#### Response

```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "student"
  }
}
```

---

## 4. Get Authenticated User Profile

### GET /api/auth/profile

Returns the currently authenticated user details from the decoded JWT.

#### Headers

```http
Authorization: Bearer <token>
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "jane@example.com",
    "role": "student"
  }
}
```

---

## 5. Upload Resume

### POST /api/resume/upload

Uploads a PDF resume, extracts its text, analyzes it using AI, and stores the results for the authenticated user.

#### Headers

```http
Authorization: Bearer <token>
```

#### Request Format

Use `multipart/form-data` with a file field named `resume`.

Example:

```bash
curl -X POST http://localhost:5000/api/resume/upload \
  -H "Authorization: Bearer <token>" \
  -F "resume=@/path/to/resume.pdf"
```

#### Supported File Rules

- File type: PDF only
- Maximum size: 5 MB
- Uploaded file is stored in the `uploads/resumes` directory
- Filename is saved with a timestamp prefix to prevent collisions

#### Response

```json
{
  "success": true,
  "message": "Resume uploaded and analyzed successfully",
  "resume": {
    "_id": "resume_id",
    "user": "user_id",
    "filename": "1720512345678-resume.pdf",
    "originalName": "resume.pdf",
    "path": "uploads/resumes/1720512345678-resume.pdf",
    "mimetype": "application/pdf",
    "size": 123456,
    "resumeText": "Extracted text from resume",
    "analysis": {
      "candidateSummary": "Summary",
      "technicalSkills": ["JavaScript", "Node.js"],
      "softSkills": ["Communication"],
      "missingSkills": ["React"],
      "strengths": ["Problem solving"],
      "weaknesses": ["Testing"],
      "careerRoles": ["Frontend Developer"],
      "atsScore": 84,
      "suggestions": ["Improve your React knowledge"]
    }
  }
}
```

---

## 6. Get Resume History

### GET /api/resume/history

Returns all resumes uploaded by the currently authenticated user.

#### Headers

```http
Authorization: Bearer <token>
```

#### Response

```json
{
  "success": true,
  "count": 1,
  "resumes": []
}
```

---

## 7. Get Resume by ID

### GET /api/resume/:id

Retrieves a specific resume uploaded by the authenticated user.

#### Headers

```http
Authorization: Bearer <token>
```

#### Response

```json
{
  "success": true,
  "resume": {}
}
```

---

## 8. Delete Resume

### DELETE /api/resume/:id

Deletes a resume record and removes the uploaded file from storage if it exists.

#### Headers

```http
Authorization: Bearer <token>
```

#### Response

```json
{
  "success": true,
  "message": "Resume deleted successfully"
}
```

---

## Notes

- The platform uses JWT authentication for protected routes.
- Resume uploads are processed asynchronously through the backend and analyzed with Gemini AI.
- The upload route is protected and requires a valid bearer token.
