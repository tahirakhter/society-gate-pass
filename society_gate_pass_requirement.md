# Society Gate Pass – Visitor Entry Management System

## Updated User Management & Access Control Requirements

### 4.1 User Roles

The system supports three user roles:

#### ADMIN

Responsibilities:

* Create House Owner accounts
* Create Security Guard accounts
* Create and manage Houses
* Assign Houses to House Owners
* Activate/Deactivate user accounts
* Reset passwords
* View all visitors, tokens, and logs
* Manage system configuration

#### OWNER

Responsibilities:

* Login to system
* View assigned house information
* Register visitors
* Generate visitor QR codes
* View generated passes
* Deactivate visitor passes
* View visitor entry history related to assigned house

#### SECURITY

Responsibilities:

* Login to gate scanning interface
* Scan visitor QR codes
* Validate visitor entry
* Record entry logs
* View gate activity logs

---

## Authentication Model

### No Public Registration

The system does not provide public registration functionality.

The following endpoints must NOT exist:

```http
POST /auth/register
POST /signup
```

All user accounts are created by Administrators.

---

## User Lifecycle

### Create Owner

Admin creates a House Owner account:

Required fields:

* Full Name
* Email
* Temporary Password
* Assigned House

Workflow:

```text
Admin
 ↓
Create Owner
 ↓
Assign House
 ↓
Owner Receives Credentials
 ↓
Owner Logs In
```

---

### Create Security Guard

Admin creates Security accounts:

Required fields:

* Full Name
* Email
* Temporary Password

Workflow:

```text
Admin
 ↓
Create Security User
 ↓
Security Logs In
```

---

### User Activation & Deactivation

Admin can:

* Activate account
* Deactivate account
* Reset password

Deactivated users:

* Cannot login
* Cannot access APIs
* Cannot generate passes
* Cannot validate QR codes

---

## House Management

### House Creation

Only Admin can create Houses.

Fields:

* House Number
* Block
* Status

### House Assignment

Each House is assigned to one Owner.

Rules:

* One Owner can own multiple Houses
* A House can only have one active Owner at a time

---

## Updated Entity Relationship Diagram

```text
Admin
  │
  ├── Creates Owners
  ├── Creates Security Users
  └── Creates Houses

Owner (1) ─── (M) House
                    │
                    │
                    ▼
              Visit Tokens
                    │
                    ▼
                Visitor
                    │
                    ▼
                Entry Log

Security
   │
   └── Scans QR Codes
```

---

## Additional APIs

### User Management (Admin Only)

```http
POST   /users
GET    /users
GET    /users/:id
PATCH  /users/:id
PATCH  /users/:id/activate
PATCH  /users/:id/deactivate
POST   /users/:id/reset-password
```

### House Management (Admin Only)

```http
POST   /houses
GET    /houses
GET    /houses/:id
PATCH  /houses/:id
PATCH  /houses/:id/assign-owner
```

---

## Security Rules

### RBAC Matrix

| Feature                | Admin | Owner | Security |
| ---------------------- | ----- | ----- | -------- |
| Create Users           | Yes   | No    | No       |
| Create Houses          | Yes   | No    | No       |
| Assign Houses          | Yes   | No    | No       |
| Generate QR            | No    | Yes   | No       |
| Revoke QR              | No    | Yes   | No       |
| Scan QR                | No    | No    | Yes      |
| View All Logs          | Yes   | No    | No       |
| View House Logs        | No    | Yes   | No       |
| Manage System Settings | Yes   | No    | No       |

---

## Future AI Assistant Support

The system should support AI-assisted visitor registration.

Example:

User enters:

"Create a visitor pass for Ahmed Khan, CNIC 12345-1234567-1, car LEA-1234, tomorrow at 2 PM."

The AI Assistant should:

1. Extract visitor information
2. Validate required fields
3. Generate structured data
4. Create visitor record
5. Generate visitor pass
6. Return QR code details

This feature will be implemented in a future phase using LLM-based structured outputs and tool calling.
