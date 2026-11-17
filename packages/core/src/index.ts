export {
  FOOD_INPUT_LIMITS,
  calculateNutrients,
  foodInputNutrientsSchema,
  gramsSchema,
  nutrientsPer100gSchema,
  sumNutrients,
  sumNutrientsKnown,
  type Nutrients,
  type PartialNutrient,
  type PartialNutrients,
} from './nutrition/nutrients.js';
export {
  ACTIVITY_LEVELS,
  MIFFLIN_VARIANTS,
  activityLevelSchema,
  calculateAge,
  calculateBmr,
  calculateNutritionGoals,
  calculateTdee,
  MIN_DAILY_CALORIES_KCAL,
  PROFILE_LIMITS,
  mifflinVariantSchema,
  userProfileSchema,
  type ActivityLevel,
  type MifflinVariant,
  type NutritionGoals,
  type UserProfile,
} from './nutrition/goals.js';
export {
  foodRecognitionSchema,
  recognizedFoodSchema,
  type FoodRecognition,
  type RecognizedFood,
} from './schemas/recognition.js';
export {
  BMI_CATEGORY_LABELS,
  computeBmi,
  type BmiCategory,
  type BmiResult,
} from './nutrition/bmi.js';
