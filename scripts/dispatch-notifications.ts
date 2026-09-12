import { dispatchDueNotifications } from "../src/lib/notifications/dispatch.server";

const rawLimit = process.argv[2] ?? process.env["NOTIFICATION_BATCH_SIZE"] ?? "25";
const limit = Number(rawLimit);

if (!Number.isFinite(limit) || limit < 1) {
  console.error("Invalid notification batch size.");
  process.exit(1);
}

const result = await dispatchDueNotifications(limit);
console.log(JSON.stringify(result));

if (result.failed > 0) {
  process.exitCode = 1;
}
