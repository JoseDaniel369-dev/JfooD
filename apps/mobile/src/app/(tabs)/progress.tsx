import { useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { useAchievements } from '@/features/achievements/useAchievements';
import { AchievementsSection } from '@/features/progress/components/AchievementsSection';
import { CaloriesSection } from '@/features/progress/components/CaloriesSection';
import { MacrosSection } from '@/features/progress/components/MacrosSection';
import { WeightSection } from '@/features/progress/components/WeightSection';

const SECTIONS = [
  { value: 'weight', label: 'Peso' },
  { value: 'calories', label: 'Calorías' },
  { value: 'macros', label: 'Macros' },
  { value: 'achievements', label: 'Logros' },
] as const;

type Section = (typeof SECTIONS)[number]['value'];

export default function ProgressScreen() {
  const [section, setSection] = useState<Section>('weight');
  const { achievements } = useAchievements();
  const scrollRef = useRef<ScrollViewInstance>(null);

  return (
    <Screen scrollRef={scrollRef}>
      <ScreenHeader subtitle="Peso, calorías, macros y logros" title="Tu progreso" />

      <Segmented
        accessibilityLabel="Sección de progreso"
        onChange={setSection}
        options={SECTIONS}
        value={section}
      />

      {section === 'weight' ? (
        <WeightSection scrollTo={(y) => scrollRef.current?.scrollTo({ y, animated: true })} />
      ) : null}
      {section === 'calories' ? <CaloriesSection /> : null}
      {section === 'macros' ? <MacrosSection /> : null}
      {section === 'achievements' ? <AchievementsSection achievements={achievements} /> : null}
    </Screen>
  );
}
