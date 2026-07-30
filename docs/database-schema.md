# Database Schema Overview

This document describes the core data entities used by the platform at a high level.

## 1. User

The User entity represents an authenticated platform user.

### Purpose

- Stores identity and login information
- Enables authentication and authorization
- Connects uploaded resumes to a specific account

### Typical Fields

- `name`: full display name
- `email`: unique email address
- `password`: hashed password
- `role`: user role such as `student`
- `createdAt`: creation timestamp
- `updatedAt`: last updated timestamp

### Notes

- Passwords are stored securely as hashed values.
- Users can upload resumes and view their own history.

---

## 2. Resume

The Resume entity stores metadata and analysis results for each uploaded resume.

### Purpose

- Tracks uploaded files belonging to a user
- Stores the extracted text from a resume PDF
- Saves AI-generated career analysis results
- Supports later retrieval and deletion

### Typical Fields

- `user`: reference to the owning user
- `filename`: generated stored filename
- `originalName`: original uploaded file name
- `path`: storage path of the file
- `mimetype`: file type
- `size`: file size in bytes
- `resumeText`: extracted content from the PDF
- `analysis`: AI-generated assessment payload
- `createdAt`: creation timestamp
- `updatedAt`: last updated timestamp

### Notes

- Each resume belongs to exactly one user.
- The resume analysis result is stored alongside the file metadata.

---

## 3. Relationship Between Entities

The platform uses a simple relational model:

- One `User` can have many `Resume` entries
- Each `Resume` belongs to one `User`

This relationship supports a personal dashboard experience where each user can manage their own uploaded resumes.

---

## 4. Storage Approach

The platform uses:

- MongoDB for persistent record storage
- Local filesystem upload storage for the actual PDF files in the `uploads/resumes` folder

This separation keeps the database focused on metadata and analysis results while preserving the uploaded file itself on disk.

---

## 5. Design Principles

The schema design emphasizes:

- Clear ownership through the `user` relationship
- Extensibility for future features like resume versioning or career recommendations
- Lightweight storage for analysis output that can be returned quickly to the frontend
