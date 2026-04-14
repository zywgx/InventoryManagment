# Dealership Inventory Command

A lightweight dealership inventory management web app for tracking vehicles, monitoring aging inventory, managing recon status, and giving sales or desk teams a clean operational view of the lot.

## Overview

This project is built as a simple local full-stack app:

- Frontend: vanilla HTML, CSS, and JavaScript
- Backend: Node.js HTTP server
- Storage: local JSON files for vehicle inventory and activity history

It is designed to feel like an internal dealership tool rather than a generic stock tracker.

## Features

- Vehicle inventory records with:
  - year, make, model, trim
  - stock number and VIN
  - body style, color, mileage
  - status (`available`, `recon`, `hold`)
  - lot section and days on lot
  - acquisition cost and list price
- Dashboard KPIs for:
  - total units
  - frontline-ready units
  - recon units
  - aging 60+ day units
- Business insights for:
  - lot value
  - gross potential
  - average days on lot
  - average mileage
- Risk monitoring for:
  - recon vehicles
  - aging inventory
  - lot pressure
- Advanced filtering by:
  - make
  - status
  - body style
  - age bucket
  - mileage range
  - price range
- Vehicle detail drawer with desk notes and recent activity
- CSV export for the current filtered inventory view
- Activity history for:
  - vehicle creation
  - updates
  - status changes
  - deletions

## Project Structure

```text
Inventory Manager/
├── app.js
├── index.html
├── server.js
├── styles.css
├── README.md
└── data/
    ├── activity.json
    └── inventory.json
```

## Local Setup

### Requirements

- Node.js 18+ recommended

### Run the app

From the project folder:

```powershell
node server.js
```

Then open:

```text
http://127.0.0.1:3000/
```

If port `3000` is already in use, run with a different port:

```powershell
$env:PORT=3001
node server.js
```

## API Endpoints

### Health

- `GET /api/health`

### Vehicles

- `GET /api/vehicles`
- `POST /api/vehicles`
- `PUT /api/vehicles/:id`
- `DELETE /api/vehicles/:id`
- `POST /api/vehicles/:id/status`

### Activity

- `GET /api/activity`

## Notes

- Data is stored locally in `data/inventory.json` and `data/activity.json`
- This makes the app easy to run and demo, but it is not a production database setup
- For a more production-ready version, the next step would be moving data to SQLite or Postgres and adding authentication

## Good Next Steps

- Add user authentication and role-based access
- Add recon checklists and photo workflow
- Add sold/customer hold pipeline details
- Add pricing history and markdown suggestions
- Deploy the app to a host that supports both frontend and backend

## License

This project is currently for internal/demo use unless you choose a license for public release.
