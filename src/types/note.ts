export type Locale = "ja" | "en";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  locale?: Locale;
};
