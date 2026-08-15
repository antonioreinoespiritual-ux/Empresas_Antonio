import type { Asset, AssetKind } from "../../../domain";
import type { CursorPaginationInput, PaginatedResult } from "../../shared/paginated-result";

export interface CreateAssetInput {
  kind: AssetKind;
  url: string;
  width: number | null;
  height: number | null;
  altText: string;
  provider: string;
}

export interface AssetRepository {
  create(input: CreateAssetInput): Promise<Asset>;
  findById(assetId: string): Promise<Asset | null>;
  /** Resolución en lote para el renderer — assetIds referenciados por una Composition, en un solo roundtrip. */
  findByIds(assetIds: string[]): Promise<Asset[]>;
  list(input: CursorPaginationInput): Promise<PaginatedResult<Asset>>;
}
