/**
 * プロビナンス（データ来歴）管理システム
 * 全データにソース・作成方法・ライセンス情報を付与
 */

export interface ProvenanceMetadata {
  source: string;           // データソース識別子
  license: string;          // ライセンス情報
  created_by: string;       // 作成者・システム
  created_at: string;       // 作成日時（ISO 8601）
  method: string;           // 算出・取得方法
  version?: string;         // データバージョン
  dependencies?: string[];  // 依存データソース
}

export interface ProvenanceData<T = any> {
  data: T;
  provenance: ProvenanceMetadata;
}

/**
 * NPB公式データのプロビナンス情報
 */
export const NPB_OFFICIAL_PROVENANCE: Partial<ProvenanceMetadata> = {
  source: "npb_official_html",
  license: "public_stats_analysis_only",
  created_by: "baseball-ai-media/npb-parser",
  method: "html_scraping_with_rate_limit"
};

/**
 * 独自算出統計のプロビナンス情報
 */
export const CALCULATED_STATS_PROVENANCE: Partial<ProvenanceMetadata> = {
  source: "calculated_from_npb_official",
  license: "CC-BY-SA-4.0",
  created_by: "baseball-ai-media/stats-engine",
  method: "sabermetric_formulas_independent_implementation"
};

/**
 * データにプロビナンス情報を付与
 */
export function addProvenance<T>(
  data: T, 
  baseProvenance: Partial<ProvenanceMetadata>,
  additionalInfo?: Partial<ProvenanceMetadata>
): ProvenanceData<T> {
  const now = new Date().toISOString();
  
  const provenance: ProvenanceMetadata = {
    source: "unknown",
    license: "all_rights_reserved", 
    created_by: "baseball-ai-media",
    created_at: now,
    method: "unknown",
    ...baseProvenance,
    ...additionalInfo
  };

  return {
    data,
    provenance
  };
}

/**
 * NPB公式データ用のプロビナンス付与
 */
export function addNPBProvenance<T>(
  data: T,
  method: string,
  additionalInfo?: Partial<ProvenanceMetadata>
): ProvenanceData<T> {
  return addProvenance(data, NPB_OFFICIAL_PROVENANCE, {
    method,
    ...additionalInfo
  });
}

/**
 * 算出統計用のプロビナンス付与
 */
export function addCalculatedProvenance<T>(
  data: T,
  method: string,
  dependencies: string[] = [],
  additionalInfo?: Partial<ProvenanceMetadata>
): ProvenanceData<T> {
  return addProvenance(data, CALCULATED_STATS_PROVENANCE, {
    method,
    dependencies,
    ...additionalInfo
  });
}

/**
 * 第三者データソースの検出・ブロック
 */
export function isThirdPartySource(provenance: ProvenanceMetadata): boolean {
  const blockedSources = [
    "1point02",
    "delta_graph", 
    "baseball_lab",
    "baseball_savant_copy",
    // 他の第三者データベース識別子を追加
  ];
  
  return blockedSources.some(blocked => 
    provenance.source.toLowerCase().includes(blocked.toLowerCase())
  );
}

/**
 * データパイプライン用のソースガード
 */
export function validateDataSource<T>(data: ProvenanceData<T>): boolean {
  // 第三者データソースを弾く
  if (isThirdPartySource(data.provenance)) {
    console.warn(`Blocked third-party source: ${data.provenance.source}`);
    return false;
  }
  
  // 必須フィールドの検証
  const required = ['source', 'created_by', 'method'] as const;
  for (const field of required) {
    if (!data.provenance[field]) {
      console.warn(`Missing required provenance field: ${field}`);
      return false;
    }
  }
  
  return true;
}

/**
 * プロビナンス情報のサマリー生成
 */
export function getProvenanceSummary(provenance: ProvenanceMetadata): string {
  const parts = [
    `Source: ${provenance.source}`,
    `Method: ${provenance.method}`, 
    `Created: ${new Date(provenance.created_at).toLocaleDateString('ja-JP')}`
  ];
  
  if (provenance.dependencies?.length) {
    parts.push(`Dependencies: ${provenance.dependencies.join(', ')}`);
  }
  
  return parts.join(' | ');
}

/**
 * 監査用: プロビナンス情報の検証
 */
export function auditProvenance(data: ProvenanceData<any>[]): {
  valid: ProvenanceData<any>[];
  invalid: { data: ProvenanceData<any>; reason: string }[];
  summary: {
    total: number;
    valid: number;
    sources: Record<string, number>;
    methods: Record<string, number>;
  };
} {
  const valid: ProvenanceData<any>[] = [];
  const invalid: { data: ProvenanceData<any>; reason: string }[] = [];
  const sources: Record<string, number> = {};
  const methods: Record<string, number> = {};
  
  for (const item of data) {
    if (validateDataSource(item)) {
      valid.push(item);
      sources[item.provenance.source] = (sources[item.provenance.source] || 0) + 1;
      methods[item.provenance.method] = (methods[item.provenance.method] || 0) + 1;
    } else {
      invalid.push({
        data: item,
        reason: isThirdPartySource(item.provenance) ? 'Third-party source blocked' : 'Missing required fields'
      });
    }
  }
  
  return {
    valid,
    invalid,
    summary: {
      total: data.length,
      valid: valid.length,
      sources,
      methods
    }
  };
}