import "dotenv/config";
import {
  PrismaClient,
  type BookingStatus,
  type PaymentStatus,
  type BookingType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Club demo
  const defaultLevels = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "8va"];
  const club = await prisma.club.upsert({
    where: { slug: "club-demo" },
    update: { categories: defaultLevels },
    create: {
      name: "Club Demo Pádel",
      slug: "club-demo",
      enabledModules: ["turnos", "torneos", "herramientas"],
      categories: defaultLevels,
      bookingSettings: {
        create: {
          openTime: "08:00",
          closeTime: "23:00",
          slotDurationMin: 90,
          intervalMin: 0,
          preReservationMin: 15,
          requirePrePayment: false,
        },
      },
    },
  });

  // Canchas
  const courtsData = [
    { name: "Cancha 1", order: 1 },
    { name: "Cancha 2", order: 2 },
    { name: "Cancha 3 (Cristal)", order: 3 },
    { name: "Cancha 4", order: 4 },
  ];

  for (const c of courtsData) {
    const exists = await prisma.court.findFirst({
      where: { clubId: club.id, name: c.name },
    });
    if (!exists) {
      await prisma.court.create({
        data: { clubId: club.id, name: c.name, order: c.order },
      });
    }
  }

  // Usuarios + membresías demo
  const owner = await prisma.user.upsert({
    where: { email: "owner@club-demo.test" },
    update: {},
    create: {
      id: "demo-owner",
      email: "owner@club-demo.test",
      fullName: "Dueño Demo",
    },
  });

  await prisma.membership.upsert({
    where: {
      clubId_userId_role: { clubId: club.id, userId: owner.id, role: "OWNER" },
    },
    update: {},
    create: { clubId: club.id, userId: owner.id, role: "OWNER" },
  });

  // Jugadores demo para testear torneos: 48 hombres + 48 mujeres
  const maleFirstNames = [
    "Martín",
    "Diego",
    "Nicolás",
    "Santiago",
    "Matías",
    "Tomás",
    "Facundo",
    "Agustín",
    "Lucas",
    "Julián",
    "Gonzalo",
    "Federico",
    "Bruno",
    "Ignacio",
    "Sebastián",
    "Andrés",
    "Emiliano",
    "Joaquín",
    "Pablo",
    "Ramiro",
    "Lautaro",
    "Franco",
    "Maximiliano",
    "Gabriel",
    "Hernán",
    "Leandro",
    "Mauricio",
    "Rodrigo",
    "Esteban",
    "Cristian",
    "Iván",
    "Manuel",
    "Oscar",
    "Pedro",
    "Ricardo",
    "Sergio",
    "Ulises",
    "Valentín",
    "Walter",
    "Xavier",
    "Yago",
    "Zacarías",
    "Benjamín",
    "Damián",
    "Ezequiel",
    "Felipe",
    "Gastón",
    "Hugo",
  ];
  const femaleFirstNames = [
    "Lucía",
    "Sofía",
    "Valentina",
    "Camila",
    "Martina",
    "Julieta",
    "Florencia",
    "Catalina",
    "Micaela",
    "Agustina",
    "Paula",
    "Carolina",
    "Victoria",
    "Antonella",
    "Natalia",
    "Romina",
    "Daniela",
    "Abril",
    "Milagros",
    "Bianca",
    "Delfina",
    "Emilia",
    "Guillermina",
    "Helena",
    "Inés",
    "Jimena",
    "Kiara",
    "Lola",
    "Malena",
    "Noelia",
    "Olivia",
    "Pilar",
    "Renata",
    "Sol",
    "Tamara",
    "Úrsula",
    "Violeta",
    "Wendy",
    "Ximena",
    "Yazmín",
    "Zoe",
    "Ailén",
    "Brenda",
    "Celeste",
    "Denise",
    "Elena",
    "Fiona",
    "Gina",
  ];
  const lastNames = [
    "Pérez",
    "Gómez",
    "Fernández",
    "Ramírez",
    "Torres",
    "Ruiz",
    "López",
    "Sánchez",
    "Romero",
    "Díaz",
    "Álvarez",
    "Castro",
    "Morales",
    "Ortiz",
    "Silva",
    "Rojas",
    "Mendoza",
    "Vargas",
    "Herrera",
    "Navarro",
    "Domínguez",
    "Acosta",
    "Benítez",
    "Cuello",
    "Duarte",
    "Espinoza",
    "Figueroa",
    "García",
    "Ibarra",
    "Juárez",
    "Kaiser",
    "Luna",
    "Medina",
    "Núñez",
    "Ojeda",
    "Ponce",
    "Quiroga",
    "Reyes",
    "Soto",
    "Tapia",
    "Urrutia",
    "Vera",
    "Wagner",
    "Yáñez",
    "Zúñiga",
    "Bravo",
    "Correa",
    "Fuentes",
  ];
  const playerLevels = ["3ra", "4ta", "5ta", "6ta", "7ma"];
  const DEMO_PLAYERS_PER_GENDER = 48;

  function buildDemoPlayers(
    firstNames: string[],
    gender: "MALE" | "FEMALE",
    idPrefix: "m" | "f",
    emailPrefix: string,
  ) {
    return Array.from({ length: DEMO_PLAYERS_PER_GENDER }, (_, index) => {
      const firstName = firstNames[index % firstNames.length]!;
      const lastName = lastNames[index % lastNames.length]!;
      const n = String(index + 1).padStart(2, "0");
      return {
        id: `demo-${idPrefix}${n}`,
        email: `${emailPrefix}${n}@club-demo.test`,
        fullName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        gender,
        category: playerLevels[index % playerLevels.length]!,
      };
    });
  }

  const players = [
    ...buildDemoPlayers(maleFirstNames, "MALE", "m", "hombre"),
    ...buildDemoPlayers(femaleFirstNames, "FEMALE", "f", "mujer"),
  ];

  for (const p of players) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {
        fullName: p.fullName,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        category: p.category,
      },
      create: p,
    });
    await prisma.membership.upsert({
      where: {
        clubId_userId_role: {
          clubId: club.id,
          userId: user.id,
          role: "PLAYER",
        },
      },
      update: {},
      create: { clubId: club.id, userId: user.id, role: "PLAYER" },
    });
  }

  // Reservas demo para el día de hoy (para que el calendario no arranque vacío)
  const courts = await prisma.court.findMany({
    where: { clubId: club.id },
    orderBy: { order: "asc" },
  });

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  const demoBookings: {
    court: number;
    startTime: string;
    status: BookingStatus;
    payment: PaymentStatus;
    type: BookingType;
  }[] = [
    { court: 0, startTime: "18:00", status: "RESERVADO", payment: "PAID", type: "NO_FIJO" },
    { court: 0, startTime: "19:30", status: "PRE_RESERVA", payment: "UNPAID", type: "NO_FIJO" },
    { court: 1, startTime: "20:00", status: "RESERVADO", payment: "PARTIAL", type: "FIJO" },
    { court: 2, startTime: "09:00", status: "RESERVADO", payment: "PAID", type: "NO_FIJO" },
  ];

  for (const d of demoBookings) {
    const court = courts[d.court];
    if (!court) continue;

    const exists = await prisma.booking.findFirst({
      where: {
        clubId: club.id,
        courtId: court.id,
        date: today,
        startTime: d.startTime,
      },
    });
    if (exists) continue;

    await prisma.booking.create({
      data: {
        clubId: club.id,
        courtId: court.id,
        date: today,
        startTime: d.startTime,
        durationMin: 90,
        type: d.type,
        status: d.status,
        paymentStatus: d.payment,
        responsibleId: "demo-m01",
        createdById: "demo-owner",
        players: {
          create: [{ userId: "demo-m01" }, { userId: "demo-f01" }],
        },
      },
    });
  }

  console.log(
    `Seed completado: club-demo con canchas, settings, ${players.length} jugadores (48♂ + 48♀) y reservas demo.`,
  );

  // Torneo demo (por zonas)
  let tournament = await prisma.tournament.findFirst({
    where: { clubId: club.id, publicSlug: "torneo-verano-2026" },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        clubId: club.id,
        type: "ZONAS",
        name: "Torneo de Verano 2026",
        description: "Femenina y masculina · formato zonas",
        status: "OPEN",
        startDate: new Date("2026-02-14T00:00:00.000Z"),
        endDate: new Date("2026-02-16T00:00:00.000Z"),
        fee: 2500000,
        publicSlug: "torneo-verano-2026",
      },
    });
  }

  let femCategory = await prisma.tournamentCategory.findFirst({
    where: { tournamentId: tournament.id, name: "Femenina 5ta" },
  });
  if (!femCategory) {
    femCategory = await prisma.tournamentCategory.create({
      data: {
        tournamentId: tournament.id,
        name: "Femenina 5ta",
        sortOrder: 0,
        settings: {
          create: {},
        },
      },
    });
  }

  let mascCategory = await prisma.tournamentCategory.findFirst({
    where: { tournamentId: tournament.id, name: "Masculina 4ta" },
  });
  if (!mascCategory) {
    mascCategory = await prisma.tournamentCategory.create({
      data: {
        tournamentId: tournament.id,
        name: "Masculina 4ta",
        sortOrder: 1,
        settings: {
          create: {},
        },
      },
    });
  }

  const playDayCount = await prisma.tournamentPlayDay.count({
    where: { tournamentId: tournament.id },
  });
  if (playDayCount === 0) {
    await prisma.tournamentPlayDay.createMany({
      data: [
        {
          tournamentId: tournament.id,
          date: new Date("2026-02-14T00:00:00.000Z"),
          startTime: "09:00",
          endTime: "22:00",
        },
        {
          tournamentId: tournament.id,
          date: new Date("2026-02-15T00:00:00.000Z"),
          startTime: "09:00",
          endTime: "22:00",
        },
        {
          tournamentId: tournament.id,
          date: new Date("2026-02-16T00:00:00.000Z"),
          startTime: "09:00",
          endTime: "22:00",
        },
      ],
    });
  }

  const pairCount = await prisma.tournamentPair.count({
    where: { tournamentId: tournament.id },
  });
  if (pairCount === 0) {
    await prisma.tournamentPair.createMany({
      data: [
        {
          tournamentId: tournament.id,
          categoryId: femCategory.id,
          player1Id: "demo-f01",
          player2Id: "demo-f02",
          zoneLabel: "Zona A",
          status: "CONFIRMED",
          player1Confirmed: true,
          player2Confirmed: true,
          player1PaymentStatus: "PAID",
          player2PaymentStatus: "PAID",
          paymentStatus: "PAID",
        },
        {
          tournamentId: tournament.id,
          categoryId: femCategory.id,
          player1Id: "demo-f03",
          player2Id: "demo-f04",
          zoneLabel: "Zona A",
          status: "CONFIRMED",
          player1Confirmed: true,
          player2Confirmed: true,
          player1PaymentStatus: "PAID",
          player2PaymentStatus: "PAID",
          paymentStatus: "PAID",
        },
        {
          tournamentId: tournament.id,
          categoryId: mascCategory.id,
          player1Id: "demo-m01",
          player2Id: "demo-m02",
          status: "PENDING",
          player1Confirmed: false,
          player2Confirmed: false,
          player1PaymentStatus: "UNPAID",
          player2PaymentStatus: "UNPAID",
          paymentStatus: "UNPAID",
        },
        {
          tournamentId: tournament.id,
          categoryId: femCategory.id,
          player1Id: "demo-f05",
          player2Id: null,
          status: "PENDING",
          player1Confirmed: true,
          player2Confirmed: false,
          player1PaymentStatus: "PAID",
          player2PaymentStatus: "UNPAID",
          paymentStatus: "PAID",
        },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
