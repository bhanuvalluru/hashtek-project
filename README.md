# 🍔 FoodApp Authentication Web Application

A clean, dynamic, beginner-friendly web application containerized with **Docker**, featuring **temporary Redis registration verification** and **PostgreSQL database storage**.

---

## 🌟 Key Architecture & Highlights

* **Frontend**: Responsive HTML5, CSS3, Modern JavaScript served via **Nginx** reverse proxy (`http://localhost:3000`).
* **Backend**: **Node.js Express** REST API (`http://localhost:5000`).
* **Database**: **PostgreSQL 16** for persistent storage of verified users.
* **In-Memory Cache (Mandatory)**: **Redis 7** for temporarily holding pending registration details and verification tokens (TTL: 15 minutes).
* **Dockerized**: 100% containerized with Docker and Docker Compose — launch everything with a single command!

---

## 🔄 How the Workflow Works

```
                                  [ User Registers ]
                                           │
                                           ▼
                                 [ Password Hashed ]
                                           │
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │  Step 1: Stored TEMPORARILY in Redis Cache       │
                 │  Key: pending_user:<token>                        │
                 │  TTL: 15 Minutes (PostgreSQL is NOT touched!)     │
                 └───────────────────────────────────────────────────┘
                                           │
                                           ▼
                           [ Verification Link Dispatched ]
                        (Docker console + Interactive Preview)
                                           │
                                           ▼
                           [ User Clicks Verification Link ]
                                           │
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │  Step 2: Backend verifies token from Redis        │
                 │  - Inserts name, email, hashed pwd to PostgreSQL │
                 │  - Deletes pending keys from Redis                │
                 └───────────────────────────────────────────────────┘
                                           │
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │  Step 3: User Logs In                             │
                 │  - Only verified PostgreSQL users allowed         │
                 │  - Pending users are prompted to verify first     │
                 └───────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Running with Docker)

### 1. Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 2. Start all services
Open your terminal in the project directory and run:
```bash
docker compose up --build
```
*(Or in background mode: `docker compose up --build -d`)*

### 3. Open the App in Your Browser
Visit:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Step-by-Step Testing Guide for Beginners

1. **Register a New Account**:
   - Go to the **Register** tab.
   - Enter your name, email, and password (min. 6 characters).
   - Click **"Create Account & Send Verification Link"**.
   - Your details are now temporarily saved in **Redis** with a 15-minute countdown.

2. **Try Logging In BEFORE Verifying**:
   - Switch to the **Log In** tab.
   - Enter the email and password you just registered with.
   - Click **"Log In"**.
   - Notice the system responds: ⚠️ *"Your email has not been verified yet! Please check your email inbox to verify before logging in."*
   - PostgreSQL does not have your user record yet!

3. **Verify Your Email**:
   - In the registration tab (or Docker terminal logs `docker logs -f foodapp-backend`), click the generated verification link:
     `http://localhost:3000/verify.html?token=...`
   - You will see the activation screen confirm:
     *✅ Email Verified Successfully! Your user details have been moved from temporary Redis cache into the PostgreSQL database!*

4. **Log In Successfully**:
   - Return to the **Log In** tab.
   - Enter your credentials.
   - You are now logged in! Your user profile, user ID, and verified status are displayed on the dashboard.

5. **Inspect Redis and Database in Real-Time**:
   - Click the **"3. How It Works"** tab.
   - Click the **"🔄 Refresh Status"** button.
   - You can see verified user counts in PostgreSQL and any pending registration tokens currently active in Redis!

---

## 📂 Project Directory Structure

```
foodapp-hashtek/
├── docker-compose.yml       # Orchestrates all 4 containers
├── .env.example             # Environment variables template
├── README.md                # Documentation and guide
├── backend/
│   ├── Dockerfile           # Node.js backend container definition
│   ├── package.json         # Backend dependencies
│   ├── server.js            # Express server entry point
│   ├── sql/
│   │   └── init.sql         # PostgreSQL schema initialization
│   └── src/
│       ├── config.js        # Environment configuration
│       ├── db.js            # PostgreSQL connection pool & schema checks
│       ├── redis.js         # Redis client & pending user helpers
│       ├── emailService.js  # Email notification service
│       └── routes/
│           └── authRoutes.js # /register, /verify, /login, /me, /status
└── frontend/
    ├── Dockerfile           # Nginx frontend container definition
    ├── nginx.conf           # Nginx config & API reverse proxy
    └── src/
        ├── index.html       # Single Page Application (Register, Login, Dashboard)
        ├── verify.html      # Email link verification landing page
        ├── style.css        # Clean, modern responsive design
        └── app.js           # Client-side API interactions
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Saves pending registration into Redis (TTL 15m), sends verification link |
| `POST` | `/api/auth/verify` | Validates Redis token, saves user to PostgreSQL, cleans up Redis |
| `POST` | `/api/auth/login` | Authenticates verified user against PostgreSQL, returns JWT |
| `GET` | `/api/auth/me` | Fetches authenticated user profile (Requires `Authorization: Bearer <token>`) |
| `GET` | `/api/auth/status` | Live inspection of Redis pending keys & PostgreSQL count |

---

## 🛑 Stopping the Application

To shut down the containers:
```bash
docker compose down
```

To shut down and wipe persistent database volumes (clean slate):
```bash
docker compose down -v
```
