# 🚀 SecureVault DMS - Quick Start Guide

## Database Credentials
```
Host: localhost
Port: 5432
Database: securevault_db
Username: postgres
Password: 4728
```

## Test Accounts
```
Admin:
  Email: admin@securevault.com
  Password: password123

User:
  Email: user@bank.com
  Password: password123
```

## Start Development

### 1. Start Backend
```bash
cd backend
npm run start:dev
```
Backend runs on: `http://localhost:3000`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

### 3. Open Prisma Studio (Optional)
```bash
cd backend
npx prisma studio
```
Prisma Studio: `http://localhost:5555`

## API Endpoints

### Health Check
```
GET http://localhost:3000/api
```

### Database Test
```
GET http://localhost:3000/api/test-db
```

### Authentication
```
POST http://localhost:3000/api/v1/auth/login
Body: { "email": "admin@securevault.com", "password": "password123" }
```

### Projects (Requires Auth)
```
GET http://localhost:3000/api/v1/projects
Header: Authorization: Bearer <token>
```

## Useful Commands

### Database
```bash
# View data in browser
npx prisma studio

# Reset database (deletes all data)
npx prisma migrate reset

# Re-seed database
npx prisma db seed

# Check connection
node test-db-connection.js
```

### Development
```bash
# Backend hot reload
npm run start:dev

# Build for production
npm run build

# Run tests
npm run test
```

## Troubleshooting

### Backend won't start
1. Check PostgreSQL is running (pgAdmin)
2. Verify `.env` file exists
3. Run `npx prisma generate`

### Database connection error
1. Verify credentials in `.env`
2. Check PostgreSQL service is running
3. Test with: `npx prisma db pull`

### Prisma Client errors
```bash
# Regenerate Prisma Client
rmdir /s /q node_modules\.prisma
npx prisma generate
```

## Documentation
- API Docs: `http://localhost:3000/docs` (Swagger)
- Full Validation Report: `DATABASE_VALIDATION_REPORT.md`
