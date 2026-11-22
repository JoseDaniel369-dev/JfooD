import { normalizeName } from '@/features/foods/utils/normalize';

export const DEFAULT_FOOD_EMOJI = '🍽️';

/**
 * Keyword → emoji. Keywords are written already normalized (lowercase, no
 * accents). The FIRST rule that matches wins, so specific phrases go before
 * generic ones ("leche de almendra" before "leche").
 */
const RULES: readonly (readonly [emoji: string, keywords: readonly string[]])[] = [
  // Must come before potatoes.
  ['🍟', ['patatas fritas', 'papas fritas']],
  // Drinks
  ['🥛', ['leche de almendra', 'leche de avena', 'leche de soja', 'bebida vegetal', 'leche', 'yogur', 'yogurt', 'kefir', 'batido']],
  ['☕', ['cafe', 'capuchino', 'cappuccino', 'espresso', 'cortado']],
  ['🍵', ['te verde', 'infusion', 'manzanilla', 'te ']],
  ['🍺', ['cerveza']],
  ['🍷', ['vino']],
  ['🧃', ['zumo', 'jugo']],
  ['🥤', ['refresco', 'cola', 'bebida']],
  ['💧', ['agua ']],
  // Fruit
  ['🍎', ['manzana']],
  ['🍌', ['platano', 'banana']],
  ['🍊', ['naranja', 'mandarina', 'clementina', 'pomelo']],
  ['🍋', ['limon', 'lima']],
  ['🍇', ['uva', 'pasa']],
  ['🍓', ['fresa', 'fresón', 'freson', 'frambuesa', 'arandano', 'mora']],
  ['🍉', ['sandia']],
  ['🍈', ['melon']],
  ['🍑', ['melocoton', 'nectarina', 'albaricoque', 'ciruela']],
  ['🍐', ['pera']],
  ['🍍', ['pina']],
  ['🥭', ['mango', 'papaya']],
  ['🥝', ['kiwi']],
  ['🍒', ['cereza', 'guinda']],
  ['🥥', ['coco']],
  ['🥑', ['aguacate']],
  ['🫒', ['aceite', 'aceituna', 'oliva']],
  // Vegetables
  ['🍅', ['tomate', 'gazpacho', 'salmorejo']],
  ['🥕', ['zanahoria']],
  ['🥔', ['patata', 'papa', 'tortilla de patata']],
  ['🍠', ['boniato', 'batata']],
  ['🌽', ['maiz']],
  ['🥦', ['brocoli', 'coliflor']],
  ['🥬', ['lechuga', 'espinaca', 'acelga', 'rucula', 'canonigo', 'col ', 'repollo']],
  ['🥒', ['pepino', 'calabacin', 'pepinillo']],
  ['🍆', ['berenjena']],
  ['🫑', ['pimiento']],
  ['🧅', ['cebolla', 'puerro']],
  ['🧄', ['ajo']],
  ['🍄', ['champinon', 'seta', 'hongo']],
  ['🥗', ['ensalada']],
  ['🫛', ['guisante', 'judia verde', 'haba', 'edamame']],
  ['🫘', ['lenteja', 'garbanzo', 'alubia', 'judia', 'frijol', 'soja']],
  // Protein
  ['🥚', ['huevo', 'tortilla francesa', 'clara']],
  ['🍗', ['pollo', 'pavo', 'pechuga', 'muslo']],
  ['🥩', ['ternera', 'vaca', 'solomillo', 'filete', 'cerdo', 'lomo', 'cordero', 'chuleta', 'carne']],
  ['🥓', ['bacon', 'beicon', 'panceta', 'tocino']],
  ['🍖', ['costilla', 'jamon', 'chorizo', 'salchichon', 'fuet', 'embutido', 'morcilla']],
  ['🌭', ['salchicha', 'hot dog', 'frankfurt']],
  ['🐟', ['salmon', 'atun', 'merluza', 'bacalao', 'pescado', 'sardina', 'caballa', 'trucha', 'lubina', 'dorada', 'boqueron', 'anchoa']],
  ['🍤', ['gamba', 'langostino', 'camaron']],
  ['🦐', ['marisco', 'mejillon', 'almeja', 'calamar', 'pulpo', 'sepia']],
  ['🧀', ['queso', 'requeson', 'mozzarella', 'parmesano']],
  ['🥜', ['cacahuete', 'almendra', 'nuez', 'avellana', 'pistacho', 'anacardo', 'frutos secos', 'mantequilla de cacahuete']],
  // Grains
  ['🍞', ['pan', 'tostada', 'baguette', 'barra de pan', 'molde']],
  ['🥐', ['croissant', 'bollo', 'napolitana', 'ensaimada']],
  ['🥞', ['tortita', 'crepe', 'pancake']],
  ['🍚', ['arroz', 'paella']],
  ['🍝', ['pasta', 'espagueti', 'macarron', 'fideo', 'tallarin', 'lasana', 'ravioli']],
  ['🥣', ['avena', 'cereales', 'muesli', 'copos', 'gachas']],
  ['🥨', ['galleta', 'pretzel', 'cracker', 'tortita de arroz']],
  ['🌮', ['taco', 'burrito', 'tortilla de maiz', 'wrap']],
  // Prepared
  ['🍕', ['pizza']],
  ['🍔', ['hamburguesa']],
  ['🥪', ['bocadillo', 'sandwich', 'emparedado', 'tosta']],
  ['🍲', ['sopa', 'caldo', 'cocido', 'guiso', 'estofado', 'crema de', 'potaje', 'fabada']],
  ['🍣', ['sushi']],
  // Sweet & extras
  ['🍫', ['chocolate', 'cacao', 'nutella']],
  ['🍰', ['tarta', 'pastel', 'bizcocho', 'magdalena', 'brownie']],
  ['🍩', ['donut', 'rosquilla', 'dona']],
  ['🍦', ['helado']],
  ['🍬', ['caramelo', 'gominola', 'chicle', 'azucar']],
  ['🍯', ['miel', 'mermelada', 'sirope']],
  ['🧈', ['mantequilla', 'margarina']],
  ['🧂', ['sal ', 'salsa', 'mayonesa', 'ketchup', 'mostaza', 'vinagre']],
  ['🥫', ['conserva', 'lata']],
  ['🧆', ['hummus', 'falafel', 'croqueta']],
  ['🍮', ['flan', 'natillas', 'postre']],
  ['💪', ['proteina', 'whey', 'suplemento']],
];

/**
 * A keyword matches at the start of a word, so "pan" matches "pan integral"
 * but not "campana". One with a trailing space must also END the word
 * ("agua " matches "agua" but not "aguacate").
 */
function keywordPattern(keyword: string): string {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return keyword.endsWith(' ') ? `${escaped}(?= )` : escaped;
}

const PREPARED: readonly (readonly [string, RegExp])[] = RULES.map(([emoji, keywords]) => [
  emoji,
  new RegExp(`(?:^| )(?:${keywords.map(keywordPattern).join('|')})`),
]);

/** Emoji that best represents a food, by its name. Falls back to a plate. */
export function foodEmoji(name: string): string {
  const normalized = normalizeName(name);
  if (normalized === '') {
    return DEFAULT_FOOD_EMOJI;
  }
  // The padding lets keywords such as "te " or "col " (which need a word
  // boundary on the right) match at the end of the name too.
  const padded = `${normalized} `;
  for (const [emoji, pattern] of PREPARED) {
    if (pattern.test(padded)) {
      return emoji;
    }
  }
  return DEFAULT_FOOD_EMOJI;
}
