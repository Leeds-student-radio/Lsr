import { adminContext, retryVerification } from "./admin.js";

const { values, service } = adminContext();
try {
  if (values.certify) await service.runMaintenance({ allowUnverified: true });
  const result = await retryVerification(() => service.verify({ certify: values.certify }));
  if (values.certify) await service.runMaintenance();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
}
