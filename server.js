const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const inventoryFile = path.join(dataDir, "inventory.json");
const activityFile = path.join(dataDir, "activity.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

let writeQueue = Promise.resolve();

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  await Promise.all([ensureFile(inventoryFile), ensureFile(activityFile)]);
}

async function ensureFile(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]\n", "utf8");
  }
}

async function readJsonArray(filePath) {
  await ensureDataFiles();
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeJsonArray(filePath, payload) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  );
  return writeQueue;
}

async function readVehicles() {
  return readJsonArray(inventoryFile);
}

async function writeVehicles(vehicles) {
  return writeJsonArray(inventoryFile, vehicles);
}

async function readActivity() {
  return readJsonArray(activityFile);
}

async function writeActivity(entries) {
  return writeJsonArray(activityFile, entries);
}

function vehicleLabel(vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
}

async function logActivity(entry) {
  const activity = await readActivity();
  activity.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry
  });
  await writeActivity(activity.slice(0, 120));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(text);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeVehicle(input, existingId) {
  const year = Number(input.year);
  const make = String(input.make || "").trim();
  const model = String(input.model || "").trim();
  const trim = String(input.trim || "").trim();
  const bodyStyle = String(input.bodyStyle || "").trim();
  const color = String(input.color || "").trim();
  const stockNumber = String(input.stockNumber || "").trim().toUpperCase();
  const vin = String(input.vin || "").trim().toUpperCase();
  const mileage = Number(input.mileage);
  const status = String(input.status || "").trim().toLowerCase();
  const lotSection = String(input.lotSection || "").trim();
  const daysOnLot = Number(input.daysOnLot);
  const acquisitionCost = Number(input.acquisitionCost);
  const listPrice = Number(input.listPrice);
  const notes = String(input.notes || "").trim();

  if (!Number.isInteger(year) || year < 1990 || year > 2035) {
    return { error: "Year must be between 1990 and 2035." };
  }
  if (!make || !model || !bodyStyle || !stockNumber || !vin) {
    return { error: "Year, make, model, body style, stock number, and VIN are required." };
  }
  if (vin.length !== 17) {
    return { error: "VIN must be 17 characters." };
  }
  if (!["available", "recon", "hold"].includes(status)) {
    return { error: "Status must be available, recon, or hold." };
  }
  if (![mileage, daysOnLot, acquisitionCost, listPrice].every(Number.isFinite)) {
    return { error: "Mileage, days on lot, acquisition cost, and list price must be valid numbers." };
  }
  if (mileage < 0 || daysOnLot < 0 || acquisitionCost < 0 || listPrice < 0) {
    return { error: "Numeric dealership values must be zero or greater." };
  }

  return {
    vehicle: {
      id: existingId || randomUUID(),
      year,
      make,
      model,
      trim,
      bodyStyle,
      color,
      stockNumber,
      vin,
      mileage,
      status,
      lotSection,
      daysOnLot,
      acquisitionCost,
      listPrice,
      notes,
      updatedAt: new Date().toISOString()
    }
  };
}

