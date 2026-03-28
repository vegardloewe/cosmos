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

export interface VaultIndex {
  version: number;
  items: BoardItem[];
  collections: Collection[];
}
