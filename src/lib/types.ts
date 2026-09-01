export type Category = {
  id: string;
  name: string;
  color: string;
  _count?: { documents: number };
};

export type DocumentItem = {
  id: string;
  title: string;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  autoNamed: boolean;
  createdAt: string;
  updatedAt: string;
  categoryId: string | null;
  category: Category | null;
};
