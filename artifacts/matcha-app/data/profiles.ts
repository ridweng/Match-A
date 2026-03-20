type LocalizedText = {
  es: string;
  en: string;
};

export type DiscoverProfile = {
  id: string;
  name: string;
  age: number;
  dateOfBirth: string;
  pronouns: string;
  location: string;
  occupation: LocalizedText;
  attributes: {
    bodyType: string;
    height: string;
    interests: string[];
  };
  about: {
    bio: LocalizedText;
    relationshipGoals: string;
    education: string;
    childrenPreference: string;
    languagesSpoken: string[];
  };
  lifestyle: {
    physicalActivity: string;
    alcoholUse: string;
    tobaccoUse: string;
    politicalInterest: string;
    religionImportance: string;
    religion: string;
  };
  physical: {
    bodyType: string;
    height: string;
    hairColor: string;
    ethnicity: string;
  };
  imageUrl: string;
  insightTags: LocalizedText[];
  goalFeedback: {
    goalId: string;
    reason: LocalizedText;
  }[];
};

export const discoverProfiles: DiscoverProfile[] = [
  {
    id: "p1",
    name: "Valentina",
    age: 27,
    dateOfBirth: "1998-09-18",
    pronouns: "she",
    location: "Madrid, España",
    occupation: {
      es: "Arquitecta",
      en: "Architect",
    },
    attributes: {
      bodyType: "Esbelta",
      height: "168 cm",
      interests: ["Arte", "Yoga", "Viajes", "Cocina", "Lectura"],
    },
    about: {
      bio: {
        es: "Amante del diseño, el senderismo y las conversaciones profundas.",
        en: "Loves design, hiking, and deep conversations.",
      },
      relationshipGoals: "stable_relationship",
      education: "masters_degree",
      childrenPreference: "want_children",
      languagesSpoken: ["spanish", "english", "italian"],
    },
    lifestyle: {
      physicalActivity: "four_to_five_week",
      alcoholUse: "socially",
      tobaccoUse: "dont_smoke",
      politicalInterest: "somewhat_interested",
      religionImportance: "slightly_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "lean",
      height: "168 cm",
      hairColor: "dark_brown",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
    insightTags: [
      { es: "Activa", en: "Active" },
      { es: "Culta", en: "Cultured" },
      { es: "Aventurera", en: "Adventurous" },
    ],
    goalFeedback: [
      {
        goalId: "1",
        reason: {
          es: "Le gustan los hombres que cuidan su forma física",
          en: "She likes men who take care of their physical shape",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Valora conversaciones inteligentes y profundas",
          en: "She values intelligent and deep conversations",
        },
      },
    ],
  },
  {
    id: "p2",
    name: "Sofía",
    age: 29,
    dateOfBirth: "1996-07-30",
    pronouns: "she",
    location: "Barcelona, España",
    occupation: {
      es: "Fotógrafa",
      en: "Photographer",
    },
    attributes: {
      bodyType: "Atlética",
      height: "165 cm",
      interests: ["Fotografía", "Naturaleza", "Música", "Fitness", "Café"],
    },
    about: {
      bio: {
        es: "Capturo momentos únicos. Busco alguien con quien vivir aventuras.",
        en: "I capture unique moments. Looking for someone to share adventures with.",
      },
      relationshipGoals: "still_figuring_it_out",
      education: "bachelors_degree",
      childrenPreference: "not_sure",
      languagesSpoken: ["spanish", "catalan", "english", "french"],
    },
    lifestyle: {
      physicalActivity: "six_plus_week",
      alcoholUse: "special_occasions",
      tobaccoUse: "dont_smoke",
      politicalInterest: "not_interested",
      religionImportance: "not_important",
      religion: "spiritual_not_religious",
    },
    physical: {
      bodyType: "athletic",
      height: "165 cm",
      hairColor: "blonde",
      ethnicity: "mediterranean",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
    insightTags: [
      { es: "Creativa", en: "Creative" },
      { es: "Espontánea", en: "Spontaneous" },
      { es: "Fit", en: "Fit" },
    ],
    goalFeedback: [
      {
        goalId: "3",
        reason: {
          es: "Muy atenta al cuidado personal y la imagen",
          en: "She pays close attention to grooming and presentation",
        },
      },
      {
        goalId: "5",
        reason: {
          es: "Aprecia la presencia física y el lenguaje corporal",
          en: "She appreciates physical presence and body language",
        },
      },
    ],
  },
  {
    id: "p3",
    name: "Camila",
    age: 31,
    dateOfBirth: "1994-12-09",
    pronouns: "she",
    location: "Ciudad de México",
    occupation: {
      es: "Psicóloga",
      en: "Psychologist",
    },
    attributes: {
      bodyType: "Curvilínea",
      height: "162 cm",
      interests: ["Meditación", "Libros", "Danza", "Salud mental", "Vinos"],
    },
    about: {
      bio: {
        es: "Apasionada de la mente humana, el bienestar y el crecimiento personal.",
        en: "Passionate about the human mind, wellbeing, and personal growth.",
      },
      relationshipGoals: "stable_relationship",
      education: "doctorate",
      childrenPreference: "want_children",
      languagesSpoken: ["spanish", "english", "portuguese"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "somewhat_important",
      religion: "spiritual_not_religious",
    },
    physical: {
      bodyType: "curvy",
      height: "162 cm",
      hairColor: "dark_brown",
      ethnicity: "mestizo",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    insightTags: [
      { es: "Empática", en: "Empathetic" },
      { es: "Intelectual", en: "Intellectual" },
      { es: "Serena", en: "Serene" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Valora profundamente la inteligencia emocional",
          en: "She deeply values emotional intelligence",
        },
      },
      {
        goalId: "2",
        reason: {
          es: "Le atrae la seguridad emocional genuina",
          en: "She is attracted to genuine emotional security",
        },
      },
    ],
  },
  {
    id: "p4",
    name: "Isabella",
    age: 28,
    dateOfBirth: "1997-05-11",
    pronouns: "she",
    location: "Buenos Aires, Argentina",
    occupation: {
      es: "Chef",
      en: "Chef",
    },
    attributes: {
      bodyType: "Esbelta",
      height: "170 cm",
      interests: ["Gastronomía", "Arte", "Viajes", "Tango", "Vino"],
    },
    about: {
      bio: {
        es: "El arte y la cocina son mi mundo. Vivo para experiencias intensas.",
        en: "Art and cooking are my world. I live for intense experiences.",
      },
      relationshipGoals: "stable_relationship",
      education: "technical_school",
      childrenPreference: "not_sure",
      languagesSpoken: ["spanish", "english", "italian"],
    },
    lifestyle: {
      physicalActivity: "once_week",
      alcoholUse: "one_to_two_week",
      tobaccoUse: "smoke_socially",
      politicalInterest: "somewhat_interested",
      religionImportance: "slightly_important",
      religion: "catholic",
    },
    physical: {
      bodyType: "lean",
      height: "170 cm",
      hairColor: "black",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
    insightTags: [
      { es: "Apasionada", en: "Passionate" },
      { es: "Artística", en: "Artistic" },
      { es: "Sofisticada", en: "Sophisticated" },
    ],
    goalFeedback: [
      {
        goalId: "6",
        reason: {
          es: "Ama las conversaciones apasionadas sobre cultura",
          en: "She loves passionate conversations about culture",
        },
      },
      {
        goalId: "1",
        reason: {
          es: "Le gustan los hombres activos y con energía",
          en: "She likes men who are active and energetic",
        },
      },
    ],
  },
  {
    id: "p5",
    name: "Lucía",
    age: 26,
    dateOfBirth: "1999-10-02",
    pronouns: "elle",
    location: "Bogotá, Colombia",
    occupation: {
      es: "Ingeniera de Software",
      en: "Software Engineer",
    },
    attributes: {
      bodyType: "Atlética",
      height: "163 cm",
      interests: ["Tech", "Café", "Escalada", "Series", "Programación"],
    },
    about: {
      bio: {
        es: "Racional y apasionada. Amo la tecnología, el café y los retos.",
        en: "Rational and passionate. I love technology, coffee, and challenges.",
      },
      relationshipGoals: "making_friends",
      education: "bachelors_degree",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "english", "portuguese"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "not_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "athletic",
      height: "163 cm",
      hairColor: "black",
      ethnicity: "mixed",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80",
    insightTags: [
      { es: "Inteligente", en: "Smart" },
      { es: "Activa", en: "Active" },
      { es: "Independiente", en: "Independent" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Valora la madurez emocional y la honestidad",
          en: "She values emotional maturity and honesty",
        },
      },
      {
        goalId: "2",
        reason: {
          es: "Busca alguien seguro y auténtico",
          en: "She looks for someone confident and authentic",
        },
      },
    ],
  },
];
