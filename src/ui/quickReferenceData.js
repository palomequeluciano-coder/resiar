// RESIAR — Datos de la Guía clínica (extraído de quickReference.js para code-splitting).
// Este archivo se carga de forma diferida (dynamic import) solo cuando el usuario abre la guía clínica,
// para no sumar su peso al bundle inicial de la app.

export const GUIDE_ITEMS = [
  // LABORATORIO — valores normales recuperados de versiones previas
  lab('lab-hemograma', 'Hematología', 'Laboratorio', 'Valores normales de hemograma y fórmula leucocitaria.', [
    table('Hemograma', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['Hemoglobina', 'Hombres 13-17 · Mujeres 12-15', 'g/dL'],
      ['Hematocrito', 'Hombres 40-50 · Mujeres 36-44', '%'],
      ['Glóbulos blancos', '4.000-11.000', '/µL'],
      ['Plaquetas', '150.000-400.000', '/µL'],
      ['VCM', '80-100', 'fL']
    ]),
    table('Fórmula leucocitaria', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['Neutrófilos', '40-70', '%'],
      ['Linfocitos', '20-40', '%'],
      ['Monocitos', '2-8', '%'],
      ['Eosinófilos', '1-4', '%'],
      ['Basófilos', '0-1', '%']
    ])
  ]),

  lab('lab-quimica-renal', 'Química sanguínea básica y renal', 'Laboratorio', 'Valores normales de glucemia, función renal, ácido úrico e ionograma básico.', [
    table('Química básica', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['Glucemia en ayunas', '70-100', 'mg/dL'],
      ['Urea', '15-40', 'mg/dL'],
      ['Creatinina', 'Hombres 0,6-1,2 · Mujeres 0,5-1,1', 'mg/dL'],
      ['Ácido úrico', 'Hombres 3,5-7,2 · Mujeres 2,6-6,0', 'mg/dL'],
      ['HbA1c', '<5,7 normal · 5,7-6,4 prediabetes · ≥6,5 diabetes', '%']
    ]),
    table('Ionograma y minerales', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['Sodio', '135-145', 'mEq/L'],
      ['Potasio', '3,5-5,0', 'mEq/L'],
      ['Cloro', '98-107', 'mEq/L'],
      ['Calcio', '8,5-10,5', 'mg/dL'],
      ['Fósforo', '2,5-4,5', 'mg/dL'],
      ['Magnesio', '1,7-2,2', 'mg/dL']
    ])
  ]),

  lab('lab-hepatograma', 'Función hepática', 'Laboratorio', 'Valores normales de hepatograma y proteínas.', [
    table('Hepatograma', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['ALT / TGP', 'Hombres 7-45 · Mujeres 7-37', 'U/L'],
      ['AST / TGO', '10-40', 'U/L'],
      ['Fosfatasa alcalina', '40-130', 'U/L'],
      ['Bilirrubina total', '0,3-1,2', 'mg/dL'],
      ['Bilirrubina directa', '0-0,3', 'mg/dL'],
      ['GGT', 'Hombres 8-61 · Mujeres 5-36', 'U/L']
    ]),
    table('Proteínas', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['Albúmina', '3,5-5,0', 'g/dL'],
      ['Proteínas totales', '6,0-8,0', 'g/dL']
    ])
  ]),

  lab('lab-lipidos-tiroides', 'Perfil lipídico y tiroides', 'Laboratorio', 'Valores poblacionales normales en adultos, objetivos terapéuticos según riesgo cardiovascular y función tiroidea.', [
    table('Perfil lipídico — valores poblacionales normales en adultos', ['Parámetro', 'Categoría', 'Valor'], [
      ['Colesterol total', 'Deseable', '<200 mg/dL'],
      ['Colesterol total', 'Limítrofe alto', '200-239 mg/dL'],
      ['Colesterol total', 'Alto', '≥240 mg/dL'],
      ['HDL-colesterol', 'Bajo / indeseable', '<40 mg/dL en hombres · <50 mg/dL en mujeres'],
      ['HDL-colesterol', 'Normal / deseable', '≥40 mg/dL en hombres · ≥50 mg/dL en mujeres'],
      ['Triglicéridos', 'Normal', '<150 mg/dL'],
      ['Triglicéridos', 'Limítrofe alto', '150-199 mg/dL'],
      ['Triglicéridos', 'Alto', '200-499 mg/dL'],
      ['Triglicéridos', 'Muy alto', '≥500 mg/dL']
    ]),
    table('LDL y colesterol no-HDL', ['Parámetro', 'Interpretación', 'Valor / objetivo'], [
      ['LDL-colesterol', 'No existe rango normal universal', 'El LDL óptimo varía según el riesgo cardiovascular individual'],
      ['LDL-colesterol', 'Población general sin factores de riesgo', '<130 mg/dL aceptable'],
      ['Colesterol no-HDL', 'Cálculo', 'Colesterol total - HDL'],
      ['Colesterol no-HDL', 'Objetivo', 'Varía según riesgo cardiovascular']
    ]),
    table('Objetivos terapéuticos según riesgo cardiovascular', ['Riesgo ASCVD a 10 años', 'Tratamiento / enfoque', 'Objetivo razonable'], [
      ['Bajo <3%', 'Modificación de estilos de vida', 'Sin objetivo farmacológico universal'],
      ['Bajo <3% con LDL 160-189 mg/dL o riesgo a 30 años ≥10%', 'Considerar estatina de intensidad moderada', 'Individualizar'],
      ['Limítrofe 3% a <5%', 'Estatina de intensidad moderada · reducción LDL ≥30-49%', 'LDL <100 mg/dL · no-HDL <130 mg/dL'],
      ['Intermedio 5% a <10%', 'Estatina de intensidad moderada a alta · reducción LDL ≥30-49% o ≥50%', 'LDL <100 mg/dL · no-HDL <130 mg/dL'],
      ['Alto ≥10%', 'Estatina de alta intensidad · reducción LDL ≥50%', 'LDL <70 mg/dL · no-HDL <100 mg/dL'],
      ['Alto ≥10% sin objetivo con estatina máxima tolerada', 'Considerar agregar ezetimiba', 'LDL <70 mg/dL · no-HDL <100 mg/dL']
    ]),
    table('Prevención secundaria y poblaciones especiales', ['Situación clínica', 'Conducta / tratamiento', 'Objetivo'], [
      ['Enfermedad cardiovascular establecida', 'Estatina de alta intensidad ± ezetimiba ± inhibidores PCSK9 según necesidad', 'Reducción LDL ≥50% desde basal'],
      ['Prevención secundaria — guías europeas', 'Tratamiento hipolipemiante intensivo', 'LDL <55 mg/dL'],
      ['Prevención secundaria — guías americanas', 'Tratamiento hipolipemiante intensivo', 'LDL <70 mg/dL · no-HDL <100 mg/dL'],
      ['LDL ≥190 mg/dL', 'Estatina de alta intensidad independientemente del riesgo calculado; sospechar hipercolesterolemia familiar', 'Reducción intensiva de LDL'],
      ['Diabetes mellitus 40-75 años', 'Estatina de intensidad moderada o alta según factores de riesgo adicionales', 'Individualizar según riesgo']
    ]),
    table('Función tiroidea', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['TSH', '0,27-4,20', 'mIU/L'],
      ['T4 libre', '0,8-1,8', 'ng/dL'],
      ['T3 libre', '2,3-4,2', 'pg/mL']
    ])
  ]),

  lab('lab-coagulacion', 'Coagulación', 'Laboratorio', 'Valores normales de coagulación.', [
    table('Coagulación', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['Tiempo de protrombina / TP', '11-13', 'segundos'],
      ['INR', '0,8-1,2', ''],
      ['KPTT / aPTT', '25-35', 'segundos'],
      ['Fibrinógeno', '200-400', 'mg/dL']
    ])
  ]),

  lab('lab-otros', 'Inflamación, páncreas y enzimas', 'Laboratorio', 'Otros valores útiles durante examen.', [
    table('Otros', ['Parámetro', 'Valor normal', 'Unidad'], [
      ['PCR ultrasensible', '<3', 'mg/L'],
      ['Amilasa', '30-110', 'U/L'],
      ['Lipasa', '10-140', 'U/L'],
      ['LDH', 'Variable según laboratorio', 'U/L']
    ])
  ]),

  // URGENCIAS / EMERGENCIAS
  score('qsofa', 'qSOFA', 'Urgencias / sepsis', 'Tamizaje rápido de riesgo en infección/sepsis.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['PAS ≤100 mmHg', '1'],
      ['FR ≥22/min', '1'],
      ['Alteración del estado mental / GCS <15', '1']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['0-1', 'Bajo riesgo de mortalidad o estancia prolongada en UCI'],
      ['≥2', 'Mayor riesgo; considerar sepsis']
    ]),
    note('Limitación', 'Baja sensibilidad; no usar como única herramienta de tamizaje para sepsis.')
  ], pointsCalc([
    ['PAS ≤100 mmHg', 1],
    ['FR ≥22/min', 1],
    ['Alteración del estado mental / GCS <15', 1]
  ], [[0,1,'Bajo riesgo relativo.'],[2,3,'Mayor riesgo; considerar sepsis.']])),

  score('news2', 'NEWS / NEWS2', 'Urgencias / deterioro clínico', 'Detección temprana de deterioro clínico en pacientes hospitalizados.', [
    table('Componentes', ['Parámetro', 'Puntaje'], [
      ['Frecuencia respiratoria', '0-3'],
      ['Saturación de oxígeno; NEWS2 incluye escala 1 y escala 2 para hipercapnia/EPOC', '0-3'],
      ['Oxígeno suplementario', '0-2'],
      ['Temperatura', '0-3'],
      ['PAS', '0-3'],
      ['Frecuencia cardíaca', '0-3'],
      ['Conciencia AVPU o nueva confusión', '0-3']
    ]),
    table('Interpretación', ['Puntaje', 'Conducta orientativa'], [
      ['0', 'Bajo riesgo clínico'],
      ['1-4', 'Riesgo bajo-medio; aumentar frecuencia de monitoreo'],
      ['5-6 o parámetro individual de 3', 'Riesgo medio; respuesta urgente'],
      ['≥7', 'Riesgo alto; respuesta de emergencia']
    ])
  ], checklistCalc(['FR','SatO₂','Oxígeno suplementario','Temperatura','PAS','FC','AVPU/nueva confusión'])),

  score('mews', 'MEWS', 'Urgencias / deterioro clínico', 'Predicción de deterioro clínico y mortalidad.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p', '3 p'], [
      ['PAS', '101-199', '81-100', '71-80 o ≥200', '≤70'],
      ['FC', '51-100', '41-50 o 101-110', '≤40 o 111-129', '≥130'],
      ['FR', '15-20', '9-14', '≤8 o 21-29', '≥30'],
      ['Temperatura', '35-38,4', '—', '<35 o ≥38,5', '—'],
      ['Conciencia', 'Alerta', 'Responde a voz', 'Responde a dolor', 'Inconsciente']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['0-2', 'Riesgo bajo'],
      ['3-4', 'Riesgo moderado; aumentar monitoreo'],
      ['≥5', 'Riesgo alto; evaluación urgente/considerar UCI']
    ])
  ], selectCalc([
    ['PAS', [['101-199',0],['81-100',1],['71-80 o ≥200',2],['≤70',3]]],
    ['FC', [['51-100',0],['41-50 o 101-110',1],['≤40 o 111-129',2],['≥130',3]]],
    ['FR', [['15-20',0],['9-14',1],['≤8 o 21-29',2],['≥30',3]]],
    ['Temperatura', [['35-38,4',0],['<35 o ≥38,5',2]]],
    ['Conciencia', [['Alerta',0],['Voz',1],['Dolor',2],['Inconsciente',3]]]
  ], [[0,2,'Riesgo bajo.'],[3,4,'Riesgo moderado.'],[5,99,'Riesgo alto.']])),

  score('perc', 'PERC', 'Urgencias / TEP', 'Regla de exclusión de embolia pulmonar en baja probabilidad pretest.', [
    table('Criterios', ['Criterio', 'Debe estar ausente para PERC negativo'], [
      ['Edad ≥50 años', 'Sí'],
      ['FC ≥100/min', 'Sí'],
      ['SatO₂ <95%', 'Sí'],
      ['Hemoptisis', 'Sí'],
      ['Uso de estrógenos', 'Sí'],
      ['Cirugía/trauma reciente', 'Sí'],
      ['TEP/TVP previo', 'Sí'],
      ['Signos clínicos de TVP unilateral', 'Sí']
    ]),
    table('Interpretación', ['Resultado', 'Lectura'], [
      ['0 criterios positivos', 'PERC negativo; en baja probabilidad pretest puede evitar más estudios'],
      ['≥1 criterio positivo', 'PERC positivo; no excluye TEP']
    ])
  ], pointsCalc([
    ['Edad ≥50 años',1],['FC ≥100/min',1],['SatO₂ <95%',1],['Hemoptisis',1],['Estrógenos',1],['Cirugía/trauma reciente',1],['TEP/TVP previo',1],['Signos TVP unilateral',1]
  ], [[0,0,'PERC negativo si la probabilidad pretest es baja.'],[1,8,'PERC positivo.']])),

  score('wells-tep', 'Wells TEP', 'Urgencias / TEP', 'Probabilidad clínica de embolia pulmonar.', [
    table('Criterios', ['Criterio', 'Puntos'], [
      ['Signos clínicos de TVP', '3'],
      ['TEP es diagnóstico más probable', '3'],
      ['FC >100/min', '1,5'],
      ['Inmovilización/cirugía reciente', '1,5'],
      ['TEP/TVP previo', '1,5'],
      ['Hemoptisis', '1'],
      ['Cáncer activo', '1']
    ]),
    table('Interpretación dicotómica', ['Puntaje', 'Lectura'], [
      ['≤4', 'TEP poco probable'],
      ['>4', 'TEP probable']
    ])
  ], pointsCalc([
    ['Signos clínicos de TVP',3],['TEP diagnóstico más probable',3],['FC >100/min',1.5],['Inmovilización/cirugía reciente',1.5],['TEP/TVP previo',1.5],['Hemoptisis',1],['Cáncer activo',1]
  ], [[0,4,'TEP poco probable.'],[4.01,99,'TEP probable.']])),

  score('wells-tvp', 'Wells TVP', 'Urgencias / TVP', 'Probabilidad clínica de trombosis venosa profunda.', [
    table('Criterios', ['Criterio', 'Puntos'], [
      ['Cáncer activo', '1'],
      ['Parálisis, paresia o inmovilización de miembro inferior', '1'],
      ['Reposo/cirugía mayor reciente', '1'],
      ['Dolor en trayecto venoso profundo', '1'],
      ['Edema de toda la pierna', '1'],
      ['Pantorrilla >3 cm vs contralateral', '1'],
      ['Edema con fóvea unilateral', '1'],
      ['Venas superficiales colaterales', '1'],
      ['TVP previa', '1'],
      ['Diagnóstico alternativo tan probable como TVP', '-2']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['≤1', 'TVP poco probable'],
      ['≥2', 'TVP probable']
    ])
  ], pointsCalc([
    ['Cáncer activo',1],['Parálisis/paresia/inmovilización MI',1],['Reposo/cirugía mayor reciente',1],['Dolor en trayecto venoso profundo',1],['Edema de toda la pierna',1],['Pantorrilla >3 cm',1],['Fóvea unilateral',1],['Venas colaterales',1],['TVP previa',1],['Diagnóstico alternativo tan probable como TVP',-2]
  ], [[-99,1,'TVP poco probable.'],[2,99,'TVP probable.']])),

  score('heart', 'HEART', 'Cardiología / dolor torácico', 'Estratificación de riesgo en dolor torácico / SCA.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p'], [
      ['Historia', 'Poco sospechosa', 'Moderada', 'Muy sospechosa'],
      ['ECG', 'Normal', 'Alteraciones inespecíficas', 'Depresión ST significativa'],
      ['Edad', '<45', '45-64', '≥65'],
      ['Factores de riesgo', 'Ninguno', '1-2', '≥3 o enfermedad aterosclerótica'],
      ['Troponina', 'Normal', '1-2× LSN', '>2× LSN']
    ]),
    table('Interpretación', ['Puntaje', 'Riesgo'], [
      ['0-3', 'Bajo'],
      ['4-6', 'Intermedio'],
      ['7-10', 'Alto']
    ])
  ], selectCalc([
    ['Historia', [['Poco sospechosa',0],['Moderada',1],['Muy sospechosa',2]]],
    ['ECG', [['Normal',0],['Inespecífico',1],['Depresión ST',2]]],
    ['Edad', [['<45',0],['45-64',1],['≥65',2]]],
    ['Factores de riesgo', [['Ninguno',0],['1-2',1],['≥3 o aterosclerosis',2]]],
    ['Troponina', [['Normal',0],['1-2× LSN',1],['>2× LSN',2]]]
  ], [[0,3,'Bajo riesgo.'],[4,6,'Riesgo intermedio.'],[7,10,'Alto riesgo.']])),

  score('curb65', 'CURB-65', 'Neumonía', 'Severidad de neumonía adquirida en la comunidad.', [
    table('Criterios', ['Criterio', 'Puntos'], [
      ['Confusión', '1'],
      ['Urea/BUN elevado', '1'],
      ['FR ≥30/min', '1'],
      ['PAS <90 o PAD ≤60 mmHg', '1'],
      ['Edad ≥65 años', '1']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['0-1', 'Bajo riesgo'],
      ['2', 'Riesgo intermedio; considerar internación'],
      ['3-5', 'Alto riesgo; internación, valorar UCI']
    ])
  ], pointsCalc([['Confusión',1],['Urea/BUN elevado',1],['FR ≥30',1],['PAS <90 o PAD ≤60',1],['Edad ≥65',1]], [[0,1,'Bajo riesgo.'],[2,2,'Riesgo intermedio.'],[3,5,'Alto riesgo.']])),

  // CARDIOLOGÍA
  score('chadsvasc', 'CHA₂DS₂-VASc', 'Cardiología / FA', 'Riesgo de stroke en fibrilación auricular.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['Insuficiencia cardíaca / disfunción VI', '1'],
      ['Hipertensión', '1'],
      ['Edad ≥75 años', '2'],
      ['Diabetes mellitus', '1'],
      ['Stroke/AIT/tromboembolismo previo', '2'],
      ['Enfermedad vascular', '1'],
      ['Edad 65-74 años', '1'],
      ['Sexo femenino', '1']
    ]),
    table('Interpretación orientativa', ['Puntaje', 'Conducta'], [
      ['0 hombre / 1 mujer', 'No anticoagulación'],
      ['1 hombre / 2 mujer', 'Considerar anticoagulación'],
      ['≥2 hombre / ≥3 mujer', 'Anticoagulación recomendada si no hay contraindicación']
    ])
  ], pointsCalc([['IC/disfunción VI',1],['HTA',1],['Edad ≥75',2],['Diabetes',1],['ACV/AIT/TE previo',2],['Enfermedad vascular',1],['Edad 65-74',1],['Sexo femenino',1]], [[0,0,'Riesgo bajo en varón.'],[1,1,'Riesgo intermedio.'],[2,9,'Riesgo alto.']])),

  score('hasbled', 'HAS-BLED', 'Cardiología / anticoagulación', 'Riesgo de sangrado en anticoagulación.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['Hipertensión no controlada', '1'],
      ['Función renal alterada', '1'],
      ['Función hepática alterada', '1'],
      ['Stroke previo', '1'],
      ['Sangrado previo o predisposición', '1'],
      ['INR lábil', '1'],
      ['Edad >65 años', '1'],
      ['Fármacos que favorecen sangrado', '1'],
      ['Alcohol', '1']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['0-2', 'Riesgo bajo-moderado'],
      ['≥3', 'Riesgo alto; corregir factores modificables']
    ])
  ], pointsCalc([['HTA no controlada',1],['Renal',1],['Hepático',1],['Stroke previo',1],['Sangrado previo',1],['INR lábil',1],['Edad >65',1],['Fármacos',1],['Alcohol',1]], [[0,2,'Bajo-moderado.'],[3,9,'Alto; corregir factores modificables.']])),

  score('timi', 'TIMI UA/NSTEMI', 'Cardiología / SCA', 'Estratificación de riesgo en SCA sin elevación del ST.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['Edad ≥65 años', '1'],
      ['≥3 factores de riesgo coronario', '1'],
      ['Estenosis coronaria conocida ≥50%', '1'],
      ['Desviación ST', '1'],
      ['≥2 episodios de angina en 24 h', '1'],
      ['AAS en últimos 7 días', '1'],
      ['Marcadores cardíacos positivos', '1']
    ]),
    table('Interpretación', ['Puntaje', 'Riesgo'], [
      ['0-1', 'Bajo'],
      ['2', 'Bajo-intermedio'],
      ['3-4', 'Intermedio'],
      ['5', 'Intermedio-alto'],
      ['6-7', 'Alto']
    ])
  ], pointsCalc([['Edad ≥65',1],['≥3 factores riesgo',1],['Estenosis coronaria conocida',1],['Desviación ST',1],['≥2 anginas/24h',1],['AAS últimos 7 días',1],['Marcadores positivos',1]], [[0,1,'Bajo.'],[2,2,'Bajo-intermedio.'],[3,4,'Intermedio.'],[5,5,'Intermedio-alto.'],[6,7,'Alto.']])),

  score('grace', 'GRACE', 'Cardiología / SCA', 'Predicción de mortalidad en síndrome coronario agudo.', [
    table('Variables', ['Variable', 'Rango aproximado de puntos'], [
      ['Edad', '0-100'],
      ['FC', '0-46'],
      ['PAS', '0-58'],
      ['Creatinina', '0-28'],
      ['Clase Killip', '0-59'],
      ['Paro cardíaco al ingreso', '0-39'],
      ['Desviación ST', '0-28'],
      ['Troponina elevada', '0-14']
    ]),
    table('Mortalidad hospitalaria', ['Puntaje', 'Riesgo'], [
      ['≤108', 'Bajo <1%'],
      ['109-140', 'Intermedio 1-3%'],
      ['>140', 'Alto >3%']
    ]),
    note('Uso', 'Score continuo; usar calculadora validada para puntaje exacto.')
  ], checklistCalc(['Edad','FC','PAS','creatinina','Killip','paro cardíaco','ST','troponina'])),

  score('killip', 'Killip-Kimball', 'Cardiología / IAM', 'Clasificación clínica de insuficiencia cardíaca en IAM.', [
    table('Clasificación', ['Clase', 'Descripción', 'Mortalidad hospitalaria'], [
      ['I', 'Sin signos de insuficiencia cardíaca', '6%'],
      ['II', 'IC leve-moderada; estertores <50%, posible S3', '17%'],
      ['III', 'Edema pulmonar agudo; estertores >50%', '38%'],
      ['IV', 'Shock cardiogénico; PAS <90 + hipoperfusión', '81%']
    ])
  ], selectCalc([['Clase', [['I',1],['II',2],['III',3],['IV',4]]]], [[1,1,'Clase I.'],[2,2,'Clase II.'],[3,3,'Clase III.'],[4,4,'Clase IV.']])),

  // RESPIRATORIOS
  score('gold', 'GOLD / GOLD ABE', 'Neumología / EPOC', 'Clasificación de EPOC por obstrucción, síntomas y exacerbaciones.', [
    table('Grado espirométrico', ['GOLD', 'VEF₁ post-BD'], [
      ['1', '≥80%'],
      ['2', '50-79%'],
      ['3', '30-49%'],
      ['4', '<30%']
    ]),
    table('Grupo ABE', ['Exacerbaciones', 'Pocos síntomas', 'Más síntomas'], [
      ['0-1 moderada sin internación', 'A', 'B'],
      ['≥2 moderadas o ≥1 con internación', 'E', 'E']
    ]),
    table('Síntomas', ['Instrumento', 'Pocos síntomas', 'Más síntomas'], [
      ['mMRC', '0-1', '≥2'],
      ['CAT', '<10', '≥10']
    ])
  ], customGoldCalc()),

  score('bode', 'BODE Index', 'Neumología / EPOC', 'Predicción multidimensional de mortalidad en EPOC.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p', '3 p'], [
      ['IMC', '>21', '≤21', '—', '—'],
      ['FEV₁ % predicho', '≥65', '50-64', '36-49', '≤35'],
      ['mMRC', '0-1', '2', '3', '4'],
      ['Caminata 6 min', '≥350 m', '250-349 m', '150-249 m', '≤149 m']
    ]),
    table('Mortalidad a 4 años', ['Puntaje', 'Mortalidad'], [
      ['0-2', '~20%'],
      ['3-4', '~30%'],
      ['5-6', '~40%'],
      ['7-10', '~80%']
    ])
  ], selectCalc([
    ['IMC', [['>21',0],['≤21',1]]],
    ['FEV₁ %', [['≥65',0],['50-64',1],['36-49',2],['≤35',3]]],
    ['mMRC', [['0-1',0],['2',1],['3',2],['4',3]]],
    ['Caminata 6 min', [['≥350',0],['250-349',1],['150-249',2],['≤149',3]]]
  ], [[0,2,'Cuartil 1: mortalidad ~20% a 4 años.'],[3,4,'Cuartil 2: ~30%.'],[5,6,'Cuartil 3: ~40%.'],[7,10,'Cuartil 4: ~80%.']])),

  score('bodex', 'BODEx Index', 'Neumología / EPOC', 'Alternativa a BODE cuando no puede realizarse caminata de 6 minutos.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p', '3 p'], [
      ['IMC', '>21', '≤21', '—', '—'],
      ['FEV₁ % predicho', '≥65', '50-64', '36-49', '≤35'],
      ['mMRC', '0-1', '2', '3', '4'],
      ['Exacerbaciones severas último año', '0', '1-2', '—', '≥3']
    ])
  ], selectCalc([
    ['IMC', [['>21',0],['≤21',1]]],
    ['FEV₁ %', [['≥65',0],['50-64',1],['36-49',2],['≤35',3]]],
    ['mMRC', [['0-1',0],['2',1],['3',2],['4',3]]],
    ['Exacerbaciones severas/año', [['0',0],['1-2',1],['≥3',3]]]
  ], [[0,2,'Menor riesgo.'],[3,4,'Intermedio-bajo.'],[5,6,'Intermedio-alto.'],[7,10,'Mayor riesgo.']])),

  // PEDIATRÍA / OBSTETRICIA
  score('apgar', 'APGAR', 'Neonatología', 'Evaluación rápida del recién nacido y respuesta a resucitación.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p'], [
      ['Apariencia/color', 'Cianosis central o palidez', 'Acrocianosis', 'Rosado'],
      ['Pulso', 'Ausente', '<100 lpm', '≥100 lpm'],
      ['Gesticulación', 'Sin respuesta', 'Mueca/llanto débil', 'Llanto vigoroso/tos/estornudo'],
      ['Actividad', 'Flácido', 'Alguna flexión', 'Movimiento activo'],
      ['Respiración', 'Ausente', 'Débil/irregular', 'Llanto fuerte/regular']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['7-10', 'Tranquilizador'],
      ['4-6', 'Moderadamente anormal; puede requerir intervención'],
      ['0-3', 'Bajo; requiere resucitación inmediata']
    ]),
    note('Importante', 'No se usa para decidir inicio de resucitación; esta debe iniciarse antes del puntaje de 1 minuto si corresponde.')
  ], selectCalc([
    ['Color', [['Cianosis/palidez',0],['Acrocianosis',1],['Rosado',2]]],
    ['Pulso', [['Ausente',0],['<100',1],['≥100',2]]],
    ['Reflejos', [['Sin respuesta',0],['Mueca',1],['Llanto/tos',2]]],
    ['Tono', [['Flácido',0],['Flexión leve',1],['Activo',2]]],
    ['Respiración', [['Ausente',0],['Débil/irregular',1],['Llanto fuerte',2]]]
  ], [[0,3,'Bajo.'],[4,6,'Moderadamente anormal.'],[7,10,'Tranquilizador.']])),

  score('tal', 'Tal modificado', 'Pediatría / bronquiolitis', 'Severidad de bronquiolitis/sibilancias.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p', '3 p'], [
      ['FR', '<30', '31-45', '46-60', '>60'],
      ['Sibilancias', 'No', 'Final espiración con estetoscopio', 'Toda espiración con estetoscopio', 'Inspiración y espiración sin estetoscopio'],
      ['Retracción/tiraje', 'No', 'Intercostal leve', 'Intercostal marcado', 'Intercostal + supraesternal + aleteo nasal'],
      ['Cianosis', 'No', 'Perioral en reposo', 'Generalizada en reposo', 'Generalizada con FiO₂ 40%'],
      ['Ventilación', 'Normal', 'Disminuida', 'Muy disminuida', 'Ausente/silencio']
    ]),
    table('Interpretación', ['Puntaje', 'Severidad'], [
      ['0-4', 'Leve - manejo ambulatorio'],
      ['5-8', 'Moderado - hospitalización'],
      ['9-12', 'Severo - hospitalización, considerar UCI'],
      ['≥13', 'Muy severo - UCI']
    ])
  ], selectCalc([
    ['FR', [['<30',0],['31-45',1],['46-60',2],['>60',3]]],
    ['Sibilancias', [['No',0],['Final espiración',1],['Toda espiración',2],['Insp+esp sin estetoscopio',3]]],
    ['Retracción', [['No',0],['Leve',1],['Marcada',2],['Intercostal + supraesternal + aleteo',3]]],
    ['Cianosis', [['No',0],['Perioral',1],['Generalizada',2],['Generalizada con FiO₂ 40%',3]]],
    ['Ventilación', [['Normal',0],['Disminuida',1],['Muy disminuida',2],['Ausente',3]]]
  ], [[0,4,'Leve.'],[5,8,'Moderado.'],[9,12,'Severo.'],[13,15,'Muy severo.']])),

  criteria('deshidratacion-oms', 'Deshidratación pediátrica OMS', 'Pediatría', 'Clasificación clínica de deshidratación en niños con diarrea.', [
    table('Clasificación', ['Categoría', 'Signos', 'Pérdida de peso', 'Manejo'], [
      ['Sin deshidratación', 'Bien, alerta; ojos normales; lágrimas presentes; boca húmeda; bebe normal; pliegue inmediato', '<3%', 'Plan A'],
      ['Leve-moderada', '≥2 signos: inquieto/irritable, ojos hundidos, lágrimas ausentes, boca seca, bebe ávidamente, pliegue lento', '3-9%', 'Plan B: SRO 75 mL/kg en 4 h'],
      ['Severa', '≥2 signos: letárgico/inconsciente, ojos muy hundidos, boca muy seca, bebe mal/no puede, pliegue >2 s', '≥10%', 'Plan C: rehidratación IV inmediata']
    ])
  ], checklistCalc(['Aspecto general','Ojos','Lágrimas','Boca/lengua','Sed/bebe','Pliegue'])),

  score('bishop', 'Bishop', 'Obstetricia', 'Madurez cervical antes de inducción del trabajo de parto.', [
    table('Componentes', ['Variable', '0 p', '1 p', '2 p', '3 p'], [
      ['Dilatación', 'Cerrado', '1-2 cm', '3-4 cm', '≥5 cm'],
      ['Borramiento', '0-30%', '40-50%', '60-70%', '≥80%'],
      ['Estación', '-3', '-2', '-1 / 0', '+1 / +2'],
      ['Consistencia', 'Firme', 'Media', 'Blanda', '—'],
      ['Posición', 'Posterior', 'Media', 'Anterior', '—']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['≤5', 'Cérvix desfavorable; requiere maduración cervical'],
      ['6-8', 'Zona intermedia'],
      ['≥9', 'Cérvix favorable; alta probabilidad de parto vaginal exitoso en 24 h']
    ])
  ], selectCalc([
    ['Dilatación', [['Cerrado',0],['1-2',1],['3-4',2],['≥5',3]]],
    ['Borramiento', [['0-30%',0],['40-50%',1],['60-70%',2],['≥80%',3]]],
    ['Estación', [['-3',0],['-2',1],['-1/0',2],['+1/+2',3]]],
    ['Consistencia', [['Firme',0],['Media',1],['Blanda',2]]],
    ['Posición', [['Posterior',0],['Media',1],['Anterior',2]]]
  ], [[0,5,'Desfavorable.'],[6,8,'Intermedio.'],[9,13,'Favorable.']])),

  score('preeclampsia-severa', 'Preeclampsia con criterios de severidad', 'Obstetricia', 'Presencia de ≥1 criterio de severidad.', [
    table('Criterios de severidad', ['Sistema', 'Criterio'], [
      ['Presión arterial', 'PAS ≥160 o PAD ≥110 en dos ocasiones separadas por ≥4 h, salvo tratamiento antes'],
      ['Síntomas', 'Cefalea persistente/severa, alteraciones visuales, dolor CSD/epigastrio'],
      ['Laboratorio', 'Plaquetas <100.000/µL, transaminasas >2× LSN, creatinina >1,1 o duplicación'],
      ['Pulmonar', 'Edema pulmonar'],
      ['Uteroplacentario', 'Restricción del crecimiento fetal']
    ]),
    table('Timing orientativo', ['Edad gestacional', 'Conducta'], [
      ['≥34 semanas', 'Parto recomendado'],
      ['<34 semanas', 'Manejo expectante + corticosteroides si estable']
    ])
  ], pointsCalc([['PA severa',1],['Síntomas neurológicos/visuales/dolor CSD',1],['Plaquetas <100.000',1],['Transaminasas >2×',1],['Creatinina >1,1 o duplicación',1],['Edema pulmonar',1],['RCIU',1]], [[0,0,'Sin criterios marcados.'],[1,99,'Preeclampsia con criterios de severidad.']])),

  // CIRUGÍA / GASTRO / HEPATOLOGÍA
  score('alvarado', 'Alvarado', 'Cirugía / apendicitis', 'Estratifica probabilidad de apendicitis aguda.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['Migración a FID', '1'],
      ['Anorexia', '1'],
      ['Náusea/vómito', '1'],
      ['Dolor a palpación en FID', '2'],
      ['Rebote / Blumberg', '1'],
      ['Fiebre >37,3°C', '1'],
      ['Leucocitosis >10.000/µL', '2'],
      ['Desviación izquierda >75% neutrófilos', '1']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['1-4', 'Baja probabilidad'],
      ['5-6', 'Intermedia; observación o imagen'],
      ['7-8', 'Alta; considerar cirugía'],
      ['9-10', 'Muy alta; cirugía indicada']
    ])
  ], pointsCalc([['Migración',1],['Anorexia',1],['Náusea/vómito',1],['Dolor FID',2],['Rebote',1],['Fiebre',1],['Leucocitosis',2],['Desviación izquierda',1]], [[0,4,'Baja probabilidad.'],[5,6,'Intermedia.'],[7,8,'Alta.'],[9,10,'Muy alta.']])),

  score('ranson', 'Ranson', 'Gastro / pancreatitis', 'Predice severidad y mortalidad en pancreatitis aguda; requiere 48 h.', [
    table('Criterios al ingreso', ['Criterio', 'Puntos'], [
      ['Edad >55 años', '1'],
      ['Leucocitos >16.000/µL', '1'],
      ['Glucosa >200 mg/dL', '1'],
      ['LDH >350 UI/L', '1'],
      ['AST >250 UI/L', '1']
    ]),
    table('Criterios a las 48 h', ['Criterio', 'Puntos'], [
      ['Caída hematocrito >10%', '1'],
      ['Elevación BUN >5 mg/dL', '1'],
      ['Calcio <8 mg/dL', '1'],
      ['PaO₂ <60 mmHg', '1'],
      ['Déficit de base >4 mEq/L', '1'],
      ['Secuestro de líquidos >6 L', '1']
    ]),
    table('Mortalidad', ['Puntaje', 'Mortalidad'], [
      ['0-2', '<1%'],
      ['3-4', '~15%'],
      ['5-6', '~40%'],
      ['≥7', '~100%']
    ])
  ], pointsCalc([['Edad >55',1],['Leucocitos >16.000',1],['Glucosa >200',1],['LDH >350',1],['AST >250',1],['Caída Hto >10%',1],['BUN +>5',1],['Ca <8',1],['PaO₂ <60',1],['Déficit base >4',1],['Secuestro líquidos >6 L',1]], [[0,2,'Mortalidad <1%.'],[3,4,'Mortalidad ~15%.'],[5,6,'Mortalidad ~40%.'],[7,11,'Mortalidad muy alta.']])),

  criteria('tokyo-colecistitis', 'Tokyo TG18 — colecistitis aguda', 'Gastro / cirugía', 'Diagnóstico y severidad de colecistitis aguda.', [
    table('Diagnóstico', ['Grupo', 'Criterios'], [
      ['A. Local', 'Murphy; masa/dolor/dolor a palpación en CSD'],
      ['B. Sistémico', 'Fiebre, PCR elevada, leucocitosis'],
      ['C. Imagen', 'Hallazgos característicos'],
      ['Sospecha', '1 ítem de A + 1 ítem de B'],
      ['Definitivo', 'A + B + C']
    ]),
    table('Severidad', ['Grado', 'Criterio'], [
      ['I leve', 'No cumple grado II o III'],
      ['II moderado', 'Leucocitos >18.000, masa CSD, síntomas >72 h o inflamación local marcada'],
      ['III severo', 'Disfunción orgánica cardiovascular, neurológica, respiratoria, renal, hepática o hematológica']
    ])
  ], checklistCalc(['A local','B sistémico','C imagen','criterio grado II','disfunción orgánica'])),

  criteria('tokyo-colangitis', 'Tokyo TG18 — colangitis aguda', 'Gastro / cirugía', 'Diagnóstico y severidad de colangitis aguda.', [
    table('Diagnóstico', ['Grupo', 'Criterios'], [
      ['A. Inflamación sistémica', 'Fiebre/escalofríos o laboratorio inflamatorio'],
      ['B. Colestasis', 'Ictericia o BT >2 mg/dL / FA-GGT-ALT-AST elevadas'],
      ['C. Imagen', 'Dilatación biliar o etiología visible'],
      ['Sospecha', '1 ítem de A'],
      ['Definitivo', 'A + B o C']
    ]),
    table('Severidad', ['Grado', 'Criterio'], [
      ['I leve', 'No cumple grado II o III'],
      ['II moderado', 'WBC >12.000 o <4.000, fiebre ≥39, edad ≥75, BT ≥5, albúmina baja'],
      ['III severo', 'Disfunción orgánica cardiovascular, neurológica, respiratoria, renal, hepática o hematológica']
    ]),
    note('Péntada de Reynolds', 'Tríada de Charcot + hipotensión + alteración del estado mental.')
  ], checklistCalc(['A inflamación','B colestasis','C imagen','criterio grado II','disfunción orgánica'])),

  score('childpugh', 'Child-Pugh', 'Hepatología', 'Severidad de cirrosis y pronóstico.', [
    table('Componentes', ['Variable', '1 p', '2 p', '3 p'], [
      ['Bilirrubina', '<2', '2-3', '>3'],
      ['Albúmina', '>3,5', '2,8-3,5', '<2,8'],
      ['INR', '<1,7', '1,7-2,3', '>2,3'],
      ['Ascitis', 'Ausente', 'Leve-moderada', 'Severa/refractaria'],
      ['Encefalopatía', 'Ausente', 'Grado I-II', 'Grado III-IV']
    ]),
    table('Clasificación', ['Clase', 'Puntaje', 'Supervivencia 1 año', 'Mortalidad perioperatoria'], [
      ['A', '5-6', '100%', '10%'],
      ['B', '7-9', '81%', '30%'],
      ['C', '10-15', '45%', '82%']
    ])
  ], selectCalc([
    ['Bilirrubina', [['<2',1],['2-3',2],['>3',3]]],
    ['Albúmina', [['>3,5',1],['2,8-3,5',2],['<2,8',3]]],
    ['INR', [['<1,7',1],['1,7-2,3',2],['>2,3',3]]],
    ['Ascitis', [['Ausente',1],['Leve-moderada',2],['Severa',3]]],
    ['Encefalopatía', [['Ausente',1],['I-II',2],['III-IV',3]]]
  ], [[5,6,'Clase A.'],[7,9,'Clase B.'],[10,15,'Clase C.']])),

  score('meld', 'MELD', 'Hepatología', 'Predice mortalidad a 3 meses y priorización para trasplante hepático.', [
    table('Fórmula', ['Elemento', 'Detalle'], [
      ['MELD', '3,78 ln(bilirrubina) + 11,2 ln(INR) + 9,57 ln(creatinina) + 6,43'],
      ['Valores <1', 'Usar 1'],
      ['Creatinina', 'Máximo 4 mg/dL; diálisis reciente = 4'],
      ['Rango', '6-40']
    ]),
    table('Mortalidad 3 meses', ['MELD', 'Mortalidad'], [
      ['<9', '1,9%'],
      ['10-19', '6%'],
      ['20-29', '19,6%'],
      ['30-39', '52,6%'],
      ['≥40', '71,3%']
    ])
  ], formulaCalc('meld')),

  // NEUROLOGÍA
  score('glasgow', 'Glasgow Coma Scale', 'Neurología', 'Evaluación objetiva del nivel de conciencia.', [
    table('Componentes', ['Respuesta', 'Puntos'], [
      ['Ocular: espontánea / voz / dolor / no abre', '4 / 3 / 2 / 1'],
      ['Verbal: orientado / confuso / palabras / sonidos / ninguna', '5 / 4 / 3 / 2 / 1'],
      ['Motora: obedece / localiza / retira / flexión / extensión / ninguna', '6 / 5 / 4 / 3 / 2 / 1']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['13-15', 'TCE leve'],
      ['9-12', 'TCE moderado'],
      ['3-8', 'TCE severo; ≤8 intubate']
    ])
  ], selectCalc([
    ['Ocular', [['No abre',1],['Dolor',2],['Voz',3],['Espontánea',4]]],
    ['Verbal', [['Ninguna',1],['Sonidos',2],['Palabras inapropiadas',3],['Confuso',4],['Orientado',5]]],
    ['Motora', [['Ninguna',1],['Extensión',2],['Flexión',3],['Retira',4],['Localiza',5],['Obedece',6]]]
  ], [[3,8,'Severo.'],[9,12,'Moderado.'],[13,15,'Leve.']])),

  score('abcd2', 'ABCD²', 'Neurología / AIT', 'Riesgo de stroke después de AIT.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['Edad ≥60', '1'],
      ['PA ≥140/90', '1'],
      ['Debilidad unilateral', '2'],
      ['Alteración lenguaje sin debilidad', '1'],
      ['Duración ≥60 min', '2'],
      ['Duración 10-59 min', '1'],
      ['Diabetes', '1']
    ]),
    table('Riesgo stroke', ['Puntaje', '2 días', '7 días'], [
      ['0-3', '1%', '1,2%'],
      ['4-5', '4,1%', '5,9%'],
      ['6-7', '8,1%', '11,7%']
    ])
  ], selectCalc([
    ['Edad', [['<60',0],['≥60',1]]],
    ['PA', [['Menor',0],['≥140/90',1]]],
    ['Clínica', [['Otros',0],['Lenguaje sin debilidad',1],['Debilidad unilateral',2]]],
    ['Duración', [['<10 min',0],['10-59 min',1],['≥60 min',2]]],
    ['Diabetes', [['No',0],['Sí',1]]]
  ], [[0,3,'Bajo riesgo.'],[4,5,'Moderado.'],[6,7,'Alto.']])),

  score('nihss', 'NIHSS', 'Neurología / ACV', 'Cuantifica severidad de stroke isquémico agudo.', [
    table('Componentes', ['Ítem', 'Rango'], [
      ['Nivel de conciencia', '0-3'],
      ['Preguntas', '0-2'],
      ['Comandos', '0-2'],
      ['Mirada', '0-2'],
      ['Campos visuales', '0-3'],
      ['Paresia facial', '0-3'],
      ['Motor brazo izquierdo/derecho', '0-4 cada uno'],
      ['Motor pierna izquierda/derecha', '0-4 cada uno'],
      ['Ataxia', '0-2'],
      ['Sensibilidad', '0-2'],
      ['Lenguaje/afasia', '0-3'],
      ['Disartria', '0-2'],
      ['Extinción/inatención', '0-2']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['0', 'Sin síntomas'],
      ['1-4', 'Stroke menor'],
      ['5-15', 'Moderado'],
      ['16-20', 'Moderado-severo'],
      ['21-42', 'Severo']
    ])
  ], checklistCalc(['LOC','preguntas','comandos','mirada','campos','facial','motor brazos','motor piernas','ataxia','sensibilidad','lenguaje','disartria','inatención'])),

  score('ich', 'ICH Score', 'Neurología / hemorragia intracerebral', 'Predice mortalidad a 30 días en hemorragia intracerebral espontánea.', [
    table('Componentes', ['Criterio', 'Puntos'], [
      ['Volumen hematoma ≥30 cm³', '1'],
      ['Localización infratentorial', '1'],
      ['Extensión intraventricular', '1'],
      ['Edad ≥80', '1'],
      ['GCS 5-12', '1'],
      ['GCS 3-4', '2']
    ]),
    table('Mortalidad 30 días', ['Puntaje', 'Mortalidad'], [
      ['0', '0%'],
      ['1', '13%'],
      ['2', '26%'],
      ['3', '72%'],
      ['4', '97%'],
      ['5-6', '100%']
    ])
  ], selectCalc([
    ['GCS', [['13-15',0],['5-12',1],['3-4',2]]],
    ['Volumen', [['<30',0],['≥30',1]]],
    ['Localización', [['Supratentorial',0],['Infratentorial',1]]],
    ['Intraventricular', [['No',0],['Sí',1]]],
    ['Edad', [['<80',0],['≥80',1]]]
  ], [[0,0,'0% mortalidad 30 días.'],[1,1,'13%.'],[2,2,'26%.'],[3,3,'72%.'],[4,4,'97%.'],[5,6,'100%.']])),

  // ADICCIONES
  score('cage', 'CAGE', 'Adicciones / alcohol', 'Tamizaje rápido de trastorno por uso de alcohol.', [
    table('Preguntas', ['Letra', 'Pregunta'], [
      ['C', 'Cut down: reducir consumo'],
      ['A', 'Annoyed: molestia por críticas'],
      ['G', 'Guilty: culpa'],
      ['E', 'Eye-opener: beber al despertar']
    ]),
    table('Interpretación', ['Puntaje', 'Lectura'], [
      ['0', 'Bajo riesgo'],
      ['1', 'Posible problema; explorar más'],
      ['2', 'Probable trastorno por uso de alcohol'],
      ['≥3', 'Alta probabilidad de dependencia alcohólica']
    ])
  ], pointsCalc([['Cut down',1],['Annoyed',1],['Guilty',1],['Eye-opener',1]], [[0,0,'Bajo riesgo.'],[1,1,'Posible problema.'],[2,2,'Probable trastorno.'],[3,4,'Alta probabilidad.']])),

  score('audit-c', 'AUDIT-C', 'Adicciones / alcohol', 'Versión abreviada del AUDIT para consumo de riesgo.', [
    table('Componentes', ['Pregunta', '0', '1', '2', '3', '4'], [
      ['Frecuencia', 'Nunca', 'Mensual o menos', '2-4/mes', '2-3/sem', '≥4/sem'],
      ['Cantidad típica', '1-2', '3-4', '5-6', '7-9', '≥10'],
      ['≥6 bebidas en ocasión', 'Nunca', '< mensual', 'Mensual', 'Semanal', 'Diario/casi diario']
    ]),
    table('Punto de corte', ['Sexo', 'Positivo'], [
      ['Hombres', '≥4'],
      ['Mujeres', '≥3']
    ])
  ], selectCalc([
    ['Frecuencia', [['Nunca',0],['Mensual o menos',1],['2-4/mes',2],['2-3/sem',3],['≥4/sem',4]]],
    ['Cantidad típica', [['1-2',0],['3-4',1],['5-6',2],['7-9',3],['≥10',4]]],
    ['≥6 bebidas', [['Nunca',0],['< mensual',1],['Mensual',2],['Semanal',3],['Diario/casi diario',4]]]
  ], [[0,2,'Bajo riesgo general.'],[3,3,'Positivo en mujeres; en hombres suele requerir ≥4.'],[4,12,'Positivo en hombres y mujeres.']])),

  // RENAL / TRAUMA / ONCOLOGÍA
  score('kdigo', 'KDIGO ERC', 'Nefrología', 'Clasificación de ERC por TFG y albuminuria.', [
    table('Categorías G', ['G', 'TFG', 'Descripción'], [
      ['G1', '≥90', 'Normal o alta'],
      ['G2', '60-89', 'Levemente disminuida'],
      ['G3a', '45-59', 'Leve-moderada'],
      ['G3b', '30-44', 'Moderada-severa'],
      ['G4', '15-29', 'Severa'],
      ['G5', '<15', 'Falla renal']
    ]),
    table('Categorías A', ['A', 'Albuminuria', 'Descripción'], [
      ['A1', '<30 mg/g', 'Normal-leve'],
      ['A2', '30-300 mg/g', 'Moderada'],
      ['A3', '>300 mg/g', 'Severa']
    ])
  ], customKdigoCalc()),

  formula('cockcroft', 'Cockcroft-Gault', 'Renal / ajuste de fármacos', [
    table('Fórmula', ['Sexo', 'Cálculo'], [
      ['Hombre', '[(140 - edad) × peso] / [72 × creatinina]'],
      ['Mujer', 'resultado × 0,85']
    ])
  ], formulaCalc('cockcroft')),

  score('rts', 'Revised Trauma Score', 'Trauma', 'Severidad fisiológica en trauma.', [
    table('Codificación', ['Variable', '4 p', '3 p', '2 p', '1 p', '0 p'], [
      ['Glasgow', '13-15', '9-12', '6-8', '4-5', '3'],
      ['PAS', '>89', '76-89', '50-75', '1-49', '0'],
      ['FR', '10-29', '>29', '6-9', '1-5', '0']
    ]),
    table('RTS ponderado', ['Componente', 'Coeficiente'], [
      ['GCS codificado', '0,9368'],
      ['PAS codificada', '0,7326'],
      ['FR codificada', '0,2908']
    ])
  ], formulaCalc('rts')),

  score('iss', 'Injury Severity Score', 'Trauma', 'Severidad anatómica de lesiones.', [
    table('AIS', ['AIS', 'Severidad'], [
      ['1', 'Menor'],
      ['2', 'Moderada'],
      ['3', 'Seria'],
      ['4', 'Severa'],
      ['5', 'Crítica'],
      ['6', 'Máxima / actualmente insalvable']
    ]),
    table('ISS', ['Cálculo', 'Interpretación'], [
      ['Suma de cuadrados de las 3 regiones AIS más graves', 'Rango 1-75'],
      ['AIS 6', 'ISS = 75 automáticamente'],
      ['ISS ≥16', 'Trauma mayor']
    ])
  ], formulaCalc('iss')),

  score('triss', 'TRISS', 'Trauma', 'Probabilidad de supervivencia en trauma.', [
    table('Variables', ['Variable', 'Detalle'], [
      ['RTS', 'Fisiología'],
      ['ISS', 'Anatomía'],
      ['Edad', '<55 vs ≥55'],
      ['Mecanismo', 'Romo o penetrante']
    ]),
    table('Coeficientes', ['Mecanismo', 'b0', 'b1 RTS', 'b2 ISS', 'b3 edad ≥55'], [
      ['Romo', '-0,4499', '0,8085', '-0,0835', '-1,7430'],
      ['Penetrante', '-2,5355', '0,9934', '-0,0651', '-1,1360']
    ])
  ], formulaCalc('triss')),

  score('ecog', 'ECOG', 'Oncología', 'Estado funcional en pacientes oncológicos.', [
    table('Escala', ['ECOG', 'Descripción'], [
      ['0', 'Actividad normal'],
      ['1', 'Restricción leve; actividad física extenuante limitada'],
      ['2', 'Ambulatorio, autocuidado; incapaz de trabajar; levantado >50%'],
      ['3', 'Autocuidado limitado; cama/silla >50%'],
      ['4', 'Completamente discapacitado'],
      ['5', 'Muerto']
    ])
  ], selectCalc([['ECOG', [['0',0],['1',1],['2',2],['3',3],['4',4],['5',5]]]], [[0,1,'Buen estado funcional.'],[2,2,'Intermedio.'],[3,4,'Mal estado funcional.'],[5,5,'Muerte.']])),

  score('karnofsky', 'Karnofsky Performance Status', 'Oncología', 'Capacidad funcional global.', [
    table('Escala', ['KPS', 'Descripción'], [
      ['100', 'Normal'],
      ['90', 'Actividad normal, síntomas menores'],
      ['80', 'Actividad normal con esfuerzo'],
      ['70', 'Autocuidado; no actividad normal'],
      ['60', 'Requiere asistencia ocasional'],
      ['50', 'Requiere asistencia considerable'],
      ['40', 'Discapacitado'],
      ['30', 'Severamente discapacitado'],
      ['20', 'Muy enfermo'],
      ['10', 'Moribundo'],
      ['0', 'Muerto']
    ]),
    table('Conversión ECOG-KPS', ['ECOG', 'KPS'], [
      ['0', '90-100'],
      ['1', '70-80'],
      ['2', '50-60'],
      ['3', '30-40'],
      ['4', '10-20']
    ])
  ], selectCalc([['KPS', [['100',100],['90',90],['80',80],['70',70],['60',60],['50',50],['40',40],['30',30],['20',20],['10',10],['0',0]]]], [[80,100,'Funcionalidad conservada.'],[50,79,'Requiere asistencia.'],[0,49,'Dependencia marcada.']])),

  // FÓRMULAS
  formula('anion-gap', 'Anion gap', 'Ácido-base', [
    table('Fórmulas', ['Elemento', 'Fórmula / valor'], [
      ['Anion Gap', 'Na⁺ - (Cl⁻ + HCO₃⁻)'],
      ['Valor normal', '8-12 mEq/L'],
      ['Corregido por albúmina', 'AG + 2,5 × (4 - albúmina)']
    ]),
    table('Diferencial', ['Tipo', 'Mnemónico'], [
      ['AG elevado', 'GOLDMARK'],
      ['AG normal hiperclorémico', 'HARDUPS']
    ])
  ], formulaCalc('anion')),

  formula('sodio-corregido', 'Sodio corregido por hiperglucemia', 'Electrolitos', [
    table('Fórmulas', ['Factor', 'Fórmula'], [
      ['1,6', 'Na medido + [1,6 × (glucosa - 100)] / 100'],
      ['2,4', 'Na medido + [2,4 × (glucosa - 100)] / 100']
    ])
  ], formulaCalc('sodium')),

  formula('calcio-corregido', 'Calcio corregido por albúmina', 'Electrolitos', [
    table('Fórmula', ['Elemento', 'Detalle'], [
      ['Ca corregido', 'Ca medido + 0,8 × (4 - albúmina)'],
      ['Valor normal', '8,5-10,5 mg/dL'],
      ['Nota', 'Calcio ionizado es más preciso si está disponible']
    ])
  ], formulaCalc('calcium')),

  formula('osmolaridad', 'Osmolaridad plasmática', 'Electrolitos', [
    table('Fórmulas', ['Cálculo', 'Fórmula'], [
      ['Osm calculada', '2 × Na + glucosa/18 + BUN/2,8'],
      ['Osm efectiva', '2 × Na + glucosa/18'],
      ['Brecha osmolar', 'Osm medida - Osm calculada']
    ])
  ], formulaCalc('osm')),

  formula('deficit-agua', 'Déficit de agua libre', 'Electrolitos', [
    table('Fórmula', ['Elemento', 'Detalle'], [
      ['Déficit', 'ACT × [(Na actual / Na deseado) - 1]'],
      ['ACT hombre joven', '0,6 × peso'],
      ['ACT mujer joven', '0,5 × peso'],
      ['ACT anciano', '0,5 hombre / 0,45 mujer']
    ]),
    note('Precaución', 'Corrección de hipernatremia crónica ≤10-12 mEq/L en 24 h.')
  ], formulaCalc('water')),

  formula('fena', 'FeNa', 'Renal', [
    table('Fórmula', ['Elemento', 'Detalle'], [
      ['FeNa', '[(Na urinario × Cr plasmática) / (Na plasmático × Cr urinaria)] × 100'],
      ['<1%', 'Sugiere prerrenal'],
      ['>2%', 'Sugiere NTA'],
      ['Limitación', 'No confiable con diuréticos recientes o ERC']
    ])
  ], formulaCalc('fena')),

  formula('feurea', 'FeUrea', 'Renal', [
    table('Fórmula', ['Elemento', 'Detalle'], [
      ['FeUrea', '[(Urea urinaria × Cr plasmática) / (Urea plasmática × Cr urinaria)] × 100'],
      ['<35%', 'Azotemia prerrenal'],
      ['>50%', 'NTA'],
      ['Uso', 'Alternativa si se usaron diuréticos']
    ])
  ], formulaCalc('feurea')),

  // CRITERIOS DIAGNÓSTICOS
  criteria('sindrome-metabolico', 'Síndrome metabólico ATP III', 'Metabolismo', 'Requiere ≥3 de 5 criterios.', [
    table('Criterios', ['Criterio', 'Punto de corte'], [
      ['Cintura hombres', '≥102 cm'],
      ['Cintura mujeres', '≥88 cm'],
      ['Triglicéridos', '≥150 mg/dL o tratamiento'],
      ['HDL hombres', '<40 mg/dL'],
      ['HDL mujeres', '<50 mg/dL'],
      ['Presión arterial', '≥130/85 o tratamiento'],
      ['Glucosa ayunas', '≥100 mg/dL o tratamiento']
    ])
  ], pointsCalc([['Cintura aumentada',1],['TG ≥150/tratamiento',1],['HDL bajo/tratamiento',1],['PA ≥130/85/tratamiento',1],['Glucosa ≥100/tratamiento',1]], [[0,2,'No cumple.'],[3,5,'Cumple síndrome metabólico.']])),

  criteria('diabetes', 'Diabetes mellitus ADA', 'Metabolismo', 'Diagnóstico de diabetes y prediabetes.', [
    table('Diabetes', ['Criterio', 'Punto de corte'], [
      ['A1c', '≥6,5%'],
      ['Glucosa ayunas', '≥126 mg/dL'],
      ['PTOG 2 h', '≥200 mg/dL'],
      ['Glucosa aleatoria + síntomas', '≥200 mg/dL']
    ]),
    table('Prediabetes', ['Criterio', 'Punto de corte'], [
      ['A1c', '5,7-6,4%'],
      ['Glucosa ayunas', '100-125 mg/dL'],
      ['PTOG 2 h', '140-199 mg/dL']
    ])
  ], checklistCalc(['A1c','glucosa ayunas','PTOG','glucosa aleatoria + síntomas'])),

  criteria('cad', 'Cetoacidosis diabética', 'Endocrino / urgencias', 'Hiperglucemia + acidosis + cetosis.', [
    table('Diagnóstico', ['Elemento', 'Criterio'], [
      ['Hiperglucemia', 'Glucosa >250 mg/dL; puede ser menor en CAD euglucémica'],
      ['Acidosis', 'pH <7,3 o HCO₃ <18'],
      ['Cetosis', 'Cetonemia o cetonuria moderada-severa']
    ]),
    table('Severidad', ['Grado', 'pH', 'HCO₃', 'Sensorio'], [
      ['Leve', '7,25-7,30', '15-18', 'Alerta'],
      ['Moderada', '7,00-7,24', '10-14', 'Alerta/somnoliento'],
      ['Severa', '<7,00', '<10', 'Estupor/coma']
    ])
  ], checklistCalc(['Hiperglucemia','Acidosis','Cetosis'])),

  criteria('ehh', 'Estado hiperosmolar hiperglucémico', 'Endocrino / urgencias', 'Emergencia hiperglucémica de DM2.', [
    table('Criterios', ['Elemento', 'Criterio'], [
      ['Glucosa', '>600 mg/dL; usualmente >1000'],
      ['Osmolaridad efectiva', '>320 mOsm/kg'],
      ['Acidosis/cetosis', 'pH >7,30, HCO₃ >15, sin cetoacidosis significativa'],
      ['Sensorio', 'Variable, confusión a coma']
    ])
  ], checklistCalc(['Glucosa >600','Osm >320','pH/HCO₃ sin acidosis significativa','alteración sensorio/deshidratación'])),

  criteria('duke', 'Endocarditis infecciosa — Duke', 'Infectología / cardiología', 'Criterios mayores y menores para endocarditis infecciosa.', [
    table('Criterios', ['Tipo', 'Criterio'], [
      ['Mayor', 'Hemocultivos positivos típicos'],
      ['Mayor', 'Evidencia de compromiso endocárdico por eco/imágenes'],
      ['Menor', 'Predisposición'],
      ['Menor', 'Fiebre'],
      ['Menor', 'Fenómenos vasculares'],
      ['Menor', 'Fenómenos inmunológicos'],
      ['Menor', 'Microbiología no mayor']
    ]),
    table('Interpretación clásica', ['Resultado', 'Combinación'], [
      ['Definitiva', '2 mayores, o 1 mayor + 3 menores, o 5 menores'],
      ['Posible', '1 mayor + 1 menor, o 3 menores']
    ])
  ], checklistCalc(['Mayor 1','Mayor 2','menores'])),

  criteria('jones', 'Fiebre reumática — Jones 2015', 'Reumatología / infectología', 'Diagnóstico con evidencia estreptocócica previa.', [
    table('Regla diagnóstica', ['Población', 'Criterios'], [
      ['Bajo riesgo', '2 mayores o 1 mayor + 2 menores'],
      ['Alto riesgo', '2 mayores, 1 mayor + 2 menores, o 3 menores']
    ]),
    table('Evidencia estreptocócica', ['Prueba', 'Criterio'], [
      ['Cultivo o test rápido', 'EGA positivo'],
      ['Serología', 'ASO o anti-DNasa B elevado/en aumento']
    ]),
    table('Criterios mayores', ['Criterio', 'Bajo riesgo', 'Alto riesgo'], [
      ['Carditis', 'Clínica/subclínica', 'Clínica/subclínica'],
      ['Artritis', 'Poliartritis', 'Mono/poliartritis o poliartralgia'],
      ['Corea', 'Sí', 'Sí'],
      ['Eritema marginado', 'Sí', 'Sí'],
      ['Nódulos subcutáneos', 'Sí', 'Sí']
    ])
  ], checklistCalc(['Evidencia EGA','mayores','menores'])),

  criteria('ar', 'Artritis reumatoidea ACR/EULAR 2010', 'Reumatología', 'Clasificación de AR: ≥6/10 en paciente con sinovitis no explicada.', [
    table('Componentes', ['Dominio', 'Categoría', 'Puntos'], [
      ['Articulaciones', '1 grande / 2-10 grandes / 1-3 pequeñas / 4-10 pequeñas / >10 con ≥1 pequeña', '0 / 1 / 2 / 3 / 5'],
      ['Serología', 'FR/anti-CCP negativo / bajo positivo / alto positivo', '0 / 2 / 3'],
      ['Reactantes', 'VSG y PCR normales / VSG o PCR elevada', '0 / 1'],
      ['Duración', '<6 semanas / ≥6 semanas', '0 / 1']
    ]),
    note('Población objetivo', '≥1 articulación con sinovitis clínica definida no explicada por otra enfermedad.')
  ], selectCalc([
    ['Articulaciones', [['1 grande',0],['2-10 grandes',1],['1-3 pequeñas',2],['4-10 pequeñas',3],['>10 con ≥1 pequeña',5]]],
    ['Serología', [['Negativa',0],['Bajo positivo',2],['Alto positivo',3]]],
    ['Reactantes', [['Normales',0],['VSG o PCR elevada',1]]],
    ['Duración', [['<6 semanas',0],['≥6 semanas',1]]]
  ], [[0,5,'No clasifica.'],[6,10,'Clasifica AR si cumple población objetivo.']])),

  criteria('lupus', 'Lupus EULAR/ACR 2019', 'Reumatología', 'ANA ≥1:80 como criterio de entrada; clasificación ≥10 puntos.', [
    table('Entrada', ['Criterio', 'Requisito'], [
      ['ANA', '≥1:80 en HEp-2 o equivalente'],
      ['Clasificación', '≥10 puntos + ≥1 criterio clínico + sin mejor explicación']
    ]),
    table('Dominios seleccionados', ['Dominio', 'Manifestación', 'Puntos'], [
      ['Constitucional', 'Fiebre', '2'],
      ['Hematológico', 'Leucopenia / trombocitopenia / hemólisis autoinmune', '3 / 4 / 4'],
      ['Neuropsiquiátrico', 'Delirio / psicosis / convulsiones', '2 / 3 / 5'],
      ['Mucocutáneo', 'Alopecia/úlceras/lupus subagudo o discoide/lupus agudo', '2 / 2 / 4 / 6'],
      ['Renal', 'Proteinuria / biopsia II-V / biopsia III-IV', '4 / 8 / 10'],
      ['Inmunológico', 'Antifosfolípidos / complemento bajo / anti-dsDNA o anti-Sm', '2 / 3-4 / 6']
    ])
  ], checklistCalc(['ANA entrada','criterios clínicos','criterios inmunológicos'])),

  criteria('pancreatitis-atlanta', 'Pancreatitis aguda — Atlanta', 'Gastroenterología', 'Diagnóstico con 2 de 3 criterios.', [
    table('Criterios diagnósticos', ['Criterio', 'Detalle'], [
      ['Dolor típico', 'Dolor abdominal compatible'],
      ['Enzimas', 'Amilasa o lipasa ≥3× LSN'],
      ['Imagen', 'Hallazgos compatibles']
    ])
  ], pointsCalc([['Dolor típico',1],['Enzimas ≥3×',1],['Imagen compatible',1]], [[0,1,'No cumple.'],[2,3,'Cumple criterios diagnósticos.']])),

  criteria('depresion', 'Depresión mayor — DSM orientativo', 'Psiquiatría', '≥5 síntomas por ≥2 semanas, con ánimo deprimido o anhedonia.', [
    table('Requisitos', ['Elemento', 'Detalle'], [
      ['Duración', '≥2 semanas'],
      ['Cantidad', '≥5 síntomas'],
      ['Cardinal', 'Ánimo deprimido o anhedonia'],
      ['Impacto', 'Malestar o deterioro funcional'],
      ['Exclusiones', 'Sustancias, enfermedad médica, bipolaridad/manía, duelo según contexto']
    ]),
    table('Síntomas', ['Síntoma', 'Cuenta'], [
      ['Ánimo deprimido', 'Cardinal'],
      ['Anhedonia', 'Cardinal'],
      ['Peso/apetito', 'Sí'],
      ['Sueño', 'Sí'],
      ['Psicomotor', 'Sí'],
      ['Fatiga', 'Sí'],
      ['Culpa/inutilidad', 'Sí'],
      ['Concentración', 'Sí'],
      ['Muerte/suicidio', 'Sí']
    ])
  ], checklistCalc(['Síntomas','duración','cardinal','deterioro','exclusiones']))
];

function lab(id, title, category, use, sections) { return { id, tab:'lab', title, category, use, sections, calculator: null }; }
function score(id, title, category, use, sections, calculator) { return { id, tab:'scores', title, category, use, sections, calculator }; }
function formula(id, title, category, sections, calculator) { return { id, tab:'formulas', title, category, use:'Fórmula clínica.', sections, calculator }; }
function criteria(id, title, category, use, sections) { return { id, tab:'criteria', title, category, use, sections, calculator: null }; }
function table(title, columns, rows) { return { type:'table', title, columns, rows }; }
function note(title, text) { return { type:'note', title, text }; }
function pointsCalc(items, ranges) { return { type:'points', items, ranges }; }
function selectCalc(selects, ranges) { return { type:'select', selects, ranges }; }
function checklistCalc(items) { return { type:'checklist', items }; }
function formulaCalc(formula) { return { type:'formula', formula }; }
function customGoldCalc() { return { type:'formula', formula:'gold' }; }
function customKdigoCalc() { return { type:'formula', formula:'kdigo' }; }
