/** Content lives in driver.{ru,kz}.json; this file only defines lesson structure and answer keys. */
export const DRIVER_LESSONS = [
  { id: 'seizure', cards: 5, answers: [1, 0, 2] },
  { id: 'sensory', cards: 5, answers: [0, 2, 1] },
  { id: 'wheelchair', cards: 5, answers: [2, 1, 0] },
] as const;
export type DriverLesson = typeof DRIVER_LESSONS[number];
export type DriverLessonId = DriverLesson['id'];
export function readLessons(driverId: string): DriverLessonId[] {
  try {
    const stored = JSON.parse(localStorage.getItem('demeu.driverLessons') ?? 'null');
    if (stored?.driverId !== driverId || !Array.isArray(stored.completed)) return [];
    return DRIVER_LESSONS.filter(lesson => stored.completed.includes(lesson.id)).map(lesson => lesson.id);
  } catch { return []; }
}
export function saveLessons(driverId: string, completed: DriverLessonId[]) {
  try { localStorage.setItem('demeu.driverLessons', JSON.stringify({ driverId, completed })); } catch { /* Progress still works in memory. */ }
}
