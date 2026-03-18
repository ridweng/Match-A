export type DiscoverProfile = {
  id: string;
  name: string;
  age: number;
  location: string;
  occupation: string;
  bio: string;
  attributes: {
    bodyType: string;
    height: string;
    interests: string[];
  };
  imageUrl: string;
  insightTags: string[];
  goalFeedback: {
    goalId: string;
    reason: string;
  }[];
};

export const discoverProfiles: DiscoverProfile[] = [
  {
    id: "p1",
    name: "Valentina",
    age: 27,
    location: "Madrid, España",
    occupation: "Arquitecta",
    bio: "Amante del diseño, el senderismo y las conversaciones profundas.",
    attributes: {
      bodyType: "Esbelta",
      height: "168 cm",
      interests: ["Arte", "Yoga", "Viajes", "Cocina", "Lectura"],
    },
    imageUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
    insightTags: ["Activa", "Culta", "Aventurera"],
    goalFeedback: [
      {
        goalId: "1",
        reason: "Le gustan los hombres que cuidan su forma física",
      },
      {
        goalId: "6",
        reason: "Valora conversaciones inteligentes y profundas",
      },
    ],
  },
  {
    id: "p2",
    name: "Sofía",
    age: 29,
    location: "Barcelona, España",
    occupation: "Fotógrafa",
    bio: "Capturo momentos únicos. Busco alguien con quien vivir aventuras.",
    attributes: {
      bodyType: "Atlética",
      height: "165 cm",
      interests: ["Fotografía", "Naturaleza", "Música", "Fitness", "Café"],
    },
    imageUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
    insightTags: ["Creativa", "Espontánea", "Fit"],
    goalFeedback: [
      {
        goalId: "3",
        reason: "Muy atenta al cuidado personal y la imagen",
      },
      {
        goalId: "5",
        reason: "Aprecia la presencia física y el lenguaje corporal",
      },
    ],
  },
  {
    id: "p3",
    name: "Camila",
    age: 31,
    location: "Ciudad de México",
    occupation: "Psicóloga",
    bio: "Apasionada de la mente humana, el bienestar y el crecimiento personal.",
    attributes: {
      bodyType: "Curvilínea",
      height: "162 cm",
      interests: ["Meditación", "Libros", "Danza", "Salud mental", "Vinos"],
    },
    imageUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    insightTags: ["Empática", "Intelectual", "Serena"],
    goalFeedback: [
      {
        goalId: "4",
        reason: "Valora profundamente la inteligencia emocional",
      },
      {
        goalId: "2",
        reason: "Le atrae la seguridad emocional genuina",
      },
    ],
  },
  {
    id: "p4",
    name: "Isabella",
    age: 28,
    location: "Buenos Aires, Argentina",
    occupation: "Chef",
    bio: "El arte y la cocina son mi mundo. Vivo para experiencias intensas.",
    attributes: {
      bodyType: "Esbelta",
      height: "170 cm",
      interests: ["Gastronomía", "Arte", "Viajes", "Tango", "Vino"],
    },
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
    insightTags: ["Apasionada", "Artística", "Sofisticada"],
    goalFeedback: [
      {
        goalId: "6",
        reason: "Ama las conversaciones apasionadas sobre cultura",
      },
      {
        goalId: "1",
        reason: "Le gustan los hombres activos y con energía",
      },
    ],
  },
  {
    id: "p5",
    name: "Lucía",
    age: 26,
    location: "Bogotá, Colombia",
    occupation: "Ingeniera de Software",
    bio: "Racional y apasionada. Amo la tecnología, el café y los retos.",
    attributes: {
      bodyType: "Atlética",
      height: "163 cm",
      interests: ["Tech", "Café", "Escalada", "Series", "Programación"],
    },
    imageUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80",
    insightTags: ["Inteligente", "Activa", "Independiente"],
    goalFeedback: [
      {
        goalId: "4",
        reason: "Valora la madurez emocional y la honestidad",
      },
      {
        goalId: "2",
        reason: "Busca alguien seguro y auténtico",
      },
    ],
  },
];
