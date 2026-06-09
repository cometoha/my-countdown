import provinces from 'china-division/dist/provinces.json';
import cities from 'china-division/dist/cities.json';
import areas from 'china-division/dist/areas.json';

export type RegionLevel = 1 | 2 | 3;

export interface RegionNode {
  code: string;
  name: string;
  level: RegionLevel;
  parentCode: string | null;
  hasChildren: boolean;
}

export interface RegionPath {
  nodes: RegionNode[];
  code: string;
  displayPath: string;
}

const pad12 = (c: string): string => (c + '000000000000').slice(0, 12);

// 直辖市列表
const MUNICIPALITIES = new Set(['110000', '120000', '310000', '500000']);

let _allNodes: RegionNode[] | null = null;

function getAllNodes(): RegionNode[] {
  if (_allNodes) return _allNodes;

  const cityP = new Set(cities.map(c => c.provinceCode));
  const areaC = new Set(areas.map(a => a.cityCode));

  _allNodes = [
    ...provinces.map(p => ({
      code: pad12(p.code),
      name: p.name,
      level: 1 as const,
      parentCode: null,
      hasChildren: cityP.has(p.code),
    })),
    ...cities.map(c => ({
      code: pad12(c.code),
      name: c.name,
      level: 2 as const,
      parentCode: pad12(c.provinceCode),
      hasChildren: areaC.has(c.code),
    })),
    ...areas.map(a => ({
      code: pad12(a.code),
      name: a.name,
      level: 3 as const,
      parentCode: pad12(a.cityCode),
      hasChildren: false,
    })),
  ];

  return _allNodes;
}

const nodeMap = (): Map<string, RegionNode> => {
  const map = new Map<string, RegionNode>();
  for (const n of getAllNodes()) {
    map.set(n.code, n);
  }
  return map;
};

// 缓存 nodeMap
let _nodeMap: Map<string, RegionNode> | null = null;
function getNodeMap(): Map<string, RegionNode> {
  if (_nodeMap) return _nodeMap;
  _nodeMap = nodeMap();
  return _nodeMap;
}

/** 获取省份列表 */
export function listProvinces(): RegionNode[] {
  return getAllNodes().filter(n => n.level === 1);
}

/** 获取某省下的城市列表 */
export function listCities(provinceCode: string): RegionNode[] {
  const padded = pad12(provinceCode);
  return getAllNodes().filter(n => n.level === 2 && n.parentCode === padded);
}

/** 获取某城市下的区县列表 */
export function listDistricts(cityCode: string): RegionNode[] {
  const padded = pad12(cityCode);
  return getAllNodes().filter(n => n.level === 3 && n.parentCode === padded);
}

/** 根据 code 获取子节点 */
export function listChildren(parentCode: string | null): RegionNode[] {
  if (!parentCode) return listProvinces();
  const padded = pad12(parentCode);
  const parent = getNodeMap().get(padded);
  if (!parent) return [];
  if (parent.level === 1) {
    // 直辖市跳过"市辖区"，直接返回区
    if (MUNICIPALITIES.has(padded.slice(0, 6))) {
      const cityNodes = listCities(padded);
      if (cityNodes.length === 1 && cityNodes[0].name === '市辖区') {
        return listDistricts(cityNodes[0].code);
      }
    }
    return listCities(padded);
  }
  if (parent.level === 2) return listDistricts(padded);
  return [];
}

/** 解析完整路径 */
export function resolvePath(code: string): RegionPath {
  const padded = pad12(code);
  const nodes: RegionNode[] = [];
  let current: RegionNode | undefined = getNodeMap().get(padded);
  while (current) {
    nodes.unshift(current);
    current = current.parentCode ? getNodeMap().get(current.parentCode) : undefined;
  }
  return {
    nodes,
    code: padded,
    displayPath: nodes.map(n => n.name).join(' / '),
  };
}

/** 搜索（省份/城市/区县名模糊匹配） */
export function searchRegion(query: string, limit = 10): RegionPath[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: RegionNode[] = [];
  for (const n of getAllNodes()) {
    if (n.name.toLowerCase().includes(q)) {
      results.push(n);
    }
    if (results.length >= limit) break;
  }
  return results.map(n => resolvePath(n.code));
}

/** 判断是否是直辖市 */
export function isMunicipality(code: string): boolean {
  return MUNICIPALITIES.has(pad12(code).slice(0, 6));
}
