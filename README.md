# Project Setup
 Node.js v22.12.0.
 DB : MongoDB
 [frontend]
npm create vite@latest ./
 [backend]
 npm init
 npm install 
 Node.js + Mongoose 

 [Email] - SMTP/IMAP

 npm run dev

 # Tech Stack
 [BACKEND] -     
    "body-parser": "^2.2.1",
    "cors": "^2.8.5",
    "dayjs": "^1.11.19",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "imap-simple": "^1.6.3",
    "lodash": "^4.17.21",
    "mailparser": "^2.3.0",
    "mongoose": "^9.0.0",
    "multer": "^2.0.2",
    "node-imap": "^0.9.6",
    "nodemailer": "^7.0.11",
    "nodemon": "^3.1.11",
    "openai": "^6.9.1",
    "pdf-parse": "^2.4.5",
    "uuid": "^13.0.0",
    "xlsx": "^0.18.5"

    # AI RFP Management & Recommendation API

An API service for managing **RFPs (Request for Proposals)** and providing **AI-powered vendor / proposal recommendations**.  
This backend handles:

- RFP creation & workflow
- Vendor & proposal submissions
- AI scoring and ranking of responses
- Recommendations for best vendor / proposal
- Collaboration, comments, and approvals

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Run Locally](#run-locally)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Auth](#auth)
  - [RFPs](#rfps)
  - [Vendors](#vendors)
  - [Proposals](#proposals)
  - [AI Recommendations](#ai-recommendations)
- [Error Handling](#error-handling)
- [Folder Structure](#folder-structure)
- [Development Guidelines](#development-guidelines)
- [Roadmap](#roadmap)
- [License](#license)

---

# AI RFP Management & Recommendation API

An API service for managing **RFPs (Request for Proposals)** and providing **AI-powered vendor / proposal recommendations**.  
This backend handles:

- RFP creation & workflow
- Vendor & proposal submissions
- AI scoring and ranking of responses
- Recommendations for best vendor / proposal
- Collaboration, comments, and approvals

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Run Locally](#run-locally)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Auth](#auth)
  - [RFPs](#rfps)
  - [Vendors](#vendors)
  - [Proposals](#proposals)
  - [AI Recommendations](#ai-recommendations)
- [Error Handling](#error-handling)
- [Folder Structure](#folder-structure)
- [Development Guidelines](#development-guidelines)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Organizations receive many RFPs and vendor proposals. Manually reviewing, scoring, and comparing them is slow and inconsistent.

**AI RFP Management & Recommendation API** automates this by:

- Centralizing RFPs, vendors, and proposals
- Using AI to analyze requirements and responses
- Generating scores and ranking proposals
- Recommending best-fit vendors based on criteria (cost, fit, risk, etc.)

This API is designed to be consumed by:

- Web dashboards
- Internal tools
- External vendor portals

---

## Features

- **RFP Management**
  - Create, update, publish RFPs
  - Define sections, questions, and scoring weights
  - Set timelines and status (Draft, Open, Closed, Awarded)

- **Vendor & Proposal Management**
  - Vendor onboarding and profiles
  - Proposal submission per RFP
  - Attachments (PDF, docs, etc.)

- **AI-Powered Engine**
  - NLP to understand RFP requirements
  - AI-based proposal scoring
  - Recommendation ranking with explanations
  - Similar RFP / historical performance insights (optional)

- **Collaboration**
  - Internal comments on RFPs and proposals
  - Reviewer's scores and notes



---

## Architecture

High-level architecture (example):

- **API Layer**: REST (Node.js )
- **Database**:  MongoDB
- **AI Layer**: 
  - Prompt templates + external LLM (e.g., OpenAI)  
  - Custom scoring models (optional)

> Update this section to match your real architecture.

---

## Tech Stack

- **Backend**: Node.js + Express (or your framework)
- **Database**: MongoDB (Mongoose) 
- **AI Provider**: OpenAI  / Local LLM

---

## Getting Started

### Prerequisites

- Node.js >= 18 (if using Node)
- npm or yarn
- MongoDB / PostgreSQL running locally or in the cloud
- API key for your AI provider (e.g. `OPENAI_API_KEY`)

### Installation

```bash
git clone https://github.com/your-org/ai-rfp-api.git
cd ai-rfp-api
npm install
# or: yarn install
 
 ## Decisions & Assumptions

This section documents the major design choices made during development of the AI RFP Management & Recommendation API, along with assumptions that guided the architecture, data modeling, scoring logic, and integrations.

---

### ✔ Key Design Decisions

#### 1. **Modular Architecture**
The system is divided into logical modules:
- `Auth` – authentication & authorization (JWT-based)
- `RFP` – creation, workflow, status transitions
- `Vendor` – vendor profiles & metadata
- `Proposal` – submissions linked to RFPs
- `AI Scoring` – LLM-assisted scoring & recommendations
- `Files` – attachment uploads (PDF, docs) stored on S3 or equivalent

This separation ensures scalability and allows future migration to microservices.

---

#### 2. **Flexible RFP Structure**
RFPs are modeled using:
- Sections (with weightage)
- Questions (with individual weights)
- Optional custom scoring logic per section

This enables organizations to build RFPs with different structures without modifying backend code.

---

#### 3. **Vendor-neutral AI Layer**
The AI scoring service is wrapped inside a single abstraction:
- Can switch between OpenAI, Azure OpenAI, or local LLMs.
- Prompts and scoring templates stored in version-controlled JSON files.
- AI operations done asynchronously when possible.

This ensures future adaptability and avoids vendor lock-in.

---

#### 4. **Deterministic Scoring + AI Mixed**
The system uses:
- **Rule-based scoring** → cost, compliance, deadlines, required fields  
- **AI-based scoring** → technical fit, clarity, quality of answers  
- **Weighted final score** = `technical * weight + commercial * weight + risk * weight`

Blend ensures fairness and reduces AI hallucination impact.

---

#### 5. **JWT Authentication & RBAC**
Roles:
- **Buyer** – publish RFPs, review vendor submissions
- **Reviewer** – internal evaluator for proposals
- **Vendor** – submit proposals

Permissions enforced at the route level.

---

#### 6. **Attachments Stored Externally**
Documents and proposal files are not stored in DB to avoid bloating.  
Chosen storage approach:


Allows unlimited scalability for file uploads.

---

#### 7. **Pagination & Filtering Everywhere**
Large datasets (RFPs, vendors, proposals) use:
- `page`, `limit`
- status / category filters
- sorting by score, deadline, createdAt

Ensures performance for enterprise usage.

---

### ✔ Assumptions Made During Design

#### 1. **Emails & Notifications**
- Email templates are not generated by AI by default (optional).
- System uses SMTP or transactional email service (SendGrid/Mailgun).
- All email formats are standard HTML templates.

No SMS/WhatsApp assumed unless added later.

---

#### 2. **AI Input Limitations**
- Proposal answers + RFP questions are capped to prevent token overflow.
- Huge attachments (PDF > 10MB) are **not** passed directly to AI.
- Summaries are extracted first if needed (optional enhancement).

---

#### 3. **Data Formats**
- Dates use ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`).
- Currency is assumed **USD** unless explicitly sent by vendor.
- Budget ranges contain `{ min, max }`.

---

#### 4. **Proposal Structure Assumption**
Each proposal includes:
- Summary
- Answers mapped to RFP question IDs
- Pricing details (one-time or recurring)
- Optional attachments

If attachments exceed size, vendor must compress or upload multiple files.

---

#### 5. **Security Assumptions**
- All public endpoints require JWT except `/auth/login` & `/auth/register`.
- Vendors cannot view other vendors’ proposals.
- Buyers cannot modify proposals after submission deadline.

---

#### 6. **System Limitations (Initial Version)**
- Real-time collaboration (Google Docs-like) is **not** supported.
- AI scoring is synchronous (unless job queue is enabled).
- Multi-tenant support is not included by default.

Future enhancements can remove these constraints.

---

### ✔ Why These Decisions Matter
- **Scalability** – Able to handle many RFPs & proposals.
- **Security** – Prevent unauthorized vendor access.
- **Flexibility** – Works for multiple industries & RFP types.
- **Accuracy** – Balanced AI-assisted and rule-based scoring.
- **Maintainability** – Clear module boundaries help future teams develop faster.

---

## AI Tools Usage

This project leveraged several AI-assisted development tools to accelerate development, improve design quality, and debug complex logic. The following outlines which tools were used, how they contributed, and what insights were gained throughout the process.

---

### ✔ AI Tools Used

#### 1. **ChatGPT (Primary Assistant)**
Used for:
- Designing overall system architecture
- Drafting API flows, models, and database schemas
- Writing boilerplate backend code (controllers, routes, validation logic)
- Generating prompt templates for AI scoring and recommendation engines
- Producing documentation sections (README, API docs, decisions, assumptions)
- Debugging errors during development

#### 2. **GitHub Copilot**
Used for:
- Auto-completing repetitive code
- Generating function bodies & utility helpers
- Suggesting improvements in middleware and service logic
- Faster implementation of CRUD endpoints

#### 3. **Claude (Optional)**
Used for:
- Refining complex business logic text (RFP scoring, evaluation categories)
- Summaries and rewording long requirement documents
- Parsing long RFP PDFs into structured content (when needed)

#### 4. **Cursor IDE / AI Code Editor (If applicable)**
Used for:
- Live code refactoring suggestions
- Inline debugging hints
- Intelligent search and auto-fixes within the codebase

---

### ✔ How These Tools Helped

#### 🔹 **1. Boilerplate & Code Generation**
AI tools automated creation of:
- Express route setup
- Mongoose models
- Controller scaffolding
- Error handlers
- Pagination utilities

Saved significant time by avoiding repetitive typing.

#### 🔹 **2. Debugging & Troubleshooting**
AI helped resolve:
- Schema validation issues
- Async/await bugs
- Incorrect middleware order
- File upload errors (S3 presigned URLs, multer configs)

Tools gave targeted suggestions instead of manually searching StackOverflow.

#### 🔹 **3. Design & Architecture Decisions**
AI helped clarify:
- RFP → Proposal → Vendor model relationships  
- Weight-based scoring formula  
- Job queue considerations for large scoring tasks  
- Best practices for RBAC and permissions  
- How to structure AI scoring microservice

Result: cleaner, more scalable architecture.

#### 🔹 **4. AI Prompt Engineering**
AI tools helped create:
- Consistent LLM prompts for scoring proposals
- Ranking templates with weights & evaluation criteria
- Parsing templates that convert input text into structured JSON

Also validated whether prompts were ambiguous or weak.

#### 🔹 **5. Documentation & Clarity**
Generated:
- API documentation
- Decision logs
- Assumptions list
- Architecture overview diagrams (text-based)
- Readme templates

Ensured professional and consistent documentation quality.

---

### ✔ Notable Prompts / Approaches Used

- **"Generate a weighted scoring formula for RFP evaluation with section-level weights and question-level weights."**
- **"Refactor this Express controller for best practices and error handling."**
- **"Rewrite this long business requirement in a structured API-friendly format."**
- **"Explain the pros/cons of synchronous vs asynchronous AI scoring services."**
- **"Convert this sample proposal response into scoring categories using an LLM."**

These prompts improved both code quality and understanding of complex flows.

---

### ✔ What I Learned From Using These Tools

#### 1. **AI is excellent for structure, but human validation is required**
AI produces fast scaffolding but still requires:
- Domain understanding
- Manual refinement
- Business rule validation

#### 2. **AI improves development speed significantly**
Boilerplate generation + debugging automation =  
**~40–60% faster development workflow.**

#### 3. **Prompts matter more than the tool**
Clear prompts = better architecture, fewer errors, higher-quality output.

#### 4. **AI reduces mental load**
Instead of guessing solutions or searching endlessly,  
AI acts like a real-time pair-programmer.

#### 5. **Final quality always needs human review**
For:
- Security  
- Business logic  
- Performance optimizations  
- Model relationships  
- Sensitive user data handling  

---

### ✔ Summary

AI tools were not used to replace engineering effort but to **augment** it — enabling rapid prototyping, higher-quality architecture, faster debugging, and cleaner documentation.  
The final system design, API logic, security rules, and data modeling were validated and refined manually to ensure correctness and scalability.

---
