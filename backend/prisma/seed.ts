import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminEmail = 'admin@societygatepass.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'System Administrator',
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log('✓ Created admin user:', admin.email);
  } else {
    console.log('Admin user already exists');
  }

  // Create a sample owner user
  const ownerEmail = 'owner@test.com';
  const existingOwner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!existingOwner) {
    const hashedPassword = await bcrypt.hash('Owner@123', 10);
    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        fullName: 'John Doe',
        passwordHash: hashedPassword,
        role: UserRole.OWNER,
        isActive: true,
      },
    });
    console.log('✓ Created owner user:', owner.email);

    // Create a house for the owner
    const house = await prisma.house.create({
      data: {
        houseNumber: 'A-101',
        block: 'A',
        ownerId: owner.id,
      },
    });
    console.log('✓ Created house:', house.houseNumber);
  } else {
    console.log('Owner user already exists');
  }

  // Create a sample security user
  const securityEmail = 'security@test.com';
  const existingSecurity = await prisma.user.findUnique({
    where: { email: securityEmail },
  });

  if (!existingSecurity) {
    const hashedPassword = await bcrypt.hash('Security@123', 10);
    const security = await prisma.user.create({
      data: {
        email: securityEmail,
        fullName: 'Guard Singh',
        passwordHash: hashedPassword,
        role: UserRole.SECURITY,
        isActive: true,
      },
    });
    console.log('✓ Created security user:', security.email);
  } else {
    console.log('Security user already exists');
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📝 Default credentials:');
  console.log('Admin: admin@societygatepass.com / Admin@123');
  console.log('Owner: owner@test.com / Owner@123');
  console.log('Security: security@test.com / Security@123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
