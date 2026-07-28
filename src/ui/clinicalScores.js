// RESIAR v76B — Scores clínicos durante el examen
// Todos los scores se muestran como información y todos tienen un modo de cálculo.
// Los scores simples usan puntos/selecciones. Los scores complejos usan checklist estructurado o fórmula aproximada local cuando corresponde.
// No usa Supabase.

const SCORE_GROUPS = [
  {
    category: 'Urgencias y emergencias',
    scores: [
      {
        id: 'qsofa',
        name: 'qSOFA',
        use: 'Identificación rápida de riesgo en sepsis fuera de UCI.',
        aliases: ['sepsis', 'quick sofa', 'shock', 'infeccion'],
        type: 'points',
        variables: ['Frecuencia respiratoria', 'sensorio', 'presión arterial sistólica'],
        items: [
          { label: 'Frecuencia respiratoria ≥22/min', points: 1 },
          { label: 'Alteración del sensorio', points: 1 },
          { label: 'PAS ≤100 mmHg', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 1, text: 'Bajo riesgo relativo. No descarta sepsis; integrar con clínica.' },
          { min: 2, max: 3, text: 'Mayor riesgo de mala evolución. Evaluar sepsis, lactato, cultivos, antibióticos y soporte.' }
        ]
      },
      {
        id: 'sofa',
        name: 'SOFA',
        use: 'Disfunción orgánica secuencial en sepsis y cuidados críticos.',
        aliases: ['sepsis', 'uci', 'disfuncion organica', 'shock'],
        type: 'select',
        variables: ['Respiratorio', 'coagulación', 'hepático', 'cardiovascular', 'neurológico', 'renal'],
        selects: [
          { label: 'Respiratorio', options: [{ label: 'Normal o leve', points: 0 }, { label: 'Compromiso leve', points: 1 }, { label: 'Moderado', points: 2 }, { label: 'Severo', points: 3 }, { label: 'Muy severo', points: 4 }] },
          { label: 'Plaquetas / coagulación', options: [{ label: 'Normal', points: 0 }, { label: 'Leve', points: 1 }, { label: 'Moderado', points: 2 }, { label: 'Severo', points: 3 }, { label: 'Muy severo', points: 4 }] },
          { label: 'Bilirrubina / hígado', options: [{ label: 'Normal', points: 0 }, { label: 'Leve', points: 1 }, { label: 'Moderado', points: 2 }, { label: 'Severo', points: 3 }, { label: 'Muy severo', points: 4 }] },
          { label: 'Cardiovascular / vasopresores', options: [{ label: 'Sin hipotensión', points: 0 }, { label: 'Hipotensión leve', points: 1 }, { label: 'Dopamina/dobutamina baja', points: 2 }, { label: 'Vasopresor moderado', points: 3 }, { label: 'Vasopresor alto', points: 4 }] },
          { label: 'Neurológico / Glasgow', options: [{ label: 'GCS 15', points: 0 }, { label: 'GCS 13-14', points: 1 }, { label: 'GCS 10-12', points: 2 }, { label: 'GCS 6-9', points: 3 }, { label: 'GCS <6', points: 4 }] },
          { label: 'Renal / creatinina-diuresis', options: [{ label: 'Normal', points: 0 }, { label: 'Leve', points: 1 }, { label: 'Moderado', points: 2 }, { label: 'Severo', points: 3 }, { label: 'Muy severo', points: 4 }] }
        ],
        interpretation: [
          { min: 0, max: 1, text: 'Disfunción baja o ausente.' },
          { min: 2, max: 5, text: 'Disfunción orgánica relevante. En sepsis, aumento ≥2 puntos es clínicamente importante.' },
          { min: 6, max: 24, text: 'Disfunción significativa; mayor riesgo de mortalidad. Requiere manejo intensivo según contexto.' }
        ],
        note: 'Calculadora simplificada por dominios. Para uso clínico real, usar criterios completos de SOFA.'
      },
      {
        id: 'news2',
        name: 'NEWS / NEWS2',
        use: 'Detección temprana de deterioro clínico.',
        aliases: ['deterioro', 'early warning', 'news'],
        type: 'select',
        variables: ['FR', 'SatO₂', 'oxígeno suplementario', 'temperatura', 'PAS', 'FC', 'conciencia'],
        selects: [
          { label: 'Frecuencia respiratoria', options: [{ label: '12-20', points: 0 }, { label: '9-11', points: 1 }, { label: '21-24', points: 2 }, { label: '≤8 o ≥25', points: 3 }] },
          { label: 'SatO₂ escala 1', options: [{ label: '≥96%', points: 0 }, { label: '94-95%', points: 1 }, { label: '92-93%', points: 2 }, { label: '≤91%', points: 3 }] },
          { label: 'Oxígeno suplementario', options: [{ label: 'No', points: 0 }, { label: 'Sí', points: 2 }] },
          { label: 'Temperatura', options: [{ label: '36,1-38,0', points: 0 }, { label: '35,1-36,0 o 38,1-39,0', points: 1 }, { label: '≤35,0 o ≥39,1', points: 3 }] },
          { label: 'PAS', options: [{ label: '111-219', points: 0 }, { label: '101-110', points: 1 }, { label: '91-100', points: 2 }, { label: '≤90 o ≥220', points: 3 }] },
          { label: 'Frecuencia cardíaca', options: [{ label: '51-90', points: 0 }, { label: '41-50 o 91-110', points: 1 }, { label: '111-130', points: 2 }, { label: '≤40 o ≥131', points: 3 }] },
          { label: 'Conciencia', options: [{ label: 'Alerta', points: 0 }, { label: 'No alerta / confusión nueva', points: 3 }] }
        ],
        interpretation: [
          { min: 0, max: 4, text: 'Riesgo bajo, salvo parámetro individual de 3 puntos.' },
          { min: 5, max: 6, text: 'Riesgo medio. Requiere evaluación clínica urgente.' },
          { min: 7, max: 20, text: 'Riesgo alto. Requiere respuesta urgente y posible escalamiento.' }
        ],
        note: 'Versión orientativa con escala de SatO₂ 1.'
      },
      {
        id: 'mews',
        name: 'MEWS',
        use: 'Predicción de deterioro clínico y mortalidad.',
        aliases: ['deterioro', 'modified early warning'],
        type: 'select',
        variables: ['PAS', 'FC', 'FR', 'temperatura', 'nivel de conciencia'],
        selects: [
          { label: 'PAS', options: [{ label: '101-199', points: 0 }, { label: '81-100', points: 1 }, { label: '71-80 o ≥200', points: 2 }, { label: '≤70', points: 3 }] },
          { label: 'FC', options: [{ label: '51-100', points: 0 }, { label: '41-50 o 101-110', points: 1 }, { label: '111-129', points: 2 }, { label: '≤40 o ≥130', points: 3 }] },
          { label: 'FR', options: [{ label: '9-14', points: 0 }, { label: '15-20', points: 1 }, { label: '21-29', points: 2 }, { label: '≤8 o ≥30', points: 3 }] },
          { label: 'Temperatura', options: [{ label: '35-38,4', points: 0 }, { label: '<35 o ≥38,5', points: 2 }] },
          { label: 'Conciencia', options: [{ label: 'Alerta', points: 0 }, { label: 'Responde a voz', points: 1 }, { label: 'Responde a dolor', points: 2 }, { label: 'Inconsciente', points: 3 }] }
        ],
        interpretation: [
          { min: 0, max: 2, text: 'Riesgo bajo.' },
          { min: 3, max: 4, text: 'Riesgo intermedio; reevaluar y considerar escalamiento.' },
          { min: 5, max: 20, text: 'Riesgo alto de deterioro.' }
        ]
      },
      {
        id: 'perc',
        name: 'PERC',
        use: 'Exclusión de embolia pulmonar en pacientes con muy baja probabilidad pretest.',
        aliases: ['tep', 'embolia pulmonar', 'tromboembolismo', 'rule out'],
        type: 'points',
        items: [
          { label: 'Edad ≥50 años', points: 1 },
          { label: 'FC ≥100/min', points: 1 },
          { label: 'SatO₂ <95%', points: 1 },
          { label: 'Hemoptisis', points: 1 },
          { label: 'Uso de estrógenos', points: 1 },
          { label: 'Cirugía/trauma reciente', points: 1 },
          { label: 'TEP/TVP previo', points: 1 },
          { label: 'Signos clínicos de TVP unilateral', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 0, text: 'PERC negativo. En baja probabilidad pretest puede evitar más estudios.' },
          { min: 1, max: 8, text: 'PERC positivo. No excluye TEP; continuar algoritmo diagnóstico.' }
        ]
      },
      {
        id: 'wells-tep',
        name: 'Wells TEP',
        use: 'Probabilidad clínica de embolia pulmonar.',
        aliases: ['tep', 'embolia pulmonar', 'wells pulmonar'],
        type: 'points',
        items: [
          { label: 'Signos clínicos de TVP', points: 3 },
          { label: 'TEP es el diagnóstico más probable', points: 3 },
          { label: 'FC >100/min', points: 1.5 },
          { label: 'Inmovilización/cirugía reciente', points: 1.5 },
          { label: 'TEP/TVP previo', points: 1.5 },
          { label: 'Hemoptisis', points: 1 },
          { label: 'Cáncer activo', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 4, text: 'TEP poco probable en modelo dicotómico.' },
          { min: 4.01, max: 99, text: 'TEP probable. Continuar estudio según disponibilidad y riesgo.' }
        ]
      },
      {
        id: 'wells-tvp',
        name: 'Wells TVP',
        use: 'Probabilidad clínica de trombosis venosa profunda.',
        aliases: ['tvp', 'trombosis venosa profunda', 'wells venosa'],
        type: 'points',
        items: [
          { label: 'Cáncer activo', points: 1 },
          { label: 'Parálisis, paresia o inmovilización de miembro inferior', points: 1 },
          { label: 'Reposo/cirugía mayor reciente', points: 1 },
          { label: 'Dolor en trayecto venoso profundo', points: 1 },
          { label: 'Edema de toda la pierna', points: 1 },
          { label: 'Pantorrilla >3 cm vs contralateral', points: 1 },
          { label: 'Edema con fóvea unilateral', points: 1 },
          { label: 'Venas superficiales colaterales', points: 1 },
          { label: 'TVP previa', points: 1 },
          { label: 'Diagnóstico alternativo tan probable como TVP', points: -2 }
        ],
        interpretation: [
          { min: -99, max: 1, text: 'TVP poco probable.' },
          { min: 2, max: 99, text: 'TVP probable. Continuar algoritmo diagnóstico.' }
        ]
      },
      {
        id: 'heart',
        name: 'HEART',
        use: 'Estratificación de riesgo en dolor torácico / síndrome coronario agudo.',
        aliases: ['dolor toracico', 'sca', 'infarto', 'angina'],
        type: 'select',
        variables: ['Historia', 'ECG', 'Edad', 'Factores de riesgo', 'Troponina'],
        selects: [
          { label: 'Historia', options: [{ label: 'Poco sospechosa', points: 0 }, { label: 'Moderada', points: 1 }, { label: 'Muy sospechosa', points: 2 }] },
          { label: 'ECG', options: [{ label: 'Normal', points: 0 }, { label: 'Alteraciones inespecíficas', points: 1 }, { label: 'Depresión ST significativa', points: 2 }] },
          { label: 'Edad', options: [{ label: '<45', points: 0 }, { label: '45-64', points: 1 }, { label: '≥65', points: 2 }] },
          { label: 'Factores de riesgo', options: [{ label: 'Ninguno', points: 0 }, { label: '1-2 factores', points: 1 }, { label: '≥3 factores o enfermedad aterosclerótica', points: 2 }] },
          { label: 'Troponina', options: [{ label: 'Normal', points: 0 }, { label: '1-3× normal', points: 1 }, { label: '>3× normal', points: 2 }] }
        ],
        interpretation: [
          { min: 0, max: 3, text: 'Bajo riesgo.' },
          { min: 4, max: 6, text: 'Riesgo intermedio.' },
          { min: 7, max: 10, text: 'Alto riesgo.' }
        ]
      },
      {
        id: 'curb65',
        name: 'CURB-65',
        use: 'Severidad de neumonía adquirida en la comunidad.',
        aliases: ['neumonia', 'nac', 'curb'],
        type: 'points',
        items: [
          { label: 'Confusión', points: 1 },
          { label: 'Urea elevada', points: 1 },
          { label: 'Frecuencia respiratoria ≥30/min', points: 1 },
          { label: 'PAS <90 o PAD ≤60 mmHg', points: 1 },
          { label: 'Edad ≥65 años', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 1, text: 'Bajo riesgo. Manejo ambulatorio si el contexto lo permite.' },
          { min: 2, max: 2, text: 'Riesgo intermedio. Considerar internación.' },
          { min: 3, max: 5, text: 'Alto riesgo. Internación; valorar UCI según clínica.' }
        ]
      }
    ]
  },

  {
    category: 'Cardiología',
    scores: [
      {
        id: 'cha2ds2vasc',
        name: 'CHA₂DS₂-VASc',
        use: 'Riesgo de ictus en fibrilación auricular.',
        aliases: ['fa', 'fibrilacion auricular', 'ictus', 'acv', 'anticoagulacion'],
        type: 'points',
        items: [
          { label: 'Insuficiencia cardíaca', points: 1 },
          { label: 'Hipertensión arterial', points: 1 },
          { label: 'Edad ≥75 años', points: 2 },
          { label: 'Diabetes mellitus', points: 1 },
          { label: 'ACV/AIT/tromboembolismo previo', points: 2 },
          { label: 'Enfermedad vascular', points: 1 },
          { label: 'Edad 65-74 años', points: 1 },
          { label: 'Sexo femenino', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 0, text: 'Riesgo bajo en varón. Individualizar.' },
          { min: 1, max: 1, text: 'Riesgo intermedio. Considerar anticoagulación según contexto.' },
          { min: 2, max: 9, text: 'Riesgo elevado. Usualmente favorece anticoagulación si no hay contraindicación.' }
        ]
      },
      {
        id: 'hasbled',
        name: 'HAS-BLED',
        use: 'Riesgo de sangrado en anticoagulación.',
        aliases: ['sangrado', 'anticoagulacion', 'fa'],
        type: 'points',
        items: [
          { label: 'Hipertensión no controlada', points: 1 },
          { label: 'Función renal alterada', points: 1 },
          { label: 'Función hepática alterada', points: 1 },
          { label: 'ACV previo', points: 1 },
          { label: 'Sangrado previo o predisposición', points: 1 },
          { label: 'INR lábil', points: 1 },
          { label: 'Edad >65 años', points: 1 },
          { label: 'Fármacos que favorecen sangrado', points: 1 },
          { label: 'Alcohol', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 2, text: 'Riesgo bajo-moderado.' },
          { min: 3, max: 9, text: 'Riesgo alto: corregir factores modificables; no implica suspender automáticamente anticoagulación.' }
        ]
      },
      {
        id: 'timi',
        name: 'TIMI',
        use: 'Riesgo en síndrome coronario agudo sin supradesnivel.',
        aliases: ['sca', 'iam', 'nstemi', 'stemi', 'timi'],
        type: 'points',
        items: [
          { label: 'Edad ≥65 años', points: 1 },
          { label: '≥3 factores de riesgo coronario', points: 1 },
          { label: 'Estenosis coronaria conocida ≥50%', points: 1 },
          { label: 'Desviación ST', points: 1 },
          { label: '≥2 episodios de angina en 24 h', points: 1 },
          { label: 'AAS en los últimos 7 días', points: 1 },
          { label: 'Marcadores cardíacos positivos', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 2, text: 'Riesgo bajo.' },
          { min: 3, max: 4, text: 'Riesgo intermedio.' },
          { min: 5, max: 7, text: 'Riesgo alto.' }
        ],
        note: 'Versión TIMI UA/NSTEMI.'
      },
      {
        id: 'grace',
        name: 'GRACE',
        use: 'Mortalidad en síndrome coronario agudo.',
        aliases: ['sca', 'iam', 'mortalidad'],
        type: 'checklist',
        variables: ['Edad', 'FC', 'PAS', 'creatinina', 'Killip', 'paro cardíaco', 'ST', 'troponina'],
        interpretationText: 'Score pronóstico de SCA; requiere fórmula completa. Este modo verifica que tengas las variables necesarias.'
      },
      {
        id: 'killip',
        name: 'Killip-Kimball',
        use: 'Clasificación clínica de insuficiencia cardíaca en infarto agudo.',
        aliases: ['killip', 'iam', 'edema pulmonar', 'shock'],
        type: 'select',
        selects: [
          { label: 'Clase Killip', options: [
            { label: 'I: sin insuficiencia cardíaca', points: 1 },
            { label: 'II: estertores/S3/ingurgitación yugular', points: 2 },
            { label: 'III: edema agudo de pulmón', points: 3 },
            { label: 'IV: shock cardiogénico', points: 4 }
          ] }
        ],
        interpretation: [
          { min: 1, max: 1, text: 'Clase I: menor riesgo relativo.' },
          { min: 2, max: 2, text: 'Clase II: insuficiencia cardíaca leve-moderada.' },
          { min: 3, max: 3, text: 'Clase III: edema agudo de pulmón.' },
          { min: 4, max: 4, text: 'Clase IV: shock cardiogénico; muy alto riesgo.' }
        ]
      },
      {
        id: 'framingham',
        name: 'Framingham Risk Score',
        use: 'Riesgo cardiovascular a 10 años.',
        aliases: ['riesgo cardiovascular', 'framingham'],
        type: 'checklist',
        variables: ['Edad', 'sexo', 'colesterol', 'HDL', 'PAS', 'tratamiento antihipertensivo', 'tabaquismo', 'diabetes'],
        interpretationText: 'Requiere tablas/calculadora validada. El checklist confirma variables necesarias.'
      },
      {
        id: 'score2',
        name: 'SCORE / SCORE2',
        use: 'Riesgo cardiovascular en Europa.',
        aliases: ['riesgo cardiovascular', 'europa'],
        type: 'checklist',
        variables: ['Edad', 'sexo', 'tabaquismo', 'PAS', 'colesterol no-HDL o total/HDL', 'región de riesgo'],
        interpretationText: 'Requiere tabla/calculadora por región. El checklist confirma variables necesarias.'
      },
      {
        id: 'pooled',
        name: 'ACC/AHA Pooled Cohort Equations',
        use: 'Riesgo cardiovascular a 10 años en EE.UU.',
        aliases: ['aha', 'acc', 'riesgo cardiovascular'],
        type: 'checklist',
        variables: ['Edad', 'sexo', 'raza', 'colesterol total', 'HDL', 'PAS', 'tratamiento HTA', 'diabetes', 'tabaquismo'],
        interpretationText: 'Requiere ecuación oficial. El checklist confirma variables necesarias.'
      },
      {
        id: 'prevent',
        name: 'PREVENT',
        use: 'Ecuaciones AHA 2024 de riesgo cardiovascular.',
        aliases: ['aha 2024', 'prevent', 'riesgo cardiovascular'],
        type: 'checklist',
        variables: ['Edad', 'sexo', 'colesterol', 'HDL', 'PAS', 'tratamiento HTA', 'diabetes', 'tabaquismo', 'eGFR', 'IMC según ecuación'],
        interpretationText: 'Modelo AHA 2024; usar calculadora oficial para resultado exacto.'
      }
    ]
  },

  {
    category: 'Cuidados intensivos',
    scores: [
      {
        id: 'apache',
        name: 'APACHE II / IV',
        use: 'Estimación de mortalidad en UCI.',
        aliases: ['uci', 'mortalidad', 'apache'],
        type: 'checklist',
        variables: ['Variables fisiológicas agudas', 'edad', 'comorbilidad', 'diagnóstico', 'temperatura', 'PAM', 'FC', 'FR', 'oxigenación', 'pH', 'sodio', 'potasio', 'creatinina', 'hematocrito', 'leucocitos', 'Glasgow'],
        interpretationText: 'Score complejo de UCI. Este modo funciona como checklist de variables; para mortalidad exacta usar calculadora validada.'
      },
      {
        id: 'saps',
        name: 'SAPS II',
        use: 'Severidad de enfermedad en UCI.',
        aliases: ['uci', 'mortalidad', 'saps'],
        type: 'checklist',
        variables: ['Edad', 'FC', 'PAS', 'temperatura', 'PaO₂/FiO₂', 'diuresis', 'urea', 'leucocitos', 'potasio', 'sodio', 'bicarbonato', 'bilirrubina', 'Glasgow', 'tipo de admisión', 'comorbilidades'],
        interpretationText: 'Score pronóstico de UCI; requiere calculadora validada para mortalidad exacta.'
      },
      {
        id: 'rems',
        name: 'REMS',
        use: 'Mortalidad en pacientes críticos de emergencias.',
        aliases: ['emergencias', 'critico', 'mortalidad'],
        type: 'select',
        variables: ['Edad', 'PAM', 'FC', 'FR', 'SatO₂', 'Glasgow'],
        selects: [
          { label: 'Edad', options: [{ label: '<45', points: 0 }, { label: '45-54', points: 2 }, { label: '55-64', points: 3 }, { label: '65-74', points: 5 }, { label: '>74', points: 6 }] },
          { label: 'PAM', options: [{ label: '70-109', points: 0 }, { label: '50-69 o 110-129', points: 2 }, { label: '<50 o ≥130', points: 4 }] },
          { label: 'FC', options: [{ label: '70-109', points: 0 }, { label: '55-69 o 110-139', points: 2 }, { label: '<55 o ≥140', points: 4 }] },
          { label: 'FR', options: [{ label: '12-24', points: 0 }, { label: '10-11 o 25-34', points: 1 }, { label: '6-9 o 35-49', points: 2 }, { label: '<6 o ≥50', points: 4 }] },
          { label: 'SatO₂', options: [{ label: '>89%', points: 0 }, { label: '86-89%', points: 1 }, { label: '75-85%', points: 3 }, { label: '<75%', points: 4 }] },
          { label: 'Glasgow', options: [{ label: '14-15', points: 0 }, { label: '11-13', points: 1 }, { label: '8-10', points: 2 }, { label: '5-7', points: 3 }, { label: '3-4', points: 4 }] }
        ],
        interpretation: [
          { min: 0, max: 5, text: 'Menor riesgo relativo.' },
          { min: 6, max: 12, text: 'Riesgo intermedio.' },
          { min: 13, max: 26, text: 'Riesgo alto.' }
        ],
        note: 'Categorización orientativa.'
      }
    ]
  },

  {
    category: 'Gastroenterología y hepatología',
    scores: [
      {
        id: 'glasgow-blatchford',
        name: 'Glasgow-Blatchford',
        use: 'Necesidad de intervención en hemorragia digestiva alta.',
        aliases: ['hda', 'hemorragia digestiva', 'melena', 'hematemesis'],
        type: 'checklist',
        variables: ['Urea', 'hemoglobina', 'PAS', 'pulso', 'melena', 'síncope', 'hepatopatía', 'insuficiencia cardíaca'],
        interpretationText: 'GBS 0-1 suele identificar bajo riesgo. Requiere tabla completa para puntaje exacto.'
      },
      {
        id: 'rockall',
        name: 'Rockall',
        use: 'Mortalidad en hemorragia digestiva alta.',
        aliases: ['hda', 'hemorragia digestiva', 'rockall'],
        type: 'checklist',
        variables: ['Edad', 'shock', 'comorbilidad', 'diagnóstico endoscópico', 'estigmas de sangrado'],
        interpretationText: 'Tiene versión pre y post-endoscopia. Checklist de variables necesarias.'
      },
      {
        id: 'aims65',
        name: 'AIMS65',
        use: 'Mortalidad intrahospitalaria en hemorragia digestiva.',
        aliases: ['hda', 'hemorragia digestiva', 'aims'],
        type: 'points',
        items: [
          { label: 'Albúmina <3 g/dL', points: 1 },
          { label: 'INR >1,5', points: 1 },
          { label: 'Alteración del estado mental', points: 1 },
          { label: 'PAS ≤90 mmHg', points: 1 },
          { label: 'Edad >65 años', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 1, text: 'Menor riesgo relativo.' },
          { min: 2, max: 5, text: 'Mayor riesgo de mortalidad intrahospitalaria.' }
        ]
      },
      {
        id: 'oakland',
        name: 'Oakland',
        use: 'Identificación de bajo riesgo en hemorragia digestiva baja.',
        aliases: ['hemorragia digestiva baja', 'hdb', 'rectorragia'],
        type: 'checklist',
        variables: ['Edad', 'sexo', 'sangrado previo', 'tacto rectal', 'FC', 'PAS', 'hemoglobina'],
        interpretationText: 'Puntajes bajos pueden identificar candidatos a manejo ambulatorio según contexto. Requiere tabla/calculadora completa.'
      },
      {
        id: 'childpugh',
        name: 'Child-Pugh',
        use: 'Severidad de cirrosis hepática.',
        aliases: ['cirrosis', 'hepatopatia', 'ascitis'],
        type: 'select',
        variables: ['Bilirrubina', 'albúmina', 'INR/TP', 'ascitis', 'encefalopatía'],
        selects: [
          { label: 'Bilirrubina', options: [{ label: '<2 mg/dL', points: 1 }, { label: '2-3 mg/dL', points: 2 }, { label: '>3 mg/dL', points: 3 }] },
          { label: 'Albúmina', options: [{ label: '>3,5 g/dL', points: 1 }, { label: '2,8-3,5 g/dL', points: 2 }, { label: '<2,8 g/dL', points: 3 }] },
          { label: 'INR / TP', options: [{ label: 'INR <1,7', points: 1 }, { label: 'INR 1,7-2,3', points: 2 }, { label: 'INR >2,3', points: 3 }] },
          { label: 'Ascitis', options: [{ label: 'Ausente', points: 1 }, { label: 'Leve/controlada', points: 2 }, { label: 'Moderada-severa/refractaria', points: 3 }] },
          { label: 'Encefalopatía', options: [{ label: 'Ausente', points: 1 }, { label: 'Grado I-II', points: 2 }, { label: 'Grado III-IV', points: 3 }] }
        ],
        interpretation: [
          { min: 5, max: 6, text: 'Clase A.' },
          { min: 7, max: 9, text: 'Clase B.' },
          { min: 10, max: 15, text: 'Clase C.' }
        ]
      },
      {
        id: 'meld',
        name: 'MELD',
        use: 'Priorización para trasplante hepático.',
        aliases: ['cirrosis', 'trasplante', 'meld-na'],
        type: 'formula',
        formula: 'meld',
        fields: [
          { key: 'bilirubin', label: 'Bilirrubina', unit: 'mg/dL', min: 0.1, step: 0.1 },
          { key: 'inr', label: 'INR', unit: '', min: 0.1, step: 0.1 },
          { key: 'creatinine', label: 'Creatinina', unit: 'mg/dL', min: 0.1, step: 0.1 }
        ],
        interpretationText: 'Cálculo MELD clásico aproximado. Para MELD-Na o excepciones, usar calculadora oficial.'
      }
    ]
  },

  {
    category: 'Neurología',
    scores: [
      {
        id: 'glasgow',
        name: 'Glasgow Coma Scale',
        use: 'Nivel de conciencia y trauma craneoencefálico.',
        aliases: ['gcs', 'coma', 'trauma craneoencefalico', 'tec'],
        type: 'select',
        variables: ['Apertura ocular', 'respuesta verbal', 'respuesta motora'],
        selects: [
          { label: 'Apertura ocular', options: [{ label: 'Ninguna', points: 1 }, { label: 'Al dolor', points: 2 }, { label: 'A la voz', points: 3 }, { label: 'Espontánea', points: 4 }] },
          { label: 'Respuesta verbal', options: [{ label: 'Ninguna', points: 1 }, { label: 'Sonidos incomprensibles', points: 2 }, { label: 'Palabras inapropiadas', points: 3 }, { label: 'Confusa', points: 4 }, { label: 'Orientada', points: 5 }] },
          { label: 'Respuesta motora', options: [{ label: 'Ninguna', points: 1 }, { label: 'Extensión', points: 2 }, { label: 'Flexión anormal', points: 3 }, { label: 'Retira al dolor', points: 4 }, { label: 'Localiza dolor', points: 5 }, { label: 'Obedece órdenes', points: 6 }] }
        ],
        interpretation: [
          { min: 3, max: 8, text: 'Compromiso severo.' },
          { min: 9, max: 12, text: 'Compromiso moderado.' },
          { min: 13, max: 15, text: 'Compromiso leve.' }
        ]
      },
      {
        id: 'nihss',
        name: 'NIHSS',
        use: 'Severidad de ictus.',
        aliases: ['acv', 'ictus', 'stroke'],
        type: 'checklist',
        variables: ['Conciencia', 'preguntas', 'órdenes', 'mirada', 'campos visuales', 'paresia facial', 'motor brazos', 'motor piernas', 'ataxia', 'sensibilidad', 'lenguaje', 'disartria', 'negligencia'],
        interpretationText: 'Escala detallada. Este modo confirma dominios evaluados; para puntaje exacto usar NIHSS completo.'
      },
      {
        id: 'abcd2',
        name: 'ABCD2',
        use: 'Riesgo de ictus tras ataque isquémico transitorio.',
        aliases: ['ait', 'tia', 'acv transitorio'],
        type: 'points',
        items: [
          { label: 'Edad ≥60 años', points: 1 },
          { label: 'PA ≥140/90', points: 1 },
          { label: 'Debilidad unilateral', points: 2 },
          { label: 'Alteración del habla sin debilidad', points: 1 },
          { label: 'Duración ≥60 min', points: 2 },
          { label: 'Duración 10-59 min', points: 1 },
          { label: 'Diabetes', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 3, text: 'Riesgo bajo.' },
          { min: 4, max: 5, text: 'Riesgo moderado.' },
          { min: 6, max: 7, text: 'Riesgo alto.' }
        ],
        note: 'No marques simultáneamente ambas duraciones.'
      },
      {
        id: 'ich',
        name: 'ICH Score',
        use: 'Mortalidad en hemorragia intracerebral.',
        aliases: ['hemorragia intracerebral', 'hIC', 'ich'],
        type: 'points',
        items: [
          { label: 'Glasgow 3-4', points: 2 },
          { label: 'Glasgow 5-12', points: 1 },
          { label: 'Volumen hematoma ≥30 mL', points: 1 },
          { label: 'Hemorragia intraventricular', points: 1 },
          { label: 'Origen infratentorial', points: 1 },
          { label: 'Edad ≥80 años', points: 1 }
        ],
        interpretation: [
          { min: 0, max: 1, text: 'Menor riesgo relativo.' },
          { min: 2, max: 3, text: 'Riesgo intermedio.' },
          { min: 4, max: 6, text: 'Alto riesgo.' }
        ],
        note: 'No marques simultáneamente ambos rangos de Glasgow.'
      }
    ]
  },

  {
    category: 'Nefrología',
    scores: [
      {
        id: 'kdigo',
        name: 'KDIGO',
        use: 'Clasificación de enfermedad renal crónica.',
        aliases: ['erc', 'renal', 'albuminuria'],
        type: 'formula',
        formula: 'kdigo',
        fields: [],
        interpretationText: 'Clasifica riesgo por categoría G de TFG y A de albuminuria.'
      },
      {
        id: 'egfr',
        name: 'Cockcroft-Gault / MDRD / CKD-EPI',
        use: 'Estimación de filtrado glomerular.',
        aliases: ['clearance', 'filtrado', 'tfg', 'fg', 'creatinina'],
        type: 'formula',
        formula: 'cockcroft',
        fields: [
          { key: 'age', label: 'Edad', unit: 'años', min: 1, step: 1 },
          { key: 'weight', label: 'Peso', unit: 'kg', min: 1, step: 0.1 },
          { key: 'creatinine', label: 'Creatinina', unit: 'mg/dL', min: 0.1, step: 0.1 }
        ],
        interpretationText: 'Calcula Cockcroft-Gault aproximado. MDRD/CKD-EPI requieren ecuaciones específicas.'
      }
    ]
  },

  {
    category: 'Trauma',
    scores: [
      {
        id: 'rts',
        name: 'Revised Trauma Score',
        use: 'Severidad fisiológica en trauma.',
        aliases: ['trauma', 'rts'],
        type: 'formula',
        formula: 'rts',
        fields: [],
        interpretationText: 'Combina Glasgow, PAS y frecuencia respiratoria codificados.'
      },
      {
        id: 'iss',
        name: 'Injury Severity Score',
        use: 'Severidad anatómica de lesiones.',
        aliases: ['trauma', 'iss'],
        type: 'formula',
        formula: 'iss',
        fields: [
          { key: 'ais1', label: 'AIS lesión más grave', unit: '', min: 0, max: 6, step: 1 },
          { key: 'ais2', label: 'AIS segunda región', unit: '', min: 0, max: 6, step: 1 },
          { key: 'ais3', label: 'AIS tercera región', unit: '', min: 0, max: 6, step: 1 }
        ],
        interpretationText: 'ISS = suma de cuadrados de las 3 lesiones AIS más graves.'
      },
      {
        id: 'triss',
        name: 'TRISS',
        use: 'Probabilidad de supervivencia en trauma.',
        aliases: ['trauma', 'supervivencia'],
        type: 'checklist',
        variables: ['RTS', 'ISS', 'edad', 'mecanismo contundente/penetrante'],
        interpretationText: 'Requiere fórmula logística con coeficientes por mecanismo. Checklist de variables necesarias.'
      }
    ]
  },

  {
    category: 'Oncología y estado funcional',
    scores: [
      {
        id: 'ecog',
        name: 'ECOG Performance Status',
        use: 'Estado funcional del paciente oncológico.',
        aliases: ['oncologia', 'performance status', 'funcional'],
        type: 'select',
        selects: [
          { label: 'Estado funcional', options: [
            { label: '0: actividad normal', points: 0 },
            { label: '1: restricción leve', points: 1 },
            { label: '2: autocuidado, no trabajo', points: 2 },
            { label: '3: cama/silla >50% del día', points: 3 },
            { label: '4: postrado', points: 4 },
            { label: '5: muerte', points: 5 }
          ] }
        ],
        interpretation: [
          { min: 0, max: 1, text: 'Buen estado funcional.' },
          { min: 2, max: 2, text: 'Limitación intermedia.' },
          { min: 3, max: 4, text: 'Mal estado funcional.' },
          { min: 5, max: 5, text: 'Muerte.' }
        ]
      },
      {
        id: 'karnofsky',
        name: 'Karnofsky Performance Status',
        use: 'Capacidad funcional global.',
        aliases: ['oncologia', 'performance', 'funcional'],
        type: 'select',
        selects: [
          { label: 'Karnofsky', options: [
            { label: '100: normal, sin quejas', points: 100 },
            { label: '90: actividad normal, síntomas menores', points: 90 },
            { label: '80: actividad normal con esfuerzo', points: 80 },
            { label: '70: autocuidado, no actividad normal', points: 70 },
            { label: '60: requiere ayuda ocasional', points: 60 },
            { label: '50: requiere ayuda considerable', points: 50 },
            { label: '40: discapacitado', points: 40 },
            { label: '30: severamente discapacitado', points: 30 },
            { label: '20: muy enfermo', points: 20 },
            { label: '10: moribundo', points: 10 },
            { label: '0: muerte', points: 0 }
          ] }
        ],
        interpretation: [
          { min: 80, max: 100, text: 'Funcionalidad conservada.' },
          { min: 50, max: 79, text: 'Requiere algún grado de asistencia.' },
          { min: 0, max: 49, text: 'Dependencia marcada o enfermedad avanzada.' }
        ]
      }
    ]
  }
];

