const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function run() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@qms.com' },
    update: {},
    create: {
      email: 'admin@qms.com',
      name: 'Super Admin',
      passwordHash: adminPassword,
      role: 'Super Admin',
      department: 'Management'
    }
  });

  const managerPassword = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { email: 'manager@qms.com' },
    update: {},
    create: {
      email: 'manager@qms.com',
      name: 'Manager',
      passwordHash: managerPassword,
      role: 'Manager',
      department: 'Operations'
    }
  });

  const staffPassword = await bcrypt.hash('staff123', 10);
  await prisma.user.upsert({
    where: { email: 'staff@qms.com' },
    update: {},
    create: {
      email: 'staff@qms.com',
      name: 'Staff',
      passwordHash: staffPassword,
      role: 'Staff',
      department: 'Production'
    }
  });

  console.log('Seed users created.');
}

run().catch(console.error).finally(() => prisma.$disconnect());
