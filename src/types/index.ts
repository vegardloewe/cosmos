export type ItemType = "image" | "video" | "link" | "text";

export interface Collection {
  id: string;
  name: string;
  color: string;
}

export interface BoardItem {
  id: string;
  type: ItemType;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  collectionIds: string[];
  color?: string;
  // image/video
  assetPath?: string;
  width?: number;
  height?: number;
  // link
  url?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkPreviewPath?: string;
  // text
  notePath?: string;
  title?: string;
  excerpt?: string;
}

export type BookStatus = "reading" | "read" | "want";

export interface Book {
  id: string;
  title: string;
  author?: string;
  coverPath?: string;
  status: BookStatus;
  yearRead?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookSearchResult {
  title: string;
  author?: string;
  coverUrl?: string;
  firstPublishYear?: number;
}

export interface VaultIndex {
  version: number;
  items: BoardItem[];
  collections: Collection[];
  books?: Book[];
}