let installed = false;
let modalBuilt = false;
let activeScoreId = '';
let lastQuery = '';

function normalize(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flatScores() {
  return SCORE_GROUPS.flatMap((group) =>
    group.scores.map((score) => ({
      ...score,
      category: group.category,
      searchText: normalize([
        group.category,
        score.name,
        score.use,
        score.interpretationText,
        score.note,
        ...(score.aliases || []),
        ...(score.variables || []),
        ...(score.items || []).map((x) => x.label),
        ...(score.selects || []).flatMap((x) => [x.label, ...(x.options || []).map((o) => o.label)])
      ].join(' '))
    }))
  );
}

const FLAT_SCORES = flatScores();

function ensureStyles() {
  if (document.getElementById('resiar-clinical-scores-style-v76b')) return;

  const style = document.createElement('style');
  style.id = 'resiar-clinical-scores-style-v76b';
  style.textContent = `
    .resiar-clinical-scores-btn {
      width: 100%;
      min-height: 42px;
      border-radius: 14px;
      border: 1px solid rgba(139,92,246,.26);
      background: linear-gradient(135deg, rgba(139,92,246,.12), rgba(148,163,184,.05));
      color: var(--text);
      font-weight: 850;
      letter-spacing: -.01em;
      cursor: pointer;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
      margin-top: 8px;
    }

    .resiar-clinical-scores-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(139,92,246,.42);
      box-shadow: 0 12px 28px rgba(139,92,246,.14);
    }

    .resiar-score-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(15,23,42,.46);
      backdrop-filter: blur(10px);
      z-index: 99999;
    }

    .resiar-score-overlay.vis { display: flex; }

    .resiar-score-panel {
      width: min(1040px, calc(100vw - 28px));
      max-height: min(820px, calc(100vh - 28px));
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      border-radius: 28px;
      border: 1px solid rgba(148,163,184,.22);
      background: radial-gradient(circle at 10% 0%, rgba(139,92,246,.15), transparent 32%), var(--card, #fff);
      box-shadow: 0 28px 80px rgba(15,23,42,.24);
      overflow: hidden;
    }

    [data-theme="dark"] .resiar-score-panel {
      background: radial-gradient(circle at 10% 0%, rgba(139,92,246,.16), transparent 32%), var(--card, #111827);
      box-shadow: 0 28px 90px rgba(0,0,0,.45);
    }

    .resiar-score-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding: 20px 22px 12px;
    }

    .resiar-score-kicker {
      font-family: var(--font-mono, 'Space Grotesk', monospace);
      font-size: .62rem;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--violet, #8b5cf6);
      font-weight: 900;
    }

    .resiar-score-title {
      margin-top: 4px;
      font-family: var(--font-serif, 'Playfair Display', serif);
      font-size: clamp(1.55rem, 3vw, 2.25rem);
      font-weight: 800;
      line-height: .95;
      color: var(--text, #111827);
    }

    .resiar-score-close {
      width: 38px;
      height: 38px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(148,163,184,.08);
      color: var(--text);
      cursor: pointer;
      font-size: 1.2rem;
      font-weight: 900;
    }

    .resiar-score-search-wrap { padding: 0 22px 14px; }

    .resiar-score-search {
      width: 100%;
      min-height: 44px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.24);
      background: rgba(148,163,184,.08);
      color: var(--text);
      padding: 0 14px;
      outline: none;
      font-weight: 750;
    }

    .resiar-score-search:focus {
      border-color: rgba(139,92,246,.55);
      box-shadow: 0 0 0 4px rgba(139,92,246,.10);
    }

    .resiar-score-body { overflow: auto; padding: 0 22px 18px; }

    .resiar-score-category { margin: 10px 0 16px; }

    .resiar-score-category-title {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 8px 0;
      background: linear-gradient(180deg, var(--card, #fff) 70%, transparent);
      font-family: var(--font-mono, 'Space Grotesk', monospace);
      color: var(--text2, #64748b);
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: .65rem;
      font-weight: 900;
    }

    [data-theme="dark"] .resiar-score-category-title {
      background: linear-gradient(180deg, var(--card, #111827) 70%, transparent);
    }

    .resiar-score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
    }

    .resiar-score-card {
      min-width: 0;
      border: 1px solid rgba(148,163,184,.16);
      background: rgba(148,163,184,.07);
      border-radius: 18px;
      padding: 13px;
      cursor: pointer;
      transition: transform .16s ease, border-color .16s ease, background .16s ease;
    }

    .resiar-score-card:hover {
      transform: translateY(-1px);
      border-color: rgba(139,92,246,.35);
      background: rgba(139,92,246,.08);
    }

    .resiar-score-name {
      color: var(--text);
      font-weight: 950;
      font-size: .92rem;
      line-height: 1.16;
    }

    .resiar-score-use {
      margin-top: 6px;
      color: var(--text2, #64748b);
      font-size: .75rem;
      line-height: 1.32;
    }

    .resiar-score-type {
      display: inline-block;
      margin-top: 9px;
      font-family: var(--font-mono, 'Space Grotesk', monospace);
      font-size: .55rem;
      letter-spacing: .09em;
      text-transform: uppercase;
      color: var(--violet,#8b5cf6);
      border: 1px solid rgba(139,92,246,.22);
      border-radius: 999px;
      padding: 4px 8px;
      background: rgba(139,92,246,.08);
    }

    .resiar-score-detail {
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 22px;
      padding: 16px;
      background: rgba(148,163,184,.06);
    }

    .resiar-score-back {
      border: 0;
      background: transparent;
      color: var(--violet,#8b5cf6);
      font-weight: 900;
      cursor: pointer;
      padding: 0;
      margin-bottom: 10px;
    }

    .resiar-score-info {
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
    }

    .resiar-score-pill {
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(148,163,184,.08);
      border-radius: 999px;
      padding: 7px 10px;
      color: var(--text2);
      font-size: .72rem;
      font-weight: 750;
      line-height: 1.2;
    }

    .resiar-score-calc {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .resiar-score-option {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 10px;
      align-items: center;
      border: 1px solid rgba(148,163,184,.16);
      border-radius: 15px;
      padding: 10px 12px;
      background: rgba(255,255,255,.03);
      cursor: pointer;
    }

    .resiar-score-option input,
    .resiar-score-option select {
      accent-color: var(--violet,#8b5cf6);
    }

    .resiar-score-option-text {
      font-size: .82rem;
      color: var(--text);
      line-height: 1.25;
      font-weight: 750;
    }

    .resiar-score-points {
      color: var(--text3,#94a3b8);
      font-family: var(--font-mono,'Space Grotesk',monospace);
      font-size: .65rem;
      font-weight: 900;
    }

    .resiar-score-field-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 9px;
      margin-top: 14px;
    }

    .resiar-score-field {
      display: grid;
      gap: 5px;
      color: var(--text2);
      font-size: .72rem;
      font-weight: 850;
    }

    .resiar-score-field input,
    .resiar-score-field select {
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,.24);
      background: rgba(148,163,184,.08);
      color: var(--text);
      padding: 0 10px;
      font-weight: 800;
    }

    .resiar-score-result {
      margin-top: 14px;
      padding: 13px 14px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(139,92,246,.12), rgba(16,185,129,.07));
      border: 1px solid rgba(139,92,246,.22);
    }

    .resiar-score-result-points {
      font-family: var(--font-serif,'Playfair Display',serif);
      font-size: 2rem;
      line-height: 1;
      color: var(--violet,#8b5cf6);
      font-weight: 900;
    }

    .resiar-score-result-text {
      margin-top: 6px;
      color: var(--text2);
      font-size: .84rem;
      line-height: 1.35;
      font-weight: 700;
    }

    .resiar-score-foot {
      padding: 12px 22px 18px;
      border-top: 1px solid rgba(148,163,184,.14);
      color: var(--text3, #94a3b8);
      font-size: .72rem;
      line-height: 1.35;
    }

    .resiar-score-empty {
      padding: 24px;
      border: 1px dashed rgba(148,163,184,.28);
      border-radius: 18px;
      color: var(--text2);
      text-align: center;
      font-weight: 750;
    }

    @media (max-width: 680px) {
      .resiar-score-overlay { padding: 0; }
      .resiar-score-panel { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
      .resiar-score-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function getScoreById(id) {
  return FLAT_SCORES.find((score) => score.id === id) || null;
}

function calcInterpretation(score, total) {
  const ranges = score.interpretation || [];
  const match = ranges.find((row) => total >= row.min && total <= row.max);
  return match?.text || score.interpretationText || 'Interpretar según contexto clínico.';
}

function scoreTypeLabel(score) {
  if (score.type === 'formula') return 'Fórmula';
  if (score.type === 'checklist') return 'Checklist calculable';
  return 'Calculadora';
}

function renderScores(query = '') {
  const body = document.getElementById('resiarClinicalScoresBody');
  if (!body) return;

  if (activeScoreId) {
    renderScoreDetail(activeScoreId);
    return;
  }

  const q = normalize(query);
  const matched = q ? FLAT_SCORES.filter((score) => score.searchText.includes(q)) : null;

  if (q && !matched.length) {
    body.innerHTML = `<div class="resiar-score-empty">No encontré scores para “${escapeHtml(query)}”. Probá con otra palabra o abreviatura.</div>`;
    return;
  }

  if (q) {
    const grouped = matched.reduce((acc, score) => {
      if (!acc[score.category]) acc[score.category] = [];
      acc[score.category].push(score);
      return acc;
    }, {});

    body.innerHTML = Object.entries(grouped).map(([category, scores]) => renderCategory(category, scores)).join('');
    bindScoreCards();
    return;
  }

  body.innerHTML = SCORE_GROUPS.map((group) => renderCategory(group.category, group.scores)).join('');
  bindScoreCards();
}

function renderCategory(category, scores) {
  return `
    <section class="resiar-score-category">
      <div class="resiar-score-category-title">${escapeHtml(category)}</div>
      <div class="resiar-score-grid">
        ${scores.map(renderScoreCard).join('')}
      </div>
    </section>`;
}

function renderScoreCard(score) {
  return `
    <article class="resiar-score-card" data-score-id="${escapeHtml(score.id)}">
      <div class="resiar-score-name">${escapeHtml(score.name)}</div>
      <div class="resiar-score-use">${escapeHtml(score.use)}</div>
      <span class="resiar-score-type">${escapeHtml(scoreTypeLabel(score))}</span>
    </article>`;
}

function bindScoreCards() {
  document.querySelectorAll('[data-score-id]').forEach((el) => {
    if (el.dataset.boundScoreCard) return;
    el.dataset.boundScoreCard = '1';
    el.addEventListener('click', () => {
      activeScoreId = el.dataset.scoreId || '';
      renderScores(lastQuery);
    });
  });
}

function renderVariables(score) {
  const vars = score.variables || [];
  if (!vars.length) return '';
  return `
    <div class="resiar-score-info">
      ${vars.map((v) => `<span class="resiar-score-pill">${escapeHtml(v)}</span>`).join('')}
    </div>`;
}

function renderScoreDetail(scoreId) {
  const body = document.getElementById('resiarClinicalScoresBody');
  const score = getScoreById(scoreId);
  if (!body || !score) return;

  body.innerHTML = `
    <div class="resiar-score-detail">
      <button type="button" class="resiar-score-back" id="resiarScoreBack">← Volver a scores</button>
      <div class="resiar-score-category-title" style="position:static;padding:0 0 8px;">${escapeHtml(score.category)}</div>
      <div class="resiar-score-name" style="font-size:1.15rem;">${escapeHtml(score.name)}</div>
      <div class="resiar-score-use">${escapeHtml(score.use)}</div>
      ${renderVariables(score)}
      ${score.note ? `<div class="resiar-score-result" style="background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.18);"><div class="resiar-score-result-text">${escapeHtml(score.note)}</div></div>` : ''}
      ${renderCalculator(score)}
    </div>`;

  document.getElementById('resiarScoreBack')?.addEventListener('click', () => {
    activeScoreId = '';
    renderScores(lastQuery);
  });

  bindCalculator(score);
}

function renderCalculator(score) {
  if (score.type === 'formula') return renderFormula(score);
  if (score.type === 'checklist') return renderChecklist(score);
  if (score.type === 'select') return renderSelectCalculator(score);
  return renderPointsCalculator(score);
}

function renderPointsCalculator(score) {
  return `
    <div class="resiar-score-calc" data-score-calc="${escapeHtml(score.id)}">
      ${(score.items || []).map((item, idx) => `
        <label class="resiar-score-option">
          <input type="checkbox" data-score-check="${idx}" value="${Number(item.points)}">
          <span class="resiar-score-option-text">${escapeHtml(item.label)}</span>
          <span class="resiar-score-points">${Number(item.points) > 0 ? '+' : ''}${Number(item.points)} p</span>
        </label>`).join('')}
    </div>
    <div class="resiar-score-result" id="resiarScoreResult"></div>`;
}

function renderSelectCalculator(score) {
  return `
    <div class="resiar-score-calc" data-score-calc="${escapeHtml(score.id)}">
      ${(score.selects || []).map((select, idx) => `
        <label class="resiar-score-option" style="grid-template-columns:1fr;">
          <span class="resiar-score-option-text">${escapeHtml(select.label)}</span>
          <select data-score-select="${idx}" style="width:100%;min-height:38px;border-radius:12px;border:1px solid rgba(148,163,184,.24);background:rgba(148,163,184,.08);color:var(--text);padding:0 10px;font-weight:750;">
            ${(select.options || []).map((opt) => `<option value="${Number(opt.points)}">${escapeHtml(opt.label)} · ${Number(opt.points)} p</option>`).join('')}
          </select>
        </label>`).join('')}
    </div>
    <div class="resiar-score-result" id="resiarScoreResult"></div>`;
}

function renderChecklist(score) {
  const vars = score.variables || [];
  return `
    <div class="resiar-score-calc" data-score-calc="${escapeHtml(score.id)}" data-checklist="1">
      ${vars.map((label, idx) => `
        <label class="resiar-score-option">
          <input type="checkbox" data-score-checklist="${idx}" value="1">
          <span class="resiar-score-option-text">${escapeHtml(label)}</span>
          <span class="resiar-score-points">variable</span>
        </label>`).join('')}
    </div>
    <div class="resiar-score-result" id="resiarScoreResult"></div>`;
}

function renderFormula(score) {
  if (score.formula === 'kdigo') {
    return `
      <div class="resiar-score-field-grid" data-score-formula="${escapeHtml(score.id)}">
        <label class="resiar-score-field">Categoría G / TFG
          <select data-formula-field="g">
            <option value="G1">G1 ≥90</option>
            <option value="G2">G2 60-89</option>
            <option value="G3a">G3a 45-59</option>
            <option value="G3b">G3b 30-44</option>
            <option value="G4">G4 15-29</option>
            <option value="G5">G5 <15</option>
          </select>
        </label>
        <label class="resiar-score-field">Albuminuria
          <select data-formula-field="a">
            <option value="A1">A1 normal o leve</option>
            <option value="A2">A2 moderada</option>
            <option value="A3">A3 severa</option>
          </select>
        </label>
      </div>
      <div class="resiar-score-result" id="resiarScoreResult"></div>`;
  }

  if (score.formula === 'rts') {
    return `
      <div class="resiar-score-field-grid" data-score-formula="${escapeHtml(score.id)}">
        <label class="resiar-score-field">Glasgow codificado
          <select data-formula-field="gcs">
            <option value="4">13-15</option><option value="3">9-12</option><option value="2">6-8</option><option value="1">4-5</option><option value="0">3</option>
          </select>
        </label>
        <label class="resiar-score-field">PAS codificada
          <select data-formula-field="sbp">
            <option value="4">>89</option><option value="3">76-89</option><option value="2">50-75</option><option value="1">1-49</option><option value="0">0</option>
          </select>
        </label>
        <label class="resiar-score-field">FR codificada
          <select data-formula-field="rr">
            <option value="4">10-29</option><option value="3">>29</option><option value="2">6-9</option><option value="1">1-5</option><option value="0">0</option>
          </select>
        </label>
      </div>
      <div class="resiar-score-result" id="resiarScoreResult"></div>`;
  }

  return `
    <div class="resiar-score-field-grid" data-score-formula="${escapeHtml(score.id)}">
      ${(score.fields || []).map((field) => `
        <label class="resiar-score-field">${escapeHtml(field.label)}${field.unit ? ` (${escapeHtml(field.unit)})` : ''}
          <input type="number" data-formula-field="${escapeHtml(field.key)}" min="${field.min ?? ''}" max="${field.max ?? ''}" step="${field.step ?? 'any'}" placeholder="${escapeHtml(field.unit || '')}">
        </label>`).join('')}
      ${score.formula === 'cockcroft' ? `
        <label class="resiar-score-field">Sexo
          <select data-formula-field="sex">
            <option value="male">Hombre</option>
            <option value="female">Mujer</option>
          </select>
        </label>` : ''}
    </div>
    <div class="resiar-score-result" id="resiarScoreResult"></div>`;
}

function valuesFromFormula(score) {
  const root = document.querySelector(`[data-score-formula="${CSS.escape(score.id)}"]`);
  const values = {};
  root?.querySelectorAll('[data-formula-field]').forEach((el) => {
    const key = el.dataset.formulaField;
    values[key] = el.tagName === 'SELECT' ? el.value : Number(el.value);
  });
  return values;
}

function calcFormula(score, values) {
  if (score.formula === 'meld') {
    const bili = Math.max(Number(values.bilirubin) || 1, 1);
    const inr = Math.max(Number(values.inr) || 1, 1);
    const creat = Math.max(Number(values.creatinine) || 1, 1);
    const meld = Math.round(3.78 * Math.log(bili) + 11.2 * Math.log(inr) + 9.57 * Math.log(creat) + 6.43);
    return { label: `${Math.max(6, meld)} puntos`, text: 'MELD clásico aproximado. A mayor puntaje, mayor gravedad/prioridad.' };
  }

  if (score.formula === 'cockcroft') {
    const age = Number(values.age);
    const weight = Number(values.weight);
    const creat = Number(values.creatinine);
    if (!age || !weight || !creat) return { label: '—', text: 'Completá edad, peso y creatinina.' };
    let crcl = ((140 - age) * weight) / (72 * creat);
    if (values.sex === 'female') crcl *= 0.85;
    return { label: `${Math.round(crcl)} mL/min`, text: 'Clearance de creatinina por Cockcroft-Gault aproximado.' };
  }

  if (score.formula === 'iss') {
    const a = Number(values.ais1) || 0;
    const b = Number(values.ais2) || 0;
    const c = Number(values.ais3) || 0;
    if ([a, b, c].some((x) => x === 6)) return { label: '75 puntos', text: 'AIS 6 implica ISS 75.' };
    const iss = a * a + b * b + c * c;
    return { label: `${iss} puntos`, text: iss >= 16 ? 'Trauma mayor según umbral habitual.' : 'Severidad menor-moderada según contexto.' };
  }

  if (score.formula === 'rts') {
    const gcs = Number(values.gcs) || 0;
    const sbp = Number(values.sbp) || 0;
    const rr = Number(values.rr) || 0;
    const rts = 0.9368 * gcs + 0.7326 * sbp + 0.2908 * rr;
    return { label: rts.toFixed(2), text: 'RTS ponderado. A menor valor, mayor gravedad fisiológica.' };
  }

  if (score.formula === 'kdigo') {
    const g = values.g;
    const a = values.a;
    const matrix = {
      G1: { A1: 'bajo', A2: 'moderado', A3: 'alto' },
      G2: { A1: 'bajo', A2: 'moderado', A3: 'alto' },
      G3a: { A1: 'moderado', A2: 'alto', A3: 'muy alto' },
      G3b: { A1: 'alto', A2: 'muy alto', A3: 'muy alto' },
      G4: { A1: 'muy alto', A2: 'muy alto', A3: 'muy alto' },
      G5: { A1: 'muy alto', A2: 'muy alto', A3: 'muy alto' }
    };
    const risk = matrix[g]?.[a] || '—';
    return { label: `${g} · ${a}`, text: `Riesgo KDIGO aproximado: ${risk}.` };
  }

  return { label: 'Calculado', text: score.interpretationText || 'Interpretar según contexto.' };
}

function bindCalculator(score) {
  const calc = document.querySelector(`[data-score-calc="${CSS.escape(score.id)}"]`);
  const formula = document.querySelector(`[data-score-formula="${CSS.escape(score.id)}"]`);

  const update = () => {
    let total = 0;
    let text = '';

    if (formula) {
      const result = calcFormula(score, valuesFromFormula(score));
      renderResult(result.label, result.text);
      return;
    }

    if (calc?.dataset.checklist === '1') {
      const checked = calc.querySelectorAll('[data-score-checklist]:checked').length;
      const totalVars = calc.querySelectorAll('[data-score-checklist]').length;
      const pct = totalVars ? Math.round((checked / totalVars) * 100) : 0;
      const completeText = checked === totalVars
        ? 'Variables completas para aplicar el score o calculadora oficial.'
        : `Faltan ${totalVars - checked} variable(s) para completar el cálculo.`;
      renderResult(`${checked}/${totalVars}`, `${completeText} ${score.interpretationText || ''}`.trim());
      return;
    }

    calc?.querySelectorAll('[data-score-check]').forEach((input) => {
      if (input.checked) total += Number(input.value || 0);
    });

    calc?.querySelectorAll('[data-score-select]').forEach((select) => {
      total += Number(select.value || 0);
    });

    text = calcInterpretation(score, total);
    renderResult(Number.isInteger(total) ? `${total} puntos` : `${total.toFixed(1)} puntos`, text);
  };

  const renderResult = (label, text) => {
    const result = document.getElementById('resiarScoreResult');
    if (!result) return;
    result.innerHTML = `
      <div class="resiar-score-result-points">${escapeHtml(label)}</div>
      <div class="resiar-score-result-text">${escapeHtml(text)}</div>`;
  };

  calc?.querySelectorAll('input, select').forEach((el) => el.addEventListener('change', update));
  formula?.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });

  update();
}

function buildModal() {
  if (modalBuilt) return;
  modalBuilt = true;

  const overlay = document.createElement('div');
  overlay.id = 'resiarClinicalScoresOverlay';
  overlay.className = 'resiar-score-overlay';
  overlay.innerHTML = `
    <div class="resiar-score-panel" role="dialog" aria-modal="true" aria-labelledby="resiarClinicalScoresTitle">
      <div class="resiar-score-head">
        <div>
          <div class="resiar-score-kicker">Consulta rápida</div>
          <div id="resiarClinicalScoresTitle" class="resiar-score-title">Scores clínicos</div>
        </div>
        <button id="resiarClinicalScoresClose" class="resiar-score-close" type="button" aria-label="Cerrar scores clínicos">×</button>
      </div>
      <div class="resiar-score-search-wrap">
        <input id="resiarClinicalScoresSearch" class="resiar-score-search" type="search" autocomplete="off" placeholder="Buscar: qSOFA, Wells, HEART, Glasgow, Child-Pugh..." />
      </div>
      <div id="resiarClinicalScoresBody" class="resiar-score-body"></div>
      <div class="resiar-score-foot">
        Herramienta de estudio. En scores complejos, el modo checklist asegura variables completas; para decisiones clínicas reales usá calculadoras oficiales y protocolos locales.
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeClinicalScores();
  });

  document.getElementById('resiarClinicalScoresClose')?.addEventListener('click', closeClinicalScores);
  document.getElementById('resiarClinicalScoresSearch')?.addEventListener('input', (event) => {
    lastQuery = event.target?.value || '';
    activeScoreId = '';
    renderScores(lastQuery);
  });

  renderScores('');
}

