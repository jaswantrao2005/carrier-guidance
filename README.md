# CareerAI — AI Career Guidance Platform 👀

> **AI-Powered Career Guidance & ATS Evaluation Platform** built with **React**, **TypeScript**, **Tailwind CSS**, **Node.js**, **Express**, **MongoDB Atlas**, and **Groq AI (openai/gpt-oss-120b)**.

---

## 📟 Table of Contents
1. [Project Overview]#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [Core Features](#-core-features)
4. [Recent Fixes & Improvements](#-recent-fixes---improvements)
5. [Directory Structure]#-directory-structure)
6. [API Endpoints](#-api-endpoints)
7. [Environment Variables](#-environment-variables)
8. [Setup & Running Locally](#-setup---running-locally)

---

## 🎉 Project Overview

**CareerAI** is a smart career companion that helps job seekers and students evaluate their resumes, practice realistic AI-driven mock interviews, uncover missing skills, and receive real-time career mentoring.

---

## 🛥️ Tech Stack

### Frontend
- {**Framework**}: React + Vite + TypeScript
- {**Styling**}: Tailwind CSS, Lucide Icons, Glassmorphism UI
- {**Routing & State**}: React Router, Context API, Axios

### Backend
- **Framework**: Node.js & Express.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- {**AI Brain**}: Groq SDK (openai/gpt-oss-120b) & Google Generative AI
- {*Authentication**}: JWT (JSON Web Tokens), bcryptjs

---

## ✨ Core Features

- 🟄 **ATS Resume Scoring**: Extracts resume text and computes realistic ATS scores (1-100), candidate summaries, technical skills, and growth areas.
- 🎉 **Skill Extraction & Gap Analysis**: Automatically identifies technical & soft skills from uploaded resumes and recommends targeted career roles.
- 🎙 **AI Mock Interview Room**: Conducts dynamic, role-tailored technical & behavioral interview practice with real-time feedback.
- 💬 **Personalized Career Mentor**: AI chatbot that answers career-related questions and guides upskilling pathways.
- 🔑 **Candidate Dashboard**: Visualizes candidate profile metrics, past resume analyses, and history.

---

## 🔧 Recent Fixes & Improvements

• **Groq AI Model Upgrade**: Upgraded Groq model from deprecated qwen/qwen3.6-27b & llama-3.3-70b to the supported **`popenai/gpt-oss-120b`** model across all backend services.
• **Fixed Zero-Score Bug in Resume Analysis**: Updated `srv/services/gemini/career.service.js` with structured normalization to prevent 0s or empty skills upon upload.
��**Automated Test Script**: Implemented `testGeminiAnalysis.js` for testing Groq resume parsing and JSON response validation.

---

## 📂 Directory Structure

nodejs
/Backend

---

## 🙀 Setup & Running Locally

1. Backend: `npm run dev`
2. Frontend: `npm run dev`
