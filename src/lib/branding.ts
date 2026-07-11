/** Single source of truth for the system's official branding — every screen (header, sidebar,
 * login, About, README, SETUP) reads from here so a future rename or version bump only needs
 * to happen in one place. */

export const APP_NAME = "ChildPsychHR";
export const APP_SUBTITLE = "מערכת ניהול כוח אדם ותקינה";
export const APP_DEPARTMENT = "אגף פסיכיאטריה ילדים ונוער";

export const APP_VERSION = "v1.0.0";
export const APP_VERSION_DATE = "09.07.2026";

export const APP_DESCRIPTION =
  "ChildPsychHR מרכזת את ניהול התקנים, העובדים והשיבוצים באגף — במקום גיליון אקסל ידני " +
  "ומתעדכן-ידנית, המערכת שומרת היסטוריה מלאה של כל שינוי, מחשבת תקנים פנויים ותקציב אוטומטית, " +
  "ומציגה למנהל האגף מרכז שליטה יומי עם המשימות וההתראות שדורשות תשומת לב.";

export type ReleaseNote = { version: string; date: string; notes: string[] };

/** Newest first. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "v1.0.0",
    date: APP_VERSION_DATE,
    notes: [
      "מיתוג רשמי של המערכת בשם ChildPsychHR",
      "מרכז שליטה ניהולי: משימות לטיפול, התראות קריטיות, תנועת כוח אדם, מגמות ותובנות",
      "ארכיטקטורת תקן / עובד / שיבוץ נפרדת, עם היסטוריה מלאה ויומן שינויים לכל רשומה",
      "גיבוי ושחזור מלא של המערכת (קובץ JSON וקובץ Excel רב-גיליונות)",
      "הגדרות מערכת ניתנות לשינוי, הרשאות לפי תפקיד (מנהל / עורך / צפייה), ומסך דוחות",
    ],
  },
];