function buildVehicleMessage(vehicle) {
  if (vehicle.status === "recon") {
    return `${vehicleLabel(vehicle)} is in recon at ${vehicle.daysOnLot} days on lot.`;
  }
  if (vehicle.status === "hold") {
    return `${vehicleLabel(vehicle)} is on hold and parked in ${vehicle.lotSection || "the hold row"}.`;
  }
  if (vehicle.daysOnLot >= 60) {
    return `${vehicleLabel(vehicle)} is aging at ${vehicle.daysOnLot} days and needs pricing review.`;
  }
  return `${vehicleLabel(vehicle)} is front-line ready at ${formatCurrency(vehicle.listPrice)}.`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    return sendJson(response, 200, { ok: true, service: "dealership-inventory-api" });
  }

  if (pathname === "/api/vehicles" && request.method === "GET") {
    const vehicles = await readVehicles();
    return sendJson(response, 200, { vehicles });
  }

  if (pathname === "/api/activity" && request.method === "GET") {
    const activity = await readActivity();
    return sendJson(response, 200, { activity });
  }

  if (pathname === "/api/vehicles" && request.method === "POST") {
    const body = await readBody(request);
    const normalized = normalizeVehicle(body);
    if (normalized.error) {
      return sendJson(response, 400, { error: normalized.error });
    }

    const vehicles = await readVehicles();
    if (vehicles.some((vehicle) => vehicle.stockNumber === normalized.vehicle.stockNumber)) {
      return sendJson(response, 409, { error: "Stock number already exists." });
    }
    if (vehicles.some((vehicle) => vehicle.vin === normalized.vehicle.vin)) {
      return sendJson(response, 409, { error: "VIN already exists." });
    }

    vehicles.push(normalized.vehicle);
    await writeVehicles(vehicles);
    await logActivity({
      vehicleId: normalized.vehicle.id,
      vehicleLabel: vehicleLabel(normalized.vehicle),
      type: "create",
      message: `Added ${vehicleLabel(normalized.vehicle)} to inventory at ${formatCurrency(normalized.vehicle.listPrice)}.`
    });
    return sendJson(response, 201, { vehicle: normalized.vehicle });
  }

  if (pathname.startsWith("/api/vehicles/")) {
    const segments = pathname.split("/");
    const vehicleId = segments[3];
    const action = segments[4] || "";
    const vehicles = await readVehicles();
    const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.id === vehicleId);

    if (vehicleIndex === -1) {
      return sendJson(response, 404, { error: "Vehicle not found." });
    }

    if (request.method === "PUT" && !action) {
      const body = await readBody(request);
      const normalized = normalizeVehicle(body, vehicleId);
      if (normalized.error) {
        return sendJson(response, 400, { error: normalized.error });
      }
      if (vehicles.some((vehicle) => vehicle.id !== vehicleId && vehicle.stockNumber === normalized.vehicle.stockNumber)) {
        return sendJson(response, 409, { error: "Stock number already exists." });
      }
      if (vehicles.some((vehicle) => vehicle.id !== vehicleId && vehicle.vin === normalized.vehicle.vin)) {
        return sendJson(response, 409, { error: "VIN already exists." });
      }

      vehicles[vehicleIndex] = normalized.vehicle;
      await writeVehicles(vehicles);
      await logActivity({
        vehicleId: normalized.vehicle.id,
        vehicleLabel: vehicleLabel(normalized.vehicle),
        type: "update",
        message: buildVehicleMessage(normalized.vehicle)
      });
      return sendJson(response, 200, { vehicle: normalized.vehicle });
    }

    if (request.method === "POST" && action === "status") {
      const body = await readBody(request);
      const nextStatus = String(body.status || "").trim().toLowerCase();
      if (!["available", "recon", "hold"].includes(nextStatus)) {
        return sendJson(response, 400, { error: "Invalid status." });
      }

      const updatedVehicle = {
        ...vehicles[vehicleIndex],
        status: nextStatus,
        updatedAt: new Date().toISOString()
      };
      vehicles[vehicleIndex] = updatedVehicle;
      await writeVehicles(vehicles);
      await logActivity({
        vehicleId: updatedVehicle.id,
        vehicleLabel: vehicleLabel(updatedVehicle),
        type: "status",
        message: `${vehicleLabel(updatedVehicle)} moved to ${nextStatus === "available" ? "frontline ready" : nextStatus}.`
      });
      return sendJson(response, 200, { vehicle: updatedVehicle });
    }

    if (request.method === "DELETE" && !action) {
      const [deletedVehicle] = vehicles.splice(vehicleIndex, 1);
      await writeVehicles(vehicles);
      await logActivity({
        vehicleId: deletedVehicle.id,
        vehicleLabel: vehicleLabel(deletedVehicle),
        type: "delete",
        message: `${vehicleLabel(deletedVehicle)} was removed from active inventory.`
      });
      return sendJson(response, 200, { vehicle: deletedVehicle });
    }
  }

  return false;
}

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.normalize(path.join(rootDir, safePath));
  if (!resolvedPath.startsWith(rootDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const handled = await handleApi(request, response, url.pathname);
    if (handled !== false) return;
    await serveStatic(response, url.pathname);
  } catch (error) {
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    const message = error instanceof SyntaxError ? "Invalid JSON payload." : "Internal server error.";
    sendJson(response, statusCode, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Dealership inventory app running at http://${host}:${port}`);
});
