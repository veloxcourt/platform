import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main() {
  const email = (process.argv[2] ?? "mguajardo970@gmail.com").trim().toLowerCase();
  const result = await prisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { isSuperAdmin: true },
  });
  if (result.count === 0) {
    throw new Error(`No se encontró el usuario ${email}`);
  }
  console.log(`Superadmin habilitado para ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Evita cerrar el pool global si el script reutiliza el singleton en HMR.
  });
