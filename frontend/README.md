# TalentLink: Freelance Marketplace Platform

TalentLink is a full-stack web application that connects clients with freelance professionals. It provides a complete end-to-end workflow for posting projects, submitting proposals, managing contracts, messaging, and leaving reviews.

## Key Features

* **Dual User Roles:** Separate registration and dashboards for **Clients** and **Freelancers**.
* **Project Lifecycle:**
    * Clients can **post, edit, and delete** projects.
    * Freelancers can **browse and search** for projects (by title, description, skills).
    * Freelancers can **submit proposals** with cover letters and bids.
* **Proposal & Contract Management:**
    * Clients can **accept** or **reject** proposals from their dashboard.
    * Accepting a proposal automatically **creates a contract** and sets the project status to "in_progress".
* **User Profiles:**
    * Users can update their profile info (headline, bio, country, etc.).
    * Freelancers can set an **hourly rate** and add **skills**.
    * Freelancers can manage a **portfolio** of their work (with images, links, and descriptions).
* **Real-time Notifications:**
    * In-app notification bell with an unread count.
    * Automatic notifications for new proposals, proposal status changes, and new messages.
    * **Email notifications** are sent in parallel for these events.
* **Direct Messaging:** A real-time (polling) chat system for 1-on-1 conversations between users.
* **Review System:** After a contract, clients and freelancers can leave a rating (1-5) and a comment for each other on the project.

## Tech Stack

* **Backend:**
    * **Framework:** Django
    * **API:** Django REST Framework (DRF)
    * **Authentication:** Simple JWT (JSON Web Tokens)
    * **Database:** PostgreSQL (Production) / SQLite3 (Development)
    * **Email:** Django's SMTP backend

* **Frontend:**
    * **Library:** React
    * **UI:** React-Bootstrap & `lucide-react` icons
    * **Routing:** React Router DOM
    * **API Client:** Axios (with interceptors for auth/token refresh)
    * **Build Tool:** Vite

## Local Development Setup

### Prerequisites

* Python 3.10+ and `pip`
* Node.js 20+ and `npm`
* Git

### 1. Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone [your-repo-url]
    cd [project-folder]/backend
    ```

2.  **Create a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt 
    # (You may need to create this file: pip freeze > requirements.txt)
    # Key packages: django, djangorestframework, djangorestframework-simplejwt, django-cors-headers, django-filter, python-dotenv, dj-database-url, gunicorn, psycopg2-binary
    ```

4.  **Create `.env` file:** In the `backend` directory, create a `.env` file for your email credentials:
    ```
    SECRET_KEY=your-django-secret-key-here
    EMAIL_HOST_USER=your-gmail-address@gmail.com
    EMAIL_HOST_PASSWORD=your-gmail-app-password
    ```

5.  **Run migrations and start server:**
    ```bash
    python manage.py migrate
    python manage.py runserver
    ```
    The backend will be running at `http://127.0.0.1:8000`.

### 2. Frontend Setup

1.  **Open a new terminal** and navigate to the frontend directory:
    ```bash
    cd [project-folder]/frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The frontend will be running at `http://localhost:5173`.

### 3. Running Tests

* **Backend:**
    ```bash
    cd backend
    source venv/bin/activate
    python manage.py test api
    ```

* **Frontend:**
    ```bash
    cd frontend
    npm test
    ```