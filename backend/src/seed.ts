import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { hashPassword } from './infra/auth/passwordHasher.js';
import { prisma } from './infra/prisma.js';
import * as orderService from './services/orderService.js';
import * as codes from './infra/paymentGateways/paymentCodes.js';

/** Cria o usuário admin se ainda não existir. Não sobrescreve a senha de um
 * admin já existente (o admin pode trocá-la depois sem ser resetado a cada
 * deploy). O e-mail é normalizado em minúsculas (login compara assim). */
export async function ensureAdmin(): Promise<void> {
  const email = config.seed.adminEmail.trim().toLowerCase();
  const password = config.seed.adminPassword;
  if (!email || !password) return;
  if (await prisma.user.findUnique({ where: { email } })) return;

  await prisma.user.create({
    data: {
      name: 'Administrador',
      email,
      passwordHash: hashPassword(password),
      role: 'Admin',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=admin',
    },
  });
}

const IMAGES = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
  'https://images.unsplash.com/photo-1503602642458-232111445657?w=600',
  'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600',
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600',
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600',
  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600',
];

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Seed idempotente — espelha os mocks do front (paridade visual). Só roda
 * se SEED_ENABLED=true e ainda não houver nenhum parceiro cadastrado. */
export async function seedDemo(): Promise<void> {
  await ensureAdmin();
  if (!config.seed.enabled) return;
  if (await prisma.partner.count()) return;

  const prodCats = ['Alimentação', 'Cafeteria', 'Entretenimento', 'Educação', 'Tecnologia', 'Beleza', 'Saúde', 'Serviços'];
  const storeCats = [
    'Cafeteria',
    'Restaurante',
    'Lanchonete',
    'Cinema',
    'Academia',
    'Salão de Beleza',
    'Loja Digital',
    'Educação',
    'Petshop',
    'Farmácia',
  ];
  await prisma.category.createMany({
    data: [
      ...prodCats.map((name) => ({ name, type: 'Product' as const })),
      ...storeCats.map((name) => ({ name, type: 'Store' as const })),
    ],
  });

  const pCafe = await prisma.partner.create({
    data: {
      name: 'Estação do Café',
      segment: 'Cafeteria',
      feePercent: 10,
      logoUrl: 'https://api.dicebear.com/9.x/icons/svg?seed=cafe&backgroundType=gradientLinear',
      joinedAt: new Date('2025-08-12'),
      cnpj: '12.345.678/0001-90',
      city: 'São Paulo',
      state: 'SP',
      lat: -23.5505,
      lng: -46.6333,
    },
  });
  const pCine = await prisma.partner.create({
    data: {
      name: 'CineHub',
      segment: 'Cinema',
      feePercent: 12,
      logoUrl: 'https://api.dicebear.com/9.x/icons/svg?seed=cinema&backgroundType=gradientLinear',
      joinedAt: new Date('2025-09-02'),
      cnpj: '23.456.789/0001-01',
      city: 'Belo Horizonte',
      state: 'MG',
      lat: -19.9386,
      lng: -43.9352,
    },
  });
  const pBurger = await prisma.partner.create({
    data: {
      name: 'BurgerLab',
      segment: 'Restaurante',
      feePercent: 15,
      logoUrl: 'https://api.dicebear.com/9.x/icons/svg?seed=burger&backgroundType=gradientLinear',
      joinedAt: new Date('2025-10-21'),
      cnpj: '34.567.890/0001-12',
      city: 'São Paulo',
      state: 'SP',
      lat: -23.5469,
      lng: -46.6911,
    },
  });
  const pTech = await prisma.partner.create({
    data: {
      name: 'EduDigital',
      segment: 'Loja Digital',
      feePercent: 8,
      logoUrl: 'https://api.dicebear.com/9.x/icons/svg?seed=tech&backgroundType=gradientLinear',
      joinedAt: new Date('2026-01-08'),
      cnpj: '45.678.901/0001-23',
    },
  });
  const pBeauty = await prisma.partner.create({
    data: {
      name: 'Studio Belle',
      segment: 'Salão de Beleza',
      feePercent: 12,
      logoUrl: 'https://api.dicebear.com/9.x/icons/svg?seed=belle&backgroundType=gradientLinear',
      joinedAt: new Date('2025-11-03'),
      cnpj: '56.789.012/0001-34',
      city: 'São Paulo',
      state: 'SP',
      lat: -23.565,
      lng: -46.68,
    },
  });
  const pFit = await prisma.partner.create({
    data: {
      name: 'VidaFit',
      segment: 'Academia',
      feePercent: 10,
      logoUrl: 'https://api.dicebear.com/9.x/icons/svg?seed=fit&backgroundType=gradientLinear',
      joinedAt: new Date('2025-12-01'),
      cnpj: '67.890.123/0001-45',
      city: 'Rio de Janeiro',
      state: 'RJ',
      lat: -23.001,
      lng: -43.365,
    },
  });

  await prisma.partnerStore.createMany({
    data: [
      { partnerId: pCafe.id, name: 'Estação do Café - Centro', address: 'Rua das Flores, 120 - Centro', city: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333, category: 'Cafeteria' },
      { partnerId: pCafe.id, name: 'Estação do Café - Jardins', address: 'Av. Paulista, 900 - Jardins', city: 'São Paulo', state: 'SP', lat: -23.5618, lng: -46.6565, category: 'Cafeteria' },
      { partnerId: pCafe.id, name: 'Estação do Café - Copacabana', address: 'Av. Atlântica, 1700 - Copacabana', city: 'Rio de Janeiro', state: 'RJ', lat: -22.9711, lng: -43.1822, category: 'Cafeteria' },
      { partnerId: pCine.id, name: 'CineHub Shopping Sul', address: 'Av. das Nações, 4500 - Sul', city: 'São Paulo', state: 'SP', lat: -23.5896, lng: -46.6402, category: 'Entretenimento' },
      { partnerId: pCine.id, name: 'CineHub BH Savassi', address: 'Rua Pernambuco, 1000 - Savassi', city: 'Belo Horizonte', state: 'MG', lat: -19.9386, lng: -43.9352, category: 'Entretenimento' },
      { partnerId: pBurger.id, name: 'BurgerLab Vila Madalena', address: 'Rua Aspicuelta, 350 - Vila Madalena', city: 'São Paulo', state: 'SP', lat: -23.5469, lng: -46.6911, category: 'Alimentação' },
      { partnerId: pBurger.id, name: 'BurgerLab Itaim', address: 'Rua Joaquim Floriano, 700 - Itaim', city: 'São Paulo', state: 'SP', lat: -23.5839, lng: -46.6776, category: 'Alimentação' },
      { partnerId: pBurger.id, name: 'BurgerLab Asa Sul', address: 'CLS 410 Bloco B - Asa Sul', city: 'Brasília', state: 'DF', lat: -15.8267, lng: -47.9218, category: 'Alimentação' },
      { partnerId: pBeauty.id, name: 'Studio Belle Pinheiros', address: 'Rua dos Pinheiros, 200', city: 'São Paulo', state: 'SP', lat: -23.565, lng: -46.68, category: 'Beleza' },
      { partnerId: pFit.id, name: 'VidaFit Barra', address: 'Av. das Américas, 5000 - Barra', city: 'Rio de Janeiro', state: 'RJ', lat: -23.001, lng: -43.365, category: 'Saúde' },
    ],
  });

  const prodCombo = await prisma.product.create({
    data: { partnerId: pCafe.id, title: 'Combo Café + Croissant', description: 'Café espresso 60ml com croissant amanteigado quentinho.', price: 18.9, cashbackPercent: 5, kind: 'Voucher', imageUrl: IMAGES[0], category: 'Cafeteria', rating: 4.8, stock: 120 },
  });
  const prodCine = await prisma.product.create({
    data: { partnerId: pCine.id, title: 'Ingresso CineHub - Sessão dupla', description: '2 ingressos para qualquer sessão 2D, válidos por 60 dias.', price: 49.9, cashbackPercent: 8, kind: 'Voucher', imageUrl: IMAGES[1], category: 'Entretenimento', rating: 4.6, stock: 50 },
  });
  const prodBurger = await prisma.product.create({
    data: { partnerId: pBurger.id, title: 'Smash Burger Duplo + Fritas', description: 'Hambúrguer artesanal duplo com fritas crocantes.', price: 39.5, cashbackPercent: 10, kind: 'Voucher', imageUrl: IMAGES[2], category: 'Alimentação', rating: 4.9, stock: 80 },
  });

  // Catálogo amplo (>30 itens) para paginação real, incl. digitais sem local.
  let seed = 42;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const gen: { partnerId: string; category: string; kind: 'Physical' | 'Digital' | 'Voucher'; title: string }[] = [
    { partnerId: pCafe.id, category: 'Cafeteria', kind: 'Voucher', title: 'Cappuccino Premium' },
    { partnerId: pCafe.id, category: 'Cafeteria', kind: 'Physical', title: 'Caneca Estação do Café' },
    { partnerId: pCafe.id, category: 'Cafeteria', kind: 'Voucher', title: 'Café da Manhã Completo' },
    { partnerId: pCafe.id, category: 'Cafeteria', kind: 'Voucher', title: 'Combo Latte + Bolo' },
    { partnerId: pBurger.id, category: 'Alimentação', kind: 'Voucher', title: 'Combo Cheddar Bacon' },
    { partnerId: pBurger.id, category: 'Alimentação', kind: 'Voucher', title: 'Voucher 20% off no balcão' },
    { partnerId: pBurger.id, category: 'Alimentação', kind: 'Voucher', title: 'Veggie Burger + Suco' },
    { partnerId: pBurger.id, category: 'Alimentação', kind: 'Voucher', title: 'Combo Família (4 burgers)' },
    { partnerId: pCine.id, category: 'Entretenimento', kind: 'Voucher', title: 'Ingresso 3D + Pipoca' },
    { partnerId: pCine.id, category: 'Entretenimento', kind: 'Voucher', title: 'Pacote Casal (2 ingressos)' },
    { partnerId: pCine.id, category: 'Entretenimento', kind: 'Voucher', title: 'Sessão Premium VIP' },
    { partnerId: pTech.id, category: 'Educação', kind: 'Digital', title: 'Curso de Direção Defensiva' },
    { partnerId: pTech.id, category: 'Educação', kind: 'Digital', title: 'Curso de Inglês Online' },
    { partnerId: pTech.id, category: 'Educação', kind: 'Digital', title: 'Mentoria de Carreira (3 sessões)' },
    { partnerId: pTech.id, category: 'Tecnologia', kind: 'Digital', title: 'E-book: Finanças Pessoais' },
    { partnerId: pTech.id, category: 'Tecnologia', kind: 'Digital', title: 'Assinatura App Produtividade' },
    { partnerId: pTech.id, category: 'Educação', kind: 'Digital', title: 'Workshop de Excel Avançado' },
    { partnerId: pBeauty.id, category: 'Beleza', kind: 'Voucher', title: 'Corte + Escova' },
    { partnerId: pBeauty.id, category: 'Beleza', kind: 'Voucher', title: 'Dia de Spa Relax' },
    { partnerId: pBeauty.id, category: 'Beleza', kind: 'Voucher', title: 'Manicure + Pedicure' },
    { partnerId: pBeauty.id, category: 'Beleza', kind: 'Physical', title: 'Kit Skincare Premium' },
    { partnerId: pFit.id, category: 'Saúde', kind: 'Voucher', title: 'Day Use Academia' },
    { partnerId: pFit.id, category: 'Saúde', kind: 'Voucher', title: 'Avaliação Física + Plano' },
    { partnerId: pFit.id, category: 'Saúde', kind: 'Voucher', title: 'Aula de Yoga (pacote 5)' },
    { partnerId: pFit.id, category: 'Serviços', kind: 'Voucher', title: 'Personal Trainer (1h)' },
    { partnerId: pCafe.id, category: 'Serviços', kind: 'Voucher', title: 'Aluguel de espaço p/ reunião' },
    { partnerId: pBurger.id, category: 'Alimentação', kind: 'Voucher', title: 'Milkshake Artesanal' },
    { partnerId: pCine.id, category: 'Entretenimento', kind: 'Voucher', title: 'Combo Aniversário (10 ingressos)' },
    { partnerId: pBeauty.id, category: 'Beleza', kind: 'Voucher', title: 'Maquiagem Profissional' },
    { partnerId: pFit.id, category: 'Saúde', kind: 'Digital', title: 'Plano de Treino Online (mensal)' },
    { partnerId: pTech.id, category: 'Tecnologia', kind: 'Digital', title: 'Template de Currículo + Revisão' },
    { partnerId: pCafe.id, category: 'Cafeteria', kind: 'Voucher', title: 'Cartão Fidelidade 10 cafés' },
  ];
  for (const g of gen) {
    const price = Math.round(randInt(rng, 990, 19990)) / 100;
    await prisma.product.create({
      data: {
        partnerId: g.partnerId,
        title: g.title,
        description: `${g.title} — oferta com cashback.`,
        price,
        cashbackPercent: randInt(rng, 3, 12),
        kind: g.kind,
        imageUrl: IMAGES[randInt(rng, 0, IMAGES.length - 1)],
        category: g.category,
        rating: Math.round((3.8 + rng() * 1.2) * 10) / 10,
        stock: g.kind === 'Digital' ? 9999 : randInt(rng, 15, 300),
      },
    });
  }

  const pwd = hashPassword('Demo@123');
  const cliente = await prisma.user.create({
    data: { name: 'Mariana Souza', email: 'cliente@demo.com', passwordHash: pwd, role: 'Client', cashbackBalance: 12.45, avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=mariana' },
  });
  const pedro = await prisma.user.create({
    data: { name: 'Pedro Lima', email: 'pedro@demo.com', passwordHash: pwd, role: 'Client', cashbackBalance: 3.99 },
  });
  await prisma.user.create({
    data: { name: 'João Silva (BurgerLab)', email: 'parceiro@demo.com', passwordHash: pwd, role: 'Partner', partnerId: pBurger.id, avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=joao' },
  });
  await prisma.user.create({
    data: { name: 'Admin OpenDriverHub', email: 'admin@demo.com', passwordHash: pwd, role: 'Admin', avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=admin' },
  });

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  await prisma.order.create({
    data: {
      code: orderService.generateCode(),
      customerId: cliente.id,
      paidPrice: 18.9,
      cashbackEarned: 0.95,
      status: 'Paid',
      paymentMethod: 'Pix',
      paidAt: daysAgo(3),
      voucherCode: codes.voucher(),
      createdAt: daysAgo(3),
      items: {
        create: [
          {
            productId: prodCombo.id,
            partnerId: pCafe.id,
            productTitle: prodCombo.title,
            imageUrl: prodCombo.imageUrl,
            category: prodCombo.category,
            unitPrice: 18.9,
            quantity: 1,
            cashbackPercent: 5,
            lineTotal: 18.9,
            cashbackEarned: 0.95,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      code: orderService.generateCode(),
      customerId: cliente.id,
      paidPrice: 39.5,
      cashbackEarned: 3.95,
      cashbackUsed: 2.0,
      status: 'Redeemed',
      paymentMethod: 'CreditCard',
      paidAt: daysAgo(7),
      redeemedAt: daysAgo(6),
      voucherCode: codes.voucher(),
      createdAt: daysAgo(7),
      items: {
        create: [
          {
            productId: prodBurger.id,
            partnerId: pBurger.id,
            productTitle: prodBurger.title,
            imageUrl: prodBurger.imageUrl,
            category: prodBurger.category,
            unitPrice: 39.5,
            quantity: 1,
            cashbackPercent: 10,
            lineTotal: 39.5,
            cashbackEarned: 3.95,
            redeemedAt: daysAgo(6),
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      code: orderService.generateCode(),
      customerId: pedro.id,
      paidPrice: 49.9,
      cashbackEarned: 3.99,
      status: 'Paid',
      paymentMethod: 'Pix',
      paidAt: daysAgo(1),
      voucherCode: codes.voucher(),
      createdAt: daysAgo(1),
      items: {
        create: [
          {
            productId: prodCine.id,
            partnerId: pCine.id,
            productTitle: prodCine.title,
            imageUrl: prodCine.imageUrl,
            category: prodCine.category,
            unitPrice: 49.9,
            quantity: 1,
            cashbackPercent: 8,
            lineTotal: 49.9,
            cashbackEarned: 3.99,
          },
        ],
      },
    },
  });
}

// Executado diretamente via `npm run seed` (não dispara ao importar
// ensureAdmin/seedDemo de outro módulo, como o server.ts faz).
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seedDemo()
    .then(() => {
      console.log('Seed concluído.');
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