function openClinicalScores() {
  ensureStyles();
  buildModal();
  renderScores(lastQuery);

  const overlay = document.getElementById('resiarClinicalScoresOverlay');
  overlay?.classList.add('vis');

  const input = document.getElementById('resiarClinicalScoresSearch');
  if (input) {
    input.value = lastQuery;
    setTimeout(() => input.focus(), 80);
  }
}

function closeClinicalScores() {
  document.getElementById('resiarClinicalScoresOverlay')?.classList.remove('vis');
}

function findInsertionPoint() {
  const labButton = document.getElementById('resiarLabValuesButton');
  if (labButton) return { mode: 'after', el: labButton };

  const noteButton = document.getElementById('rpBtnNota');
  if (noteButton) return { mode: 'after', el: noteButton };

  const reportButton = document.getElementById('rpBtnReporte')
    || document.getElementById('btnReportarPregunta')
    || Array.from(document.querySelectorAll('button,a')).find((el) => /reportar pregunta/i.test(el.textContent || ''));

  if (reportButton) return { mode: 'before', el: reportButton };

  const rightPanel = document.getElementById('rightPanel')
    || document.getElementById('examRightPanel')
    || document.querySelector('.right-panel, .exam-side, .exam-sidebar');

  if (rightPanel) return { mode: 'append', el: rightPanel };

  return null;
}

