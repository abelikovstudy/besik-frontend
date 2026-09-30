import type { Catalog } from "../types";
import { translate } from "../lib/translations";

const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`;
const items = [
  {
    name: "Кресло Lounge",
    nameEn: "Lounge armchair",
    nameKa: "სავარძელი Lounge",
    descriptionEn:
      "Soft lines, a deep seat and a little time for yourself. Your new favorite spot at home.",
    descriptionKa:
      "რბილი ხაზები, ღრმა დასაჯდომი და ცოტა დრო საკუთარი თავისთვის. თქვენი ახალი საყვარელი ადგილი სახლში.",
    category: "1",
    brand: "Nord Studio",
    price: "429",
    image: "photo-1567538096630-e0c55bd6374c",
    description:
      "Мягкие линии, глубокое сиденье и немного времени для себя. Кресло, которое станет вашим любимым местом дома.",
    material: "Ткань, дерево",
    color: "Песочный",
  },
  {
    name: "Тарелки Forma",
    nameEn: "Forma plates",
    nameKa: "თეფშები Forma",
    descriptionEn:
      "Ceramic plates in a calm blue shade. For a lovely breakfast and a long dinner together.",
    descriptionKa:
      "კერამიკული თეფშები მშვიდ ლურჯ ფერში. ლამაზი საუზმისა და ხანგრძლივი საერთო ვახშმისთვის.",
    category: "5",
    brand: "House of Clay",
    price: "65",
    image: "photo-1578749556568-bc2c40e68b61",
    description:
      "Керамические тарелки в спокойном голубом оттенке. Для красивого завтрака и долгого ужина за общим столом.",
    material: "Керамика",
    color: "Голубой",
  },
  {
    name: "Лампа Arc",
    nameEn: "Arc lamp",
    nameKa: "სანათი Arc",
    descriptionEn:
      "Warm light for quiet evenings. A simple lamp for your desk or bedside table.",
    descriptionKa:
      "თბილი შუქი მშვიდი საღამოებისთვის. სადა სანათი სამუშაო მაგიდისა თუ საწოლის ტუმბოსთვის.",
    category: "3",
    brand: "Nord Studio",
    price: "189",
    image: "photo-1507473885765-e6ed057f782c",
    description:
      "Тёплый свет для неспешных вечеров. Лаконичная настольная лампа для рабочего стола или прикроватной тумбы.",
    material: "Металл",
    color: "Белый",
  },
  {
    name: "Лежанка Soft",
    nameEn: "Soft pet bed",
    nameKa: "ცხოველის საწოლი Soft",
    descriptionEn:
      "A cozy spot for your pet. A soft cushion and textured sides for a peaceful rest close to you.",
    descriptionKa:
      "მყუდრო ადგილი თქვენი შინაური ცხოველისთვის. რბილი ბალიში და ტექსტურირებული გვერდები მშვიდი დასვენებისთვის.",
    category: "4",
    brand: "Everyday",
    price: "89",
    image: "photo-1600369671236-e74521d4b6ad",
    description:
      "Уютное место для вашего питомца. Мягкая подушка и фактурные бортики для спокойного отдыха рядом с вами.",
    material: "Хлопок",
    color: "Бежевый",
  },
  {
    name: "Стул Everyday",
    nameEn: "Everyday chair",
    nameKa: "სკამი Everyday",
    descriptionEn:
      "A simple silhouette and a comfortable seat. An easy fit for your dining room or home office.",
    descriptionKa:
      "სადა ფორმა და კომფორტული დასაჯდომი. ადვილად მოერგება სასადილო ოთახსა თუ სახლის ოფისს.",
    category: "1",
    brand: "Nord Studio",
    price: "215",
    image: "photo-1598300042247-d088f8ab3a91",
    description:
      "Простой силуэт и удобная посадка. Стул, который легко впишется в обеденную зону или домашний кабинет.",
    material: "Дерево",
    color: "Натуральный",
  },
  {
    name: "Чашка Ritual",
    nameEn: "Ritual cup",
    nameKa: "ჭიქა Ritual",
    descriptionEn:
      "For your first coffee and little breaks throughout the day. A ceramic cup with a pleasant texture.",
    descriptionKa:
      "პირველი ყავისა და დღის განმავლობაში მცირე შესვენებებისთვის. სასიამოვნო ტექსტურის კერამიკული ჭიქა.",
    category: "5",
    brand: "House of Clay",
    price: "32",
    image: "photo-1514228742587-6b1558fcca3d",
    description:
      "Для первого кофе и небольших пауз в течение дня. Керамическая чашка с приятной на ощупь поверхностью.",
    material: "Керамика",
    color: "Сливочный",
  },
  {
    name: "Свеча Slow Sunday",
    nameEn: "Slow Sunday candle",
    nameKa: "სანთელი Slow Sunday",
    descriptionEn:
      "A little ritual that changes the mood of a room. Light a candle and take your time.",
    descriptionKa:
      "პატარა რიტუალი, რომელიც ოთახის განწყობას ცვლის. აანთეთ სანთელი და ნუ იჩქარებთ.",
    category: "2",
    brand: "Everyday",
    price: "45",
    image: "photo-1603006905003-be475563bc59",
    description:
      "Маленький ритуал, который меняет настроение комнаты. Зажгите свечу и позвольте себе никуда не спешить.",
    material: "Растительный воск",
    color: "Белый",
  },
  {
    name: "Подушка Linen",
    nameEn: "Linen cushion",
    nameKa: "ბალიში Linen",
    descriptionEn:
      "A natural texture and a quiet color for your sofa or favorite armchair. Easy to mix with other fabrics.",
    descriptionKa:
      "ბუნებრივი ტექსტურა და მშვიდი ფერი თქვენი დივნისა თუ საყვარელი სავარძლისთვის. ადვილად ეხამება სხვა ქსოვილებს.",
    category: "4",
    brand: "Everyday",
    price: "55",
    image: "photo-1584100936595-c0654b55a2e2",
    description:
      "Натуральная фактура и спокойный оттенок для дивана или любимого кресла. Легко сочетать с другими тканями.",
    material: "Лён, хлопок",
    color: "Оливковый",
  },
];
export const demoCatalog: Catalog = {
  categories: ["Мебель", "Декор", "Освещение", "Текстиль", "Кухня"].map(
    (name, i) => ({
      id: String(i + 1),
      nameI18n: {
        ru: name,
        en: translate(name, "en"),
        ka: translate(name, "ka"),
      },
      slug: `category-${i + 1}`,
      isActive: true,
    }),
  ),
  products: items.map((item, i) => ({
    id: String(i + 1),
    categoryId: item.category,
    nameI18n: { ru: item.name, en: item.nameEn, ka: item.nameKa },
    descriptionI18n: {
      ru: item.description,
      en: item.descriptionEn,
      ka: item.descriptionKa,
    },
    brandName: item.brand,
    slug: `product-${i + 1}`,
    attributes: {
      imageUrl: photo(item.image),
      Материал: item.material,
      Цвет: item.color,
    },
    status: "active",
    createdAt: new Date(2026, 8, 20 - i).toISOString(),
  })),
  variants: items.map((item, i) => ({
    id: String(i + 1),
    productId: String(i + 1),
    unitId: "1",
    sku: `BSK-00${i + 1}`,
    nameI18n: {
      ru: item.color,
      en: translate(item.color, "en"),
      ka: translate(item.color, "ka"),
    },
    attributes: {},
    price: item.price,
    currency: "GEL",
    isActive: true,
  })),
  units: [
    {
      id: "1",
      symbolI18n: { ru: "шт.", en: "pc.", ka: "ც." },
      allowsFraction: false,
      isActive: true,
    },
  ],
  inventory: items.map((_, i) => ({
    variantId: String(i + 1),
    availableQty: i === 7 ? "0" : "12",
  })),
};
