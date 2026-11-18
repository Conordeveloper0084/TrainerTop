// Post yaratish sahifasi qoidalari (Android/iOS bilan bir xil; server limitlari POST /api/posts bilan mos)
export const MAX_POST_IMAGES = 5;
export const MAX_CAPTION = 2000;
export const CAPTION_MIN_ROWS = 5;
export const CAPTION_MAX_ROWS = 12;
// Matn maydoni balandligi: 5…12 qator, matndagi qatorlar soniga qarab o'sadi (12 dan keyin ichida skroll)
export const captionRows = (text: string) => Math.min(CAPTION_MAX_ROWS, Math.max(CAPTION_MIN_ROWS, text.split("\n").length + 1));
// "Joylash" — matn YOKI media bo'lsa (faqat matnli post ham joylanadi); yuklash/tekshirish paytida emas
export const canSubmitPost = (caption: string, hasMedia: boolean, busy: boolean) => !busy && (caption.trim().length > 0 || hasMedia);
