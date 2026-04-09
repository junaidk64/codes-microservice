# Codes Service

Separate NestJS microservice for code generation and code CRUD using MySQL.

## Purpose

- Store `codes` in SQL instead of MongoDB.
- Keep other business modules in the main MongoDB app.
- Provide internal APIs that the main API can call with Axios.

## Schema

This service keeps the same fields as the existing Mongo `Code` schema:

- `bag_number`
- `serial_number`
- `type`
- `parent_serial`
- `security_code`
- `verified`
- `count`
- `orderId`

## Setup

1. Copy `.env.example` to `.env`
2. Update MySQL and storage values
3. Install dependencies
4. Run the service

## Recommended commands

```bash
npm install
npm run start:dev
```

## Notes

- Use this service as the single source of truth for code records.
- The main API should call it through Axios.
- For testing, keep it in this sibling folder. Later you can move it to a separate repository.
