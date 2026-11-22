// fdcId = null → valores de referencia propios por 100 g (sal en gramos), orientativos.
export const category = 'Bebidas';

export const foods = [
  ['Agua', 174158, [['1 vaso', 200], ['1 botella', 500]]],
  ['Café solo', 171890, [['1 taza', 60], ['1 taza grande', 200]]],
  ['Té negro', 173227, [['1 taza', 240]]],
  ['Té verde', 171917, [['1 taza', 240]]],
  ['Café con leche', null, [['1 taza', 200]], { kcal: 32, protein: 1.7, carbs: 2.5, fat: 1.7, fiber: 0, sugars: 2.5, salt: 0.05 }],
  ['Cerveza', 168746, [['1 caña', 200], ['1 botellín', 330], ['1 lata', 330]]],
  ['Cerveza sin alcohol', null, [['1 botellín', 330]], { kcal: 22, protein: 0.3, carbs: 5, fat: 0, fiber: 0, sugars: 3, salt: 0.01 }],
  ['Vino tinto', 173190, [['1 copa', 150]]],
  ['Vino blanco', 174837, [['1 copa', 150]]],
  ['Licor destilado (ginebra, ron, vodka, whisky)', 174815, [['1 chupito', 40], ['1 copa', 50]]],
  ['Zumo de naranja natural', 169098, [['1 vaso', 200]]],
  ['Zumo de manzana', 167771, [['1 vaso', 200]]],
  ['Néctar de naranja', 169044, [['1 vaso', 200]]],
  ['Refresco de cola', null, [['1 lata', 330], ['1 vaso', 200]], { kcal: 42, protein: 0, carbs: 10.6, fat: 0, fiber: 0, sugars: 10.6, salt: 0.02 }],
  ['Refresco de cola sin azúcar', 175099, [['1 lata', 330]]],
  ['Refresco de naranja o limón', null, [['1 lata', 330]], { kcal: 40, protein: 0, carbs: 10, fat: 0, fiber: 0, sugars: 10, salt: 0.03 }],
  ['Bebida energética', 174171, [['1 lata', 250]]],
  ['Bebida isotónica', null, [['1 botella', 500]], { kcal: 26, protein: 0, carbs: 6.4, fat: 0, fiber: 0, sugars: 6, salt: 0.1 }],
  ['Bebida de soja', 172446, [['1 vaso', 200]]],
  ['Bebida de almendra sin azúcar', 174832, [['1 vaso', 200]]],
  ['Bebida de avena', null, [['1 vaso', 200]], { kcal: 45, protein: 1, carbs: 7, fat: 1.5, fiber: 0.8, sugars: 4, salt: 0.1 }],
  ['Cacao soluble (en polvo)', 174122, [['1 cucharada', 15], ['2 cucharadas', 30]]],
  ['Cacao puro en polvo', 169593, [['1 cucharada', 6]]],
];
