import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { Prisma, PrismaClient } from '../generated/prisma';
config();
const db = new PrismaClient();
function id(key: string) {
  const hex = createHash('sha256').update(`tea-element-demo:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const categories = [
  ['puer', 'Пуер', 'Чаї з Юньнаню, що розкриваються з часом.'],
  ['oolong', 'Улун', 'Різноманіття ароматів та ступенів обсмаження.'],
  ['green', 'Зелений чай', 'Легкість та свіжість чайного листа.'],
  ['red', 'Червоний чай', 'Теплі й насичені чайні настої.'],
  ['white', 'Білий чай', 'Делікатний смак та м’який характер.'],
  ['gaba', 'Габа', 'Чай для неквапливих вечірніх ритуалів.'],
  ['herbal', 'Трав’яний чай', 'Квіткові й трав’яні настої без чайного листа.'],
] as const;
// All descriptions, origins, years, guides, prices and stocks below are synthetic demo merchandising data.
const teas = [
  {
    slug: 'shu-puer-gun-ting',
    name: 'Шу Пуер Гун Тін',
    original: '宫廷熟普洱',
    category: 'puer',
    origin: 'Юньнань',
    price: 9500,
    stock: 1800,
    temperature: 95,
    seconds: 15,
    infusions: 8,
    description: 'Густий настій із м’якими деревними та горіховими відтінками.',
  },
  {
    slug: 'shen-puer-jing-mai',
    name: 'Шен Пуер Цзін Май',
    original: '景迈生普洱',
    category: 'puer',
    origin: 'Юньнань',
    price: 14500,
    stock: 1200,
    temperature: 90,
    seconds: 15,
    infusions: 10,
    description: 'Виразний смак із квітковими нотами та тривалим післясмаком.',
  },
  {
    slug: 'tie-guan-yin',
    name: 'Те Гуань Інь',
    original: '铁观音',
    category: 'oolong',
    origin: 'Фуцзянь',
    price: 11000,
    stock: 2000,
    temperature: 90,
    seconds: 20,
    infusions: 7,
    description: 'Легкий улун із квітковим ароматом та свіжим післясмаком.',
  },
  {
    slug: 'da-hong-pao',
    name: 'Да Хун Пао',
    original: '大红袍',
    category: 'oolong',
    origin: 'Фуцзянь',
    price: 13500,
    stock: 1600,
    temperature: 95,
    seconds: 20,
    infusions: 8,
    description: 'Теплі відтінки обсмаження, насичений смак і довгий післясмак.',
  },
  {
    slug: 'dong-ding',
    name: 'Дун Дін',
    original: '冻顶乌龙',
    category: 'oolong',
    origin: 'Тайвань',
    price: 15500,
    stock: 900,
    temperature: 90,
    seconds: 25,
    infusions: 7,
    description: 'Округлий смак із горіховими й квітковими нотами.',
  },
  {
    slug: 'long-jing',
    name: 'Лун Цзін',
    original: '龙井',
    category: 'green',
    origin: 'Чжецзян',
    price: 12000,
    stock: 1400,
    temperature: 80,
    seconds: 30,
    infusions: 4,
    description: 'Свіжий зелений чай із делікатними трав’яними нотами.',
  },
  {
    slug: 'bi-luo-chun',
    name: 'Бі Ло Чунь',
    original: '碧螺春',
    category: 'green',
    origin: 'Цзянсу',
    price: 12500,
    stock: 800,
    temperature: 80,
    seconds: 25,
    infusions: 4,
    description: 'М’який зелений настій із тонким квітковим ароматом.',
  },
  {
    slug: 'dian-hong',
    name: 'Дянь Хун',
    original: '滇红',
    category: 'red',
    origin: 'Юньнань',
    price: 8500,
    stock: 2500,
    temperature: 90,
    seconds: 20,
    infusions: 6,
    description: 'Зігрівальний червоний чай із солодкими та солодовими відтінками.',
  },
  {
    slug: 'jin-jun-mei',
    name: 'Цзінь Цзюнь Мей',
    original: '金骏眉',
    category: 'red',
    origin: 'Фуцзянь',
    price: 16500,
    stock: 650,
    temperature: 90,
    seconds: 15,
    infusions: 6,
    description: 'Делікатний настій із фруктовими та медовими нотами.',
  },
  {
    slug: 'bai-mu-dan',
    name: 'Бай Му Дань',
    original: '白牡丹',
    category: 'white',
    origin: 'Фуцзянь',
    price: 10500,
    stock: 1100,
    temperature: 85,
    seconds: 30,
    infusions: 6,
    description: 'М’який білий чай із квітковими відтінками та легкою солодкістю.',
  },
  {
    slug: 'gaba-oolong',
    name: 'Габа Улун',
    original: '佳葉龍茶',
    category: 'gaba',
    origin: 'Тайвань',
    price: 15000,
    stock: 40,
    temperature: 90,
    seconds: 25,
    infusions: 7,
    description: 'Теплий фруктовий аромат і м’яка кислинка у післясмаку.',
  },
  {
    slug: 'ju-hua',
    name: 'Цзюй Хуа — хризантема',
    original: '菊花',
    category: 'herbal',
    origin: 'Аньхой',
    price: 6000,
    stock: 0,
    temperature: 90,
    seconds: 60,
    infusions: 3,
    description: 'Легкий квітковий настій для спокійного чаювання.',
  },
] as const;
const equipment = [
  {
    slug: 'porcelain-gaiwan',
    name: 'Гайвань порцелянова · 110 мл',
    category: 'teaware',
    price: 89000,
    stock: 12,
    image: 'gaiwan',
    description:
      'Лаконічна порцелянова гайвань із кришкою та блюдцем для коротких проливів. Об’єм 110 мл. Після чаювання промийте теплою водою та висушіть.',
  },
  {
    slug: 'porcelain-tea-cup',
    name: 'Піала порцелянова · 60 мл',
    category: 'teaware',
    price: 22000,
    stock: 30,
    image: 'tea-cup',
    description:
      'Невелика порцелянова піала для неквапливого чаювання. Об’єм 60 мл. Теплий світлий відтінок пасує до гайвані та дерев’яної чайної дошки.',
  },
  {
    slug: 'tea-strainer',
    name: 'Ситечко для чаю з підставкою',
    category: 'accessories',
    price: 24000,
    stock: 20,
    image: 'tea-strainer',
    description:
      'Дрібна сітка з нержавної сталі затримує чайне листя під час переливання настою. Підставка допомагає зберегти місце для чаювання охайним.',
  },
  {
    slug: 'bamboo-tea-tongs',
    name: 'Чайні щипці з бамбука',
    category: 'accessories',
    price: 18000,
    stock: 1,
    image: 'tea-tongs',
    description:
      'Легкі бамбукові щипці для чайного посуду. Використовуйте обережно, після миття просушуйте й не залишайте надовго у воді.',
  },
] as const;
async function main() {
  await db.$transaction(
    async (tx) => {
      for (const [sortOrder, [slug, name, description]] of categories.entries()) {
        await tx.category.upsert({
          where: { slug },
          update: {},
          create: { id: id(slug), slug, name, description, sortOrder },
        });
      }
      for (const tea of teas) {
        const category = await tx.category.findUniqueOrThrow({ where: { slug: tea.category } });
        const product = await tx.product.upsert({
          where: { slug: tea.slug },
          update: {},
          create: {
            id: id(tea.slug),
            slug: tea.slug,
            name: tea.name,
            nameOriginal: tea.original,
            categoryId: category.id,
            origin: tea.origin,
            description: tea.description,
            images: [],
            tags: [tea.category],
            year: 2025,
            brewingGuide: {
              temperatureCelsius: tea.temperature,
              seconds: tea.seconds,
              infusions: tea.infusions,
            },
          },
        });
        for (const weight of [25, 50, 100]) {
          await tx.productVariant.upsert({
            where: { productId_weightGrams: { productId: product.id, weightGrams: weight } },
            update: {},
            create: {
              id: id(`${tea.slug}-${weight}`),
              productId: product.id,
              weightGrams: weight,
              price: tea.price * (weight / 25),
              sku: `${tea.slug}-${weight}`,
            },
          });
        }
        await tx.inventory.upsert({
          where: { productId: product.id },
          update: {},
          create: {
            productId: product.id,
            stockGrams: tea.stock,
            reservedGrams: 0,
            lowStockThresholdGrams: 100,
          },
        });
      }
      for (const [offset, [slug, name, description]] of [
        ['teaware', 'Посуд', 'Гайвані та піали для вашого щоденного чаювання.'],
        ['accessories', 'Аксесуари', 'Практичні дрібниці, що доповнюють чайний ритуал.'],
      ].entries()) {
        await tx.category.upsert({
          where: { slug: slug! },
          update: {},
          create: {
            id: id(slug!),
            slug: slug!,
            name: name!,
            description: description!,
            sortOrder: 7 + offset,
            section: 'EQUIPMENT',
          },
        });
      }
      for (const item of equipment) {
        const category = await tx.category.findUniqueOrThrow({ where: { slug: item.category } });
        const product = await tx.product.upsert({
          where: { slug: item.slug },
          update: {},
          create: {
            id: id(item.slug),
            slug: item.slug,
            name: item.name,
            nameOriginal: '',
            description: item.description,
            origin: 'Китай',
            categoryId: category.id,
            images: [`/images/${item.image}.png`],
            tags: [item.category],
            brewingGuide: Prisma.DbNull,
          },
        });
        await tx.productVariant.upsert({
          where: { sku: item.slug },
          update: {},
          create: {
            id: id(`${item.slug}-piece`),
            productId: product.id,
            sku: item.slug,
            weightGrams: null,
            price: item.price,
          },
        });
        await tx.inventory.upsert({
          where: { productId: product.id },
          update: {},
          create: {
            productId: product.id,
            stockPieces: item.stock,
            reservedPieces: 0,
            stockGrams: 0,
            reservedGrams: 0,
          },
        });
      }
      for (const promo of [
        {
          key: 'demo-oolong-percent',
          name: 'Знайомство з улунами',
          type: 'PERCENT' as const,
          value: 10,
          category: 'oolong',
          product: null,
        },
        {
          key: 'demo-dian-hong-fixed',
          name: 'Теплий чайний ритуал',
          type: 'FIXED' as const,
          value: 1000,
          category: null,
          product: 'dian-hong',
        },
      ]) {
        const promotion = await tx.promotion.upsert({
          where: { id: id(promo.key) },
          update: {},
          create: {
            id: id(promo.key),
            name: promo.name,
            type: promo.type,
            value: promo.value,
            startsAt: new Date('2026-01-01T00:00:00Z'),
            endsAt: new Date('2030-01-01T00:00:00Z'),
          },
        });
        const product = promo.product
          ? await tx.product.findUniqueOrThrow({ where: { slug: promo.product } })
          : null;
        const category = promo.category
          ? await tx.category.findUniqueOrThrow({ where: { slug: promo.category } })
          : null;
        await tx.promotionTarget.upsert({
          where: { id: id(`${promo.key}-target`) },
          update: {},
          create: {
            id: id(`${promo.key}-target`),
            promotionId: promotion.id,
            productId: product?.id,
            categoryId: category?.id,
          },
        });
      }
    },
    { timeout: 20000 },
  );
  console.log(
    'Demo catalog ready: 9 categories, 12 teas, 4 equipment products, 40 variants and 2 promotions. Existing rows were preserved.',
  );
}
main()
  .catch(() => {
    console.error('Catalog seed failed; verify schema and connection settings.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
