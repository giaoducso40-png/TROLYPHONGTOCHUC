/* eslint-disable @typescript-eslint/no-require-imports */
const os = require("node:os");

const loopback = [{
  address: "127.0.0.1",
  netmask: "255.0.0.0",
  family: "IPv4",
  mac: "00:00:00:00:00:00",
  internal: true,
  cidr: "127.0.0.1/8",
}];

// Some managed preview sandboxes deny the native interface enumeration call.
// Vite only needs a safe local address for display and HMR bookkeeping.
try {
  os.networkInterfaces = () => ({ lo: loopback });
} catch {
  // If the runtime freezes the module object, leave the native behavior intact.
}