function ensureButton() {
  if (!document.body) return;

  let btn = document.getElementById('resiarClinicalScoresButton');
  const target = findInsertionPoint();

  if (!target) {
    if (btn) btn.remove();
    return;
  }

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'resiarClinicalScoresButton';
    btn.type = 'button';
    btn.className = 'resiar-clinical-scores-btn';
    btn.textContent = '🧮 Scores clínicos';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openClinicalScores();
    });
  }

  if (!btn.isConnected) {
    if (target.mode === 'after') target.el.insertAdjacentElement('afterend', btn);
    else if (target.mode === 'before') target.el.insertAdjacentElement('beforebegin', btn);
    else target.el.appendChild(btn);
  }
}

function installKeyboardShortcut() {
  document.addEventListener('keydown', (event) => {
    const tag = String(event.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;

    if (event.key === 'Escape') {
      closeClinicalScores();
      return;
    }

    if (typing) return;

    if (event.altKey && !event.ctrlKey && !event.metaKey && String(event.key || '').toLowerCase() === 's') {
      event.preventDefault();
      openClinicalScores();
    }
  });
}

export function installClinicalScoresReference() {
  if (installed) return;
  installed = true;

  ensureStyles();
  buildModal();
  installKeyboardShortcut();

  const observer = new MutationObserver(() => {
    try { ensureButton(); } catch (_) {}
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => {
    try { ensureButton(); } catch (_) {}
  }, 1500);

  try {
    window.resiarOpenClinicalScores = openClinicalScores;
    window.resiarCloseClinicalScores = closeClinicalScores;
    window.resiarClinicalScores = SCORE_GROUPS;
  } catch (_) {}

  setTimeout(ensureButton, 100);
  setTimeout(ensureButton, 700);
  setTimeout(ensureButton, 1600);
}

export default installClinicalScoresReference;
