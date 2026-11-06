export {
  calculateNutrients,
  gramsSchema,
  nutrientsPer100gSchema,
  sumNutrients,
  type Nutrients,
} from './nutrition/nutrients.js';
export {
  ACTIVITY_LEVELS,
  MIFFLIN_VARIANTS,
  activityLevelSchema,
  calculateAge,
  calculateBmr,
  calculateNutritionGoals,
  calculateTdee,
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
