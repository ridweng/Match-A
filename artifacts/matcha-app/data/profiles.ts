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
  {
    id: "p12",
    name: "Diego",
    age: 32,
    dateOfBirth: "1993-08-12",
    pronouns: "he",
    location: "Madrid, España",
    occupation: {
      es: "Fisioterapeuta",
      en: "Physiotherapist",
    },
    attributes: {
      bodyType: "Atlético",
      height: "181 cm",
      interests: ["Running", "Cocina", "Padel", "Viajes", "Podcasts"],
    },
    about: {
      bio: {
        es: "Activo, familiar y bastante bueno escuchando. Prefiero los planes simples bien hechos.",
        en: "Active, family-oriented, and pretty good at listening. I prefer simple plans done well.",
      },
      relationshipGoals: "stable_relationship",
      education: "masters_degree",
      childrenPreference: "want_children",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "every_day",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "somewhat_interested",
      religionImportance: "slightly_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "athletic",
      height: "181 cm",
      hairColor: "dark_brown",
      ethnicity: "mediterranean",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
    insightTags: [
      { es: "Estable", en: "Stable" },
      { es: "Activo", en: "Active" },
      { es: "Atento", en: "Attentive" },
    ],
    goalFeedback: [
      {
        goalId: "1",
        reason: {
          es: "Valora el cuidado físico constante",
          en: "He values consistent physical care",
        },
      },
      {
        goalId: "4",
        reason: {
          es: "Responde bien a la madurez emocional",
          en: "He responds well to emotional maturity",
        },
      },
    ],
  },
  {
    id: "p13",
    name: "Bruno",
    age: 24,
    dateOfBirth: "2001-09-14",
    pronouns: "he",
    location: "Porto, Portugal",
    occupation: {
      es: "Tatuador",
      en: "Tattoo artist",
    },
    attributes: {
      bodyType: "Esbelto",
      height: "176 cm",
      interests: ["Tatuajes", "Metal", "Skate", "Arte", "Videojuegos"],
    },
    about: {
      bio: {
        es: "Más nocturno que mañanero. Me gustan el arte, la música pesada y la gente sin filtros.",
        en: "More nocturnal than early-rising. I like art, heavy music, and people without filters.",
      },
      relationshipGoals: "nothing_serious",
      education: "technical_school",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["portuguese", "english", "spanish"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "socially",
      tobaccoUse: "vape",
      politicalInterest: "not_interested",
      religionImportance: "not_important",
      religion: "prefer_not_to_say",
    },
    physical: {
      bodyType: "lean",
      height: "176 cm",
      hairColor: "black",
      ethnicity: "european",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
    insightTags: [
      { es: "Creativo", en: "Creative" },
      { es: "Directo", en: "Direct" },
      { es: "Nocturno", en: "Night owl" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Le atraen personas auténticas y seguras",
          en: "He is attracted to authentic and confident people",
        },
      },
      {
        goalId: "5",
        reason: {
          es: "Nota mucho la presencia física y la energía",
          en: "He notices physical presence and energy a lot",
        },
      },
    ],
  },
  {
    id: "p14",
    name: "Mateo",
    age: 37,
    dateOfBirth: "1988-10-04",
    pronouns: "he",
    location: "Ciudad de México",
    occupation: {
      es: "Médico pediatra",
      en: "Pediatrician",
    },
    attributes: {
      bodyType: "Complexión media",
      height: "173 cm",
      interests: ["Libros", "Café", "Senderismo", "Cine", "Familia"],
    },
    about: {
      bio: {
        es: "Soy tranquilo, muy de sobremesas largas y de planes con intención.",
        en: "I'm calm, into long table talks and plans with intention.",
      },
      relationshipGoals: "stable_relationship",
      education: "doctorate",
      childrenPreference: "have_and_dont_want_more",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "once_week",
      alcoholUse: "special_occasions",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "somewhat_important",
      religion: "catholic",
    },
    physical: {
      bodyType: "medium_build",
      height: "173 cm",
      hairColor: "graying",
      ethnicity: "mestizo",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=600&q=80",
    insightTags: [
      { es: "Calmo", en: "Calm" },
      { es: "Maduro", en: "Mature" },
      { es: "Confiable", en: "Reliable" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Le interesan personas emocionalmente estables",
          en: "He is interested in emotionally stable people",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Disfruta las conversaciones profundas y fluidas",
          en: "He enjoys deep and fluid conversations",
        },
      },
    ],
  },
  {
    id: "p15",
    name: "Karim",
    age: 28,
    dateOfBirth: "1997-07-22",
    pronouns: "he",
    location: "París, Francia",
    occupation: {
      es: "Pastelero",
      en: "Pastry chef",
    },
    attributes: {
      bodyType: "Delgado",
      height: "179 cm",
      interests: ["Postres", "Fotografía", "Mercados", "Jazz", "Viajes"],
    },
    about: {
      bio: {
        es: "Trabajo temprano, cocino mucho y tengo debilidad por los mercados locales.",
        en: "I work early, cook a lot, and have a soft spot for local markets.",
      },
      relationshipGoals: "still_figuring_it_out",
      education: "technical_school",
      childrenPreference: "not_sure",
      languagesSpoken: ["french", "arabic", "english"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "somewhat_interested",
      religionImportance: "very_important",
      religion: "muslim",
    },
    physical: {
      bodyType: "slim",
      height: "179 cm",
      hairColor: "black",
      ethnicity: "north_african",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=600&q=80",
    insightTags: [
      { es: "Elegante", en: "Elegant" },
      { es: "Observador", en: "Observant" },
      { es: "Creativo", en: "Creative" },
    ],
    goalFeedback: [
      {
        goalId: "3",
        reason: {
          es: "Le atraen los detalles y el cuidado estético",
          en: "He is attracted to detail and aesthetic care",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Conecta mejor con gente curiosa y conversadora",
          en: "He connects better with curious and talkative people",
        },
      },
    ],
  },
  {
    id: "p16",
    name: "Tomás",
    age: 21,
    dateOfBirth: "2004-08-03",
    pronouns: "he",
    location: "Buenos Aires, Argentina",
    occupation: {
      es: "Estudiante de música",
      en: "Music student",
    },
    attributes: {
      bodyType: "Esbelto",
      height: "183 cm",
      interests: ["Bajo", "Conciertos", "Friends", "Bici", "Indie"],
    },
    about: {
      bio: {
        es: "Improviso bastante, hablo rápido y siempre tengo algo sonando en los auriculares.",
        en: "I improvise a lot, speak fast, and always have something playing in my headphones.",
      },
      relationshipGoals: "making_friends",
      education: "university_student",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "four_to_five_week",
      alcoholUse: "socially",
      tobaccoUse: "smoke_occasionally",
      politicalInterest: "not_interested",
      religionImportance: "not_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "lean",
      height: "183 cm",
      hairColor: "light_brown",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=600&q=80",
    insightTags: [
      { es: "Divertido", en: "Fun" },
      { es: "Musical", en: "Musical" },
      { es: "Energético", en: "Energetic" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Le gusta la gente segura pero relajada",
          en: "He likes people who are confident but relaxed",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Conecta muy bien con conversaciones espontáneas",
          en: "He connects very well with spontaneous conversation",
        },
      },
    ],
  },
  {
    id: "p17",
    name: "Javier",
    age: 40,
    dateOfBirth: "1985-11-09",
    pronouns: "he",
    location: "Bogotá, Colombia",
    occupation: {
      es: "Dueño de librería",
      en: "Bookshop owner",
    },
    attributes: {
      bodyType: "Complexión grande",
      height: "175 cm",
      interests: ["Novelas", "Vinilos", "Teatro", "Café", "Gatos"],
    },
    about: {
      bio: {
        es: "Prefiero las conexiones lentas, el humor seco y la gente que sabe quién es.",
        en: "I prefer slow connections, dry humor, and people who know who they are.",
      },
      relationshipGoals: "stable_relationship",
      education: "bachelors_degree",
      childrenPreference: "have_and_dont_want_more",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "rarely",
      alcoholUse: "one_to_two_week",
      tobaccoUse: "quitting",
      politicalInterest: "very_interested",
      religionImportance: "slightly_important",
      religion: "atheist",
    },
    physical: {
      bodyType: "large_build",
      height: "175 cm",
      hairColor: "salt_and_pepper",
      ethnicity: "mixed",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80",
    insightTags: [
      { es: "Reflexivo", en: "Reflective" },
      { es: "Culto", en: "Cultured" },
      { es: "Irónico", en: "Wry" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Busca profundidad emocional y calma",
          en: "He looks for emotional depth and calm",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Valora mucho la buena conversación",
          en: "He values good conversation a lot",
        },
      },
    ],
  },
  {
    id: "p18",
    name: "Leo",
    age: 26,
    dateOfBirth: "1999-07-14",
    pronouns: "he",
    location: "Berlín, Alemania",
    occupation: {
      es: "Diseñador de videojuegos",
      en: "Game designer",
    },
    attributes: {
      bodyType: "Cuerpo redondeado",
      height: "169 cm",
      interests: ["Gaming", "Cine", "Ramen", "Cómics", "Museos"],
    },
    about: {
      bio: {
        es: "Geek social, me encantan los mundos imaginarios pero también salir a caminar horas.",
        en: "Social geek, I love imaginary worlds but also going on long walks.",
      },
      relationshipGoals: "still_figuring_it_out",
      education: "bachelors_degree",
      childrenPreference: "not_sure",
      languagesSpoken: ["german", "english"],
    },
    lifestyle: {
      physicalActivity: "once_week",
      alcoholUse: "socially",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "not_important",
      religion: "atheist",
    },
    physical: {
      bodyType: "rounded_build",
      height: "169 cm",
      hairColor: "brown",
      ethnicity: "european",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
    insightTags: [
      { es: "Geek", en: "Geeky" },
      { es: "Tierno", en: "Sweet" },
      { es: "Curioso", en: "Curious" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Se siente atraído por la autenticidad y el humor",
          en: "He is attracted to authenticity and humor",
        },
      },
      {
        goalId: "5",
        reason: {
          es: "La postura y la seguridad le llaman la atención",
          en: "Posture and confidence catch his attention",
        },
      },
    ],
  },
  {
    id: "p19",
    name: "Hassan",
    age: 35,
    dateOfBirth: "1990-06-18",
    pronouns: "he",
    location: "Casablanca, Marruecos",
    occupation: {
      es: "Ingeniero civil",
      en: "Civil engineer",
    },
    attributes: {
      bodyType: "Musculoso",
      height: "184 cm",
      interests: ["Arquitectura", "Café", "Fútbol", "Viajes", "Familia"],
    },
    about: {
      bio: {
        es: "Me gusta construir cosas, literal y metafóricamente. Bastante familiar y leal.",
        en: "I like building things, literally and metaphorically. Very family-oriented and loyal.",
      },
      relationshipGoals: "stable_relationship",
      education: "masters_degree",
      childrenPreference: "want_children",
      languagesSpoken: ["arabic", "french", "english"],
    },
    lifestyle: {
      physicalActivity: "four_to_five_week",
      alcoholUse: "never",
      tobaccoUse: "dont_smoke",
      politicalInterest: "somewhat_interested",
      religionImportance: "central_to_my_life",
      religion: "muslim",
    },
    physical: {
      bodyType: "muscular",
      height: "184 cm",
      hairColor: "black",
      ethnicity: "north_african",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=600&q=80",
    insightTags: [
      { es: "Leal", en: "Loyal" },
      { es: "Protector", en: "Protective" },
      { es: "Disciplinado", en: "Disciplined" },
    ],
    goalFeedback: [
      {
        goalId: "1",
        reason: {
          es: "Le importa mucho la constancia y la disciplina",
          en: "Consistency and discipline matter a lot to him",
        },
      },
      {
        goalId: "4",
        reason: {
          es: "Busca madurez y serenidad emocional",
          en: "He looks for emotional maturity and serenity",
        },
      },
    ],
  },
  {
    id: "p20",
    name: "Nico",
    age: 30,
    dateOfBirth: "1995-12-02",
    pronouns: "he",
    location: "Santiago, Chile",
    occupation: {
      es: "Jardinero urbano",
      en: "Urban gardener",
    },
    attributes: {
      bodyType: "Robusto",
      height: "177 cm",
      interests: ["Plantas", "Cocina", "Cerámica", "Montaña", "Perros"],
    },
    about: {
      bio: {
        es: "Me gustan los ritmos lentos, las manos con tierra y la gente amable.",
        en: "I like slow rhythms, dirt on my hands, and kind people.",
      },
      relationshipGoals: "stable_relationship",
      education: "technical_school",
      childrenPreference: "not_sure",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "not_interested",
      religionImportance: "slightly_important",
      religion: "spiritual_not_religious",
    },
    physical: {
      bodyType: "sturdy",
      height: "177 cm",
      hairColor: "dark_brown",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
    insightTags: [
      { es: "Calmado", en: "Calm" },
      { es: "Amable", en: "Kind" },
      { es: "Natural", en: "Grounded" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Aprecia la amabilidad y la inteligencia emocional",
          en: "He appreciates kindness and emotional intelligence",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Conecta mejor con conversaciones honestas y simples",
          en: "He connects best with honest and simple conversations",
        },
      },
    ],
  },
  {
    id: "p21",
    name: "Samuel",
    age: 23,
    dateOfBirth: "2002-07-27",
    pronouns: "he",
    location: "Lima, Perú",
    occupation: {
      es: "Editor de video",
      en: "Video editor",
    },
    attributes: {
      bodyType: "Compacto",
      height: "166 cm",
      interests: ["Cine", "Anime", "Vóley", "TikTok", "Fotografía"],
    },
    about: {
      bio: {
        es: "Creativo, un poco caótico y siempre buscando planes que no sean aburridos.",
        en: "Creative, a little chaotic, and always looking for plans that aren't boring.",
      },
      relationshipGoals: "making_friends",
      education: "university_student",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "varies_week_to_week",
      alcoholUse: "socially",
      tobaccoUse: "smoke_socially",
      politicalInterest: "somewhat_interested",
      religionImportance: "not_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "compact_build",
      height: "166 cm",
      hairColor: "black",
      ethnicity: "mestizo",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&q=80",
    insightTags: [
      { es: "Creativo", en: "Creative" },
      { es: "Sociable", en: "Sociable" },
      { es: "Ligero", en: "Lighthearted" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Le llaman la atención la seguridad y la autenticidad",
          en: "Confidence and authenticity catch his eye",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Le gusta la gente con chispa y conversación rápida",
          en: "He likes people with spark and quick conversation",
        },
      },
    ],
  },
  {
    id: "p22",
    name: "Alex",
    age: 27,
    dateOfBirth: "1998-04-10",
    pronouns: "they",
    location: "Ciudad de México",
    occupation: {
      es: "Investigadore UX",
      en: "UX researcher",
    },
    attributes: {
      bodyType: "Complexión media",
      height: "172 cm",
      interests: ["Diseño", "Café", "Museos", "Gatos", "Podcast"],
    },
    about: {
      bio: {
        es: "Me gustan los espacios bonitos, la gente amable y las preguntas incómodas bien hechas.",
        en: "I like beautiful spaces, kind people, and well-asked uncomfortable questions.",
      },
      relationshipGoals: "still_figuring_it_out",
      education: "masters_degree",
      childrenPreference: "not_sure",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "special_occasions",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "not_important",
      religion: "atheist",
    },
    physical: {
      bodyType: "medium_build",
      height: "172 cm",
      hairColor: "dark_brown",
      ethnicity: "mixed",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
    insightTags: [
      { es: "Observadore", en: "Observant" },
      { es: "Curiose", en: "Curious" },
      { es: "Estilose", en: "Stylish" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Valoran mucho la empatía y la escucha real",
          en: "They value empathy and real listening a lot",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Conectan con gente ingeniosa y conversadora",
          en: "They connect with witty and conversational people",
        },
      },
    ],
  },
  {
    id: "p23",
    name: "Noa",
    age: 19,
    dateOfBirth: "2006-09-11",
    pronouns: "elle",
    location: "Barcelona, España",
    occupation: {
      es: "Estudiante de bellas artes",
      en: "Fine arts student",
    },
    attributes: {
      bodyType: "Delgado",
      height: "170 cm",
      interests: ["Ilustración", "Moda", "Conciertos", "Pintura", "Friends"],
    },
    about: {
      bio: {
        es: "Me encanta experimentar con mi estilo y conocer gente creativa y suave.",
        en: "I love experimenting with my style and meeting creative, gentle people.",
      },
      relationshipGoals: "making_friends",
      education: "university_student",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "catalan", "english"],
    },
    lifestyle: {
      physicalActivity: "rarely",
      alcoholUse: "socially",
      tobaccoUse: "vape",
      politicalInterest: "somewhat_interested",
      religionImportance: "not_important",
      religion: "prefer_not_to_say",
    },
    physical: {
      bodyType: "slim",
      height: "170 cm",
      hairColor: "fantasy_colored",
      ethnicity: "mediterranean",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80",
    insightTags: [
      { es: "Creative", en: "Creative" },
      { es: "Dulce", en: "Sweet" },
      { es: "Expresive", en: "Expressive" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Le atrae la autenticidad sin dureza",
          en: "They are attracted to authenticity without harshness",
        },
      },
      {
        goalId: "3",
        reason: {
          es: "Notan mucho el estilo y el cuidado visual",
          en: "They notice style and visual care a lot",
        },
      },
    ],
  },
  {
    id: "p24",
    name: "Robin",
    age: 36,
    dateOfBirth: "1989-05-28",
    pronouns: "they",
    location: "Lyon, Francia",
    occupation: {
      es: "Ceramista",
      en: "Ceramic artist",
    },
    attributes: {
      bodyType: "Plus-size",
      height: "168 cm",
      interests: ["Cerámica", "Huerto", "Cocina", "Ferias", "Perros"],
    },
    about: {
      bio: {
        es: "Tengo un taller de barro, un humor seco y mucha paciencia para la gente buena.",
        en: "I have a clay studio, dry humor, and lots of patience for good people.",
      },
      relationshipGoals: "stable_relationship",
      education: "technical_school",
      childrenPreference: "have_and_want_more",
      languagesSpoken: ["french", "english"],
    },
    lifestyle: {
      physicalActivity: "rarely",
      alcoholUse: "one_to_two_week",
      tobaccoUse: "dont_smoke",
      politicalInterest: "very_interested",
      religionImportance: "slightly_important",
      religion: "spiritual_not_religious",
    },
    physical: {
      bodyType: "plus_size",
      height: "168 cm",
      hairColor: "gray",
      ethnicity: "european",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80",
    insightTags: [
      { es: "Paciencie", en: "Patient" },
      { es: "Creative", en: "Creative" },
      { es: "Hogareñe", en: "Homey" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Buscan estabilidad emocional y ternura",
          en: "They look for emotional steadiness and tenderness",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Disfrutan la conversación lenta y con sustancia",
          en: "They enjoy slow conversation with substance",
        },
      },
    ],
  },
  {
    id: "p25",
    name: "Emi",
    age: 25,
    dateOfBirth: "2000-12-03",
    pronouns: "ellx",
    location: "Buenos Aires, Argentina",
    occupation: {
      es: "Diseñadxr de sonido",
      en: "Sound designer",
    },
    attributes: {
      bodyType: "Atlético",
      height: "174 cm",
      interests: ["Synths", "Cine", "Raves", "Moda", "Patines"],
    },
    about: {
      bio: {
        es: "Vivo entre estudios, auriculares y planes improvisados. Busco química real.",
        en: "I live between studios, headphones, and improvised plans. Looking for real chemistry.",
      },
      relationshipGoals: "nothing_serious",
      education: "bachelors_degree",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "english", "portuguese"],
    },
    lifestyle: {
      physicalActivity: "four_to_five_week",
      alcoholUse: "socially",
      tobaccoUse: "vape",
      politicalInterest: "somewhat_interested",
      religionImportance: "not_important",
      religion: "atheist",
    },
    physical: {
      bodyType: "athletic",
      height: "174 cm",
      hairColor: "multicolored",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
    insightTags: [
      { es: "Magnéticx", en: "Magnetic" },
      { es: "Nocturnx", en: "Night owl" },
      { es: "Creativx", en: "Creative" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Les atrae la gente segura y con energía propia",
          en: "They are drawn to people who are confident and self-possessed",
        },
      },
      {
        goalId: "5",
        reason: {
          es: "La presencia corporal les importa bastante",
          en: "Physical presence matters to them quite a bit",
        },
      },
    ],
  },
  {
    id: "p26",
    name: "Jules",
    age: 33,
    dateOfBirth: "1992-09-15",
    pronouns: "they",
    location: "Montreal, Canadá",
    occupation: {
      es: "Paramédique",
      en: "Paramedic",
    },
    attributes: {
      bodyType: "Complexión grande",
      height: "180 cm",
      interests: ["Senderismo", "Snowboard", "Cocina", "Perros", "Series"],
    },
    about: {
      bio: {
        es: "Trabajo bajo presión, así que fuera de eso valoro muchísimo la calma y la honestidad.",
        en: "I work under pressure, so outside of that I really value calm and honesty.",
      },
      relationshipGoals: "stable_relationship",
      education: "technical_school",
      childrenPreference: "not_sure",
      languagesSpoken: ["french", "english"],
    },
    lifestyle: {
      physicalActivity: "six_plus_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "slightly_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "large_build",
      height: "180 cm",
      hairColor: "dark_brown",
      ethnicity: "caucasian",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
    insightTags: [
      { es: "Protectorx", en: "Protective" },
      { es: "Serenx", en: "Steady" },
      { es: "Fuerte", en: "Strong" },
    ],
    goalFeedback: [
      {
        goalId: "1",
        reason: {
          es: "Les atraen personas activas y constantes",
          en: "They are attracted to active and consistent people",
        },
      },
      {
        goalId: "4",
        reason: {
          es: "Valoran mucho la estabilidad emocional",
          en: "They value emotional stability a lot",
        },
      },
    ],
  },
  {
    id: "p27",
    name: "Dani",
    age: 28,
    dateOfBirth: "1997-11-08",
    pronouns: "elle",
    location: "Santiago, Chile",
    occupation: {
      es: "Aprendiz de tatuaje",
      en: "Tattoo apprentice",
    },
    attributes: {
      bodyType: "Compacto",
      height: "163 cm",
      interests: ["Tatuajes", "Café", "Skate", "Gatos", "Indie"],
    },
    about: {
      bio: {
        es: "Soy leal, intensa y me tomo el humor muy en serio.",
        en: "I'm loyal, intense, and I take humor very seriously.",
      },
      relationshipGoals: "making_friends",
      education: "high_school",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["spanish", "english"],
    },
    lifestyle: {
      physicalActivity: "two_to_three_week",
      alcoholUse: "socially",
      tobaccoUse: "smoke_occasionally",
      politicalInterest: "somewhat_interested",
      religionImportance: "not_important",
      religion: "prefer_not_to_say",
    },
    physical: {
      bodyType: "compact_build",
      height: "163 cm",
      hairColor: "black",
      ethnicity: "mixed",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
    insightTags: [
      { es: "Leal", en: "Loyal" },
      { es: "Irónique", en: "Wry" },
      { es: "Intense", en: "Intense" },
    ],
    goalFeedback: [
      {
        goalId: "2",
        reason: {
          es: "Les gusta la gente segura y directa",
          en: "They like people who are confident and direct",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Conectan con conversaciones rápidas y honestas",
          en: "They connect with fast and honest conversation",
        },
      },
    ],
  },
  {
    id: "p28",
    name: "Gael",
    age: 39,
    dateOfBirth: "1986-07-19",
    pronouns: "they",
    location: "Montevideo, Uruguay",
    occupation: {
      es: "Bibliotecarie",
      en: "Librarian",
    },
    attributes: {
      bodyType: "Cuerpo redondeado",
      height: "171 cm",
      interests: ["Libros", "Mate", "Ajedrez", "Teatro", "Paseos"],
    },
    about: {
      bio: {
        es: "Me gustan las personas suaves, inteligentes y que sepan reírse de sí mismas.",
        en: "I like people who are soft, intelligent, and able to laugh at themselves.",
      },
      relationshipGoals: "stable_relationship",
      education: "masters_degree",
      childrenPreference: "have_and_dont_want_more",
      languagesSpoken: ["spanish", "english", "portuguese"],
    },
    lifestyle: {
      physicalActivity: "rarely",
      alcoholUse: "special_occasions",
      tobaccoUse: "dont_smoke",
      politicalInterest: "very_interested",
      religionImportance: "somewhat_important",
      religion: "spiritual_not_religious",
    },
    physical: {
      bodyType: "rounded_build",
      height: "171 cm",
      hairColor: "gray_haired",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80",
    insightTags: [
      { es: "Sabie", en: "Wise" },
      { es: "Cálide", en: "Warm" },
      { es: "Reflexive", en: "Reflective" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Priorizan la ternura y la inteligencia emocional",
          en: "They prioritize tenderness and emotional intelligence",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Valoran la conversación profunda y el humor",
          en: "They value deep conversation and humor",
        },
      },
    ],
  },
  {
    id: "p29",
    name: "Sacha",
    age: 22,
    dateOfBirth: "2003-10-05",
    pronouns: "ellx",
    location: "Lisboa, Portugal",
    occupation: {
      es: "Estudiante de moda",
      en: "Fashion student",
    },
    attributes: {
      bodyType: "Esbelto",
      height: "177 cm",
      interests: ["Moda", "Fotografía", "Clubbing", "Sketchbook", "Vintage"],
    },
    about: {
      bio: {
        es: "Coqueteo más con el estilo que con las reglas. Busco gente divertida y amable.",
        en: "I flirt more with style than with rules. Looking for fun and kind people.",
      },
      relationshipGoals: "nothing_serious",
      education: "university_student",
      childrenPreference: "dont_want_children",
      languagesSpoken: ["portuguese", "english", "french"],
    },
    lifestyle: {
      physicalActivity: "varies_week_to_week",
      alcoholUse: "socially",
      tobaccoUse: "vape",
      politicalInterest: "not_interested",
      religionImportance: "not_important",
      religion: "prefer_not_to_say",
    },
    physical: {
      bodyType: "lean",
      height: "177 cm",
      hairColor: "highlights",
      ethnicity: "european",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    insightTags: [
      { es: "Magnéticx", en: "Magnetic" },
      { es: "Estilose", en: "Stylish" },
      { es: "Ligere", en: "Lighthearted" },
    ],
    goalFeedback: [
      {
        goalId: "3",
        reason: {
          es: "Notan muchísimo el estilo personal",
          en: "They notice personal style a lot",
        },
      },
      {
        goalId: "2",
        reason: {
          es: "Les atrae la seguridad sin arrogancia",
          en: "They are attracted to confidence without arrogance",
        },
      },
    ],
  },
  {
    id: "p30",
    name: "Andrea",
    age: 31,
    dateOfBirth: "1994-08-22",
    pronouns: "elle",
    location: "Bogotá, Colombia",
    occupation: {
      es: "Traductore",
      en: "Translator",
    },
    attributes: {
      bodyType: "Curvilíneo",
      height: "169 cm",
      interests: ["Idiomas", "Cine", "Viajes", "Museos", "Té"],
    },
    about: {
      bio: {
        es: "Vivo entre idiomas, cafés y conversaciones largas. Me gusta la gente curiosa.",
        en: "I live between languages, coffee, and long conversations. I like curious people.",
      },
      relationshipGoals: "stable_relationship",
      education: "masters_degree",
      childrenPreference: "not_sure",
      languagesSpoken: ["spanish", "english", "french", "italian"],
    },
    lifestyle: {
      physicalActivity: "once_week",
      alcoholUse: "rarely",
      tobaccoUse: "dont_smoke",
      politicalInterest: "quite_interested",
      religionImportance: "slightly_important",
      religion: "agnostic",
    },
    physical: {
      bodyType: "curvy",
      height: "169 cm",
      hairColor: "dark_brown",
      ethnicity: "latino_latin_american",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80",
    insightTags: [
      { es: "Culte", en: "Cultured" },
      { es: "Curiose", en: "Curious" },
      { es: "Elegante", en: "Elegant" },
    ],
    goalFeedback: [
      {
        goalId: "4",
        reason: {
          es: "Les importa la empatía y la atención emocional",
          en: "Empathy and emotional attentiveness matter to them",
        },
      },
      {
        goalId: "6",
        reason: {
          es: "Conectan con conversaciones largas y ricas",
          en: "They connect with long and rich conversations",
        },
      },
    ],
  },
];
