# Apna Hisab (Har Paise Ka Hisab)

Apna Hisab is a simple, trustworthy, and professional Android-first personal money-management application. It is designed to help users track their income, expenses, and pending Khata (ledger) transactions with minimal typing and a clean, mobile-first interface.

---

## Folder Structure

```
apna-hisab/
│
├── mobile/            # React Native Expo Mobile App
│   ├── app/           # App screens and layout router
│   ├── components/    # Reusable UI components (buttons, inputs, cards)
│   ├── features/      # Feature-specific logic (auth, transactions, khata, reports)
│   ├── hooks/         # Custom React hooks
│   ├── services/      # API communication, storage, and sync services
│   ├── store/         # Zustand global state stores
│   ├── utils/         # Helper functions (money formatting, date/time helpers)
│   ├── types/         # TypeScript type definitions
│   └── assets/        # Splash, icon, and other graphic assets
│
├── backend/           # FastAPI Backend Service
│   ├── app/
│   │   ├── api/       # Route controllers (auth, transactions, khata, reports)
│   │   ├── core/      # Config, database connection, exception handlers
│   │   ├── models/    # Database models / Pydantic schemas
│   │   ├── services/  # Business logic & calculations (money, reports)
│   │   └── auth/      # Google and JWT authentication helpers
│   ├── tests/         # Unit and integration tests
│   └── main.py        # Entry point for backend dev server
│
├── docs/              # Development documentation
├── .gitignore
├── .env.example
├── .env               # Active local settings (do not commit)
└── README.md
```

---

## Quick Start Setup

### 1. Prerequisites
- **Node.js**: v18+ (tested on v22)
- **NPM** or **Yarn**
- **Python**: 3.10+ (tested on 3.13)
- **MongoDB**: A running local MongoDB instance or a MongoDB Atlas URI

### 2. Backend Setup
1. Open a terminal and navigate to `backend/`.
2. Create a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. View API documentation at `http://127.0.0.1:8000/docs`.

### 3. Mobile Setup
1. Open a terminal and navigate to `mobile/`.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npx expo start
   ```
4. Download the **Expo Go** app on your Android/iOS physical device, scan the QR code displayed in the terminal, and start testing!
