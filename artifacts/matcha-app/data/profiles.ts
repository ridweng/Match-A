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
  {
    id: "p6",
    name: "Marta",
    age: 34,
    dateOfBirth: "1991-02-14",
    pronouns: "she",
    location: "Sevilla, España",
    occupation: {
      es: "Profesora de historia",
      en: "History teacher",
    },
    attributes: {
      bodyType: "Complexión media",
      height: "171 cm",
      interests: ["Museos", "Lectura", "Senderismo", "Pódcasts", "Jardinería"],
    },
    about: {
      bio: {
        es: "Disfruto los planes tranquilos, los viajes con historia y las conversaciones con sentido del humor.",
        en: "I enjoy calm plans, history-filled trips, and conversations with a sense of humor.",
      },
      relationshipGoals: "stable_relationship",
      education: "masters_degree",
      childrenPreference: "have_and_want_more",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "once_week",
      alcoholUse: "special_occasions",
      tobaccoUse: "dont_smoke",
      politicalInterest: "very_interested",
      religionImportance: "slightly_important",
      religion: "catholic",
    },
    physical: {
      bodyType: "medium_build",
      height: "171 cm",
      hairColor: "brown",
      ethnicity: "mediterranean",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
    insightTags: [
      { es: "Serena", en: "Calm" },
      { es: "Curiosa", en: "Curious" },
      { es: "Cálida", en: "Warm" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Conecta mejor con personas pacientes y emocionalmente estables",
          en: "She connects better with patient and emotionally steady people",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Le atraen las conversaciones interesantes y con humor",
          en: "She is drawn to interesting conversations and humor",
        },
      },
    ],
  },
  {
    id: "p7",
    name: "Nadia",
    age: 24,
    dateOfBirth: "2001-08-05",
    pronouns: "she",
    location: "Marseille, Francia",
    occupation: {
      es: "Barista",
      en: "Barista",
    },
    attributes: {
      bodyType: "Compacto",
      height: "156 cm",
      interests: ["Skate", "Música", "Tatuajes", "Café", "Conciertos"],
    },
    about: {
      bio: {
        es: "Me gustan los planes espontáneos, la música en vivo y la gente genuina.",
        en: "I like spontaneous plans, live music, and genuine people.",
      },
      relationshipGoals: "nothing_serious",
      education: "high_school",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["french", "english", "spanish"],
    },
    lifestyle: {
      physicalActivity: "varies_week_to_week",
      alcoholUse: "socially",
      tobaccoUse: "vape",
      politicalInterest: "somewhat_interested",
      religionImportance: "not_important",
      religion: "prefer_not_to_say",
    },
    physical: {
      bodyType: "compact_build",
      height: "156 cm",
      hairColor: "fantasy_colored",
      ethnicity: "north_african",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80",
    insightTags: [
      { es: "Espontánea", en: "Spontaneous" },
      { es: "Musical", en: "Musical" },
      { es: "Directa", en: "Direct" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Responde bien a personas seguras y sin poses",
          en: "She responds well to people who are confident and not performative",
        },
      },
      {
        goalId: "5",
        reason: {
          es: "Le gusta una presencia relajada y auténtica",
          en: "She likes a relaxed and authentic presence",
        },
      },
    ],
  },
  {
    id: "p8",
    name: "Helena",
    age: 38,
    dateOfBirth: "1987-11-21",
    pronouns: "she",
    location: "Lisboa, Portugal",
    occupation: {
      es: "Diseñadora floral",
      en: "Floral designer",
    },
    attributes: {
      bodyType: "Plus-size",
      height: "167 cm",
      interests: ["Flores", "Mercados", "Cocina", "Perros", "Decoración"],
    },
    about: {
      bio: {
        es: "Trabajo con flores, cocino por placer y me encantan los domingos lentos.",
        en: "I work with flowers, cook for pleasure, and love slow Sundays.",
      },
      relationshipGoals: "stable_relationship",
      education: "technical_school",
      childrenPreference: "have_and_dont_want_more",
      languagesSpoken: ["portuguese", "spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "rarely",
      alcoholUse: "one_to_two_week",
      tobaccoUse: "dont_smoke",
      politicalInterest: "not_interested",
      religionImportance: "somewhat_important",
      religion: "spiritual_not_religious",
    },
    physical: {
      bodyType: "plus_size",
      height: "167 cm",
      hairColor: "salt_and_pepper",
      ethnicity: "european",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80",
    insightTags: [
      { es: "Dulce", en: "Sweet" },
      { es: "Creativa", en: "Creative" },
      { es: "Hogareña", en: "Homey" },
    ],
    goalFeedback: [
      {
        goalId: "3",
        reason: {
          es: "Aprecia mucho el cuidado personal y los detalles",
          en: "She appreciates personal care and attention to detail",
        },
      },
      {
        goalId: "4",
        reason: {
          es: "Busca estabilidad emocional y amabilidad",
          en: "She looks for emotional stability and kindness",
        },
      },
    ],
  },
  {
    id: "p9",
    name: "Aisha",
    age: 30,
    dateOfBirth: "1995-04-03",
    pronouns: "she",
    location: "Londres, Reino Unido",
    occupation: {
      es: "Analista de datos",
      en: "Data analyst",
    },
    attributes: {
      bodyType: "Robusto",
      height: "174 cm",
      interests: ["Ajedrez", "Running", "Sci-fi", "Cine", "Viajes"],
    },
    about: {
      bio: {
        es: "Soy analítica, divertida y bastante competitiva en los juegos de mesa.",
        en: "I'm analytical, funny, and pretty competitive with board games.",
      },
      relationshipGoals: "still_figuring_it_out",
      education: "bachelors_degree",
      childrenPreference: "not_sure",
      languagesSpoken: ["english", "arabic", "french"],
    },
    lifestyle: {
      physicalActivity: "four_to_five_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "very_important",
      religion: "muslim",
    },
    physical: {
      bodyType: "sturdy",
      height: "174 cm",
      hairColor: "black",
      ethnicity: "middle_eastern",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80",
    insightTags: [
      { es: "Ingeniosa", en: "Witty" },
      { es: "Activa", en: "Active" },
      { es: "Observadora", en: "Observant" },
    ],
    goalFeedback: [
      {
        goalId: "1",
        reason: {
          es: "Le atraen personas activas y disciplinadas",
          en: "She is attracted to active and disciplined people",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Valora conversaciones rápidas e inteligentes",
          en: "She values quick and intelligent conversation",
        },
      },
    ],
  },
  {
    id: "p10",
    name: "Rocío",
    age: 33,
    dateOfBirth: "1992-01-27",
    pronouns: "she",
    location: "Montevideo, Uruguay",
    occupation: {
      es: "Mecánica de bicicletas",
      en: "Bike mechanic",
    },
    attributes: {
      bodyType: "Musculoso",
      height: "178 cm",
      interests: ["Ciclismo", "Camping", "Asado", "DIY", "Perros"],
    },
    about: {
      bio: {
        es: "Trabajo con las manos, disfruto el aire libre y prefiero la honestidad al drama.",
        en: "I work with my hands, enjoy the outdoors, and prefer honesty over drama.",
      },
      relationshipGoals: "making_friends",
      education: "technical_school",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "portuguese"],
    },
    lifestyle: {
      physicalActivity: "every_day",
      alcoholUse: "socially",
      tobaccoUse: "dont_smoke",
      politicalInterest: "somewhat_interested",
      religionImportance: "not_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "muscular",
      height: "178 cm",
      hairColor: "shaved_head",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
    insightTags: [
      { es: "Franca", en: "Straightforward" },
      { es: "Fuerte", en: "Strong" },
      { es: "Aventurera", en: "Adventurous" },
    ],
    goalFeedback: [
      {
        goalId: "5",
        reason: {
          es: "Le importa mucho la seguridad corporal y la presencia",
          en: "She cares a lot about body confidence and presence",
        },
      },
      {
        goalId: "2",
        reason: {
          es: "Prefiere gente auténtica y directa",
          en: "She prefers authentic and direct people",
        },
      },
    ],
  },
  {
    id: "p11",
    name: "Inés",
    age: 22,
    dateOfBirth: "2003-06-16",
    pronouns: "she",
    location: "Valencia, España",
    occupation: {
      es: "Estudiante de enfermería",
      en: "Nursing student",
    },
    attributes: {
      bodyType: "Rounded build",
      height: "160 cm",
      interests: ["Series", "Voluntariado", "Playa", "Manualidades", "Brunch"],
    },
    about: {
      bio: {
        es: "Soy cariñosa, hablo muchísimo y me encantan los planes simples con buena compañía.",
        en: "I'm affectionate, talk a lot, and love simple plans with good company.",
      },
      relationshipGoals: "nothing_serious",
      education: "university_student",
      childrenPreference: "not_sure",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "rarely",
      alcoholUse: "special_occasions",
      tobaccoUse: "dont_smoke",
      politicalInterest: "not_interested",
      religionImportance: "slightly_important",
      religion: "christian",
    },
    physical: {
      bodyType: "rounded_build",
      height: "160 cm",
      hairColor: "light_brown",
      ethnicity: "hispanic",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
    insightTags: [
      { es: "Cariñosa", en: "Affectionate" },
      { es: "Sociable", en: "Sociable" },
      { es: "Natural", en: "Easygoing" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Le atrae la calidez emocional y la empatía",
          en: "She is attracted to emotional warmth and empathy",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Le gustan las conversaciones ligeras y fluidas",
          en: "She likes light and easy-flowing conversations",
        },
      },
    ],
  },
];
