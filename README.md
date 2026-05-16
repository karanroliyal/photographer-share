# 📸 Photographer Share - Beginner's Guide

Welcome to the **Photographer Share** project! This is a production-grade Photo Selection SaaS designed for photographers to share galleries with clients and manage selections.

This guide will help you get the project running on your local machine from scratch.

---

## 🛠 Prerequisites

Before you start, make sure you have the following installed:

1.  **Node.js** (v18 or higher): [Download here](https://nodejs.org/)
2.  **PostgreSQL**: A database to store project data. [Download here](https://www.postgresql.org/)
3.  **Redis**: Used for background tasks (queues). [Download here](https://redis.io/download/) (For Windows, use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) or [Redis for Windows](https://github.com/tporadowski/redis/releases)).
4.  **Git**: To manage your code.

---

## 🚀 Step-by-Step Setup

### 1. Clone the Project
Open your terminal (PowerShell, CMD, or Terminal) and navigate to where you want the project:
```bash
git clone <repository-url>
cd "Photographer Share"
```

### 2. Setup the Server (Backend)
The server handles the database and logic.

1.  **Navigate to the server folder:**
    ```bash
    cd server
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:**
    - Copy the example file: `cp .env.example .env` (or manually copy and rename in your folder).
    - Open the `.env` file and update your database credentials (`DATABASE_URL`).
    - *Example:* `postgresql://postgres:your_password@localhost:5432/photoselect`
4.  **Setup the Database:**
    ```bash
    npx prisma generate
    npx prisma migrate dev --name init
    npx prisma db seed
    ```
5.  **Start the Server:**
    ```bash
    npm run dev
    ```
    *The server will run on `http://localhost:4000`.*

---

### 3. Setup the Client (Frontend)
The client is the user interface.

1.  **Open a NEW terminal window** (keep the server terminal running).
2.  **Navigate to the client folder:**
    ```bash
    cd client
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Start the Client:**
    ```bash
    npm run dev
    ```
    *The app will be available at `http://localhost:5173`.*

---

## 🏗 Project Structure

-   **/server**: Node.js, Express, and Prisma (Database).
-   **/client**: React, Vite, and Tailwind CSS (UI).
-   **/prisma**: Database schema and migration files.

---

## 💡 Common Commands

| Command | Location | Description |
| :--- | :--- | :--- |
| `npm run dev` | Server/Client | Starts development mode |
| `npx prisma studio` | Server | Opens a visual UI for your database |
| `npm run build` | Server/Client | Prepares the app for production |

---

## 🆘 Troubleshooting

-   **Database Error?** Ensure PostgreSQL is running and your `DATABASE_URL` in `.env` is correct.
-   **Redis Error?** Ensure Redis is running. The server needs it for BullMQ (task queues).
-   **Node Modules Error?** Try deleting `node_modules` and running `npm install` again.

Happy Coding! 🚀
