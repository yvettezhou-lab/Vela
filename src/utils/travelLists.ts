import type { Trip, TripList, ListItem } from '../core/domain';

const now = () => Date.now();
const id = () => crypto.randomUUID();

export type TravelListTemplate = {
  id: string;
  name: string;
  description: string;
  items: string[];
};

const GENERAL_TRAVEL_ITEMS = [
  '衣服', '裤子', '内衣', '一次性内裤', '袜子', '马桶垫',
  '头灯', '手电', '脚架',
  '洗漱包',
  '洗发水', '洗面奶', '护发素', '沐浴露',
  '牙刷', '牙膏', '漱口用品', '梳子', '发圈 / 发夹',
  '卸妆 / 防晒清洁用品',
  '插线板', '手表充电器', '手机充电器', '充电宝', '灭蚊器',
];

const DOMESTIC_ITEMS = [
  '身份证', '手机', '充电器', '充电宝', '数据线', '银行卡 / 钱包', '少量现金',
  '机票 / 车票', '酒店订单 / 行程单', '换洗衣物', '内衣裤', '袜子', '睡衣',
  '衣服', '裤子', '内衣', '一次性内裤', '鞋', '洗漱用品',
  '护肤品', '防晒', '雨伞 / 雨衣', '眼镜 / 隐形眼镜', '耳机', '水杯',
  '纸巾 / 湿巾', '垃圾袋', '常用药', '药', '小型急救包',
  '马桶垫', '头灯', '手电', '脚架', '插线板', '手表充电器', '手机充电器', '灭蚊器',
];

const INTERNATIONAL_ITEMS = [
  '护照', '签证 / 入境材料', '机票 / 行程单', '行程单', '酒店订单', '旅行保险',
  '身份证', '兴业卡', '手机', '充电器', '充电宝', '数据线', '银行卡 / 钱包', '少量当地现金',
  '换洗衣物', '内衣裤', '袜子', '睡衣', '衣服', '裤子', '内衣', '一次性内裤',
  '鞋', '洗漱用品', '护肤品', '防晒',
  '转换插头', '插线板', '耳机', '水杯', '行李牌', '备用证件复印件',
  '马桶垫', '头灯', '手电', '脚架', '手表充电器', '手机充电器', '灭蚊器',
  '常用药', '药', '小型急救包', '单山蘸水',
];

const DAILY_ITEMS = [
  '手机', '钱包 / 银行卡', '身份证 / 护照', '钥匙', '充电宝', '数据线',
  '纸巾', '湿巾', '水杯', '墨镜', '防晒', '雨伞 / 雨衣', '耳机',
];

const MEDICINE_ITEMS = [
  '个人长期用药', '备用药量', '常用外用药', '创可贴', '消毒用品',
  '体温计', '口罩', '药品说明 / 处方', '药品收纳袋', '防蚊 / 止痒用品',
];

const BEACH_ITEMS = [
  '泳衣 × 2', '泳镜', '沙滩鞋 / 涉水鞋', '冲浪衣', '人字拖 / 凉鞋', '泳衣外搭 / 防晒衣',
  '沙滩巾 / 速干毛巾', '速干毛巾', '防水手机袋', '手机防水壳', '防水袋 / Dry Bag',
  '沙滩包 / 小背包', '高倍防晒', '防晒唇膏', '太阳镜', '遮阳帽', '晒后修护', '驱蚊用品',
  '防水创可贴', '湿衣袋 / 脏衣袋', '可折叠水杯', '浮球', '浮潜', '浮潜装备（如需要）',
  '水下相机 / 运动相机', '相机防水壳', '防水收纳袋', '轻薄外套（空调 / 晚间）',
];

const HIKING_ITEMS = [
  '徒步鞋 / 越野鞋', '备用袜子', '速干衣', '运动裤 / 徒步裤', '防风外套',
  '雨衣 / 冲锋衣', '保暖中层', '遮阳帽', '太阳镜', '防晒',
  '双肩背包', '水壶 / 水袋', '能量补给', '头灯', '登山杖',
  '纸质地图 / 离线地图', '手机 / GPS', '充电宝', '小型急救包',
  '创可贴 / 防磨脚贴', '驱蚊用品', '垃圾袋', '保温毯 / 应急毯',
  '个人常用药', '身份证 / 证件', '雨罩 / 防水袋',
];

const HOT_SPRING_ITEMS = [
  '泳衣', '泳帽（如需要）', '拖鞋', '防滑涉水鞋', '浴巾 / 速干毛巾',
  '换洗内衣裤', '干湿分离袋', '防水手机袋', '洗漱用品', '护肤品',
  '身体乳', '护发用品', '防水眼镜盒', '个人常用药', '饮水杯',
  '保温外套 / 轻薄外套', '密封袋 / 脏衣袋',
];

const CITY_ITEMS = [
  '舒适步行鞋', '备用袜子', '轻便日常包', '雨伞 / 雨衣', '墨镜', '防晒',
  '轻薄外套', '稍正式服装（如需要）', '手机', '充电宝', '耳机',
  '离线地图', '交通卡 / 交通 App', '水杯', '纸巾 / 湿巾',
  '相机 / 相机电池', '购物袋', '常用药',
];

const FAMILY_ITEMS = [
  '儿童身份证件', '儿童常用药', '儿童备用衣物', '儿童睡衣', '儿童鞋袜',
  '儿童洗漱用品', '儿童防晒', '儿童雨具', '儿童水杯', '儿童零食',
  '儿童娱乐 / 阅读', '耳机', '充电器 / 数据线', '备用充电宝',
  '湿巾 / 纸巾', '垃圾袋', '小型急救包', '家长证件与订单',
];

const ROAD_TRIP_ITEMS = [
  '驾驶证', '车辆行驶证', '车辆保险 / 救援信息', '车钥匙备用方案',
  '手机支架', '车载充电器', '充电线', '充电宝', '离线地图',
  '纸巾 / 湿巾', '垃圾袋', '水杯', '零食', '保温杯',
  '太阳镜', '防晒', '雨伞 / 雨衣', '小型急救包',
  '常用药', '备用衣物', '拖鞋', '颈枕 / 抱枕', '车载收纳袋',
];

const BUSINESS_ITEMS = [
  '身份证 / 护照', '机票 / 行程单', '酒店订单', '银行卡 / 钱包',
  '手机', '电脑 / 平板', '充电器', '充电宝', '转换插头',
  '耳机', '移动硬盘 / U 盘', '演示文件 / 会议资料', '名片',
  '商务服装', '舒适鞋', '洗漱用品', '护肤品', '常用药',
];

const COLD_WEATHER_ITEMS = [
  '保暖内衣', '毛衣 / 抓绒', '羽绒服 / 厚外套', '保暖裤',
  '厚袜子', '保暖鞋 / 雪地靴', '帽子', '围巾', '手套',
  '防风防水外层', '润唇膏', '保湿霜', '墨镜', '防晒',
  '暖宝宝（如需要）', '防滑鞋套（如需要）', '常用药',
];

const RAINY_TROPICAL_ITEMS = [
  '轻薄速干衣', '速干内衣裤', '凉鞋 / 涉水鞋', '轻薄外套',
  '雨衣 / 雨伞', '防水背包罩', 'Dry Bag / 防水袋', '防水手机袋',
  '防晒', '驱蚊用品', '止痒用品', '速干毛巾', '湿衣袋',
  '水杯', '常用药', '小型急救包', '防潮收纳袋',
];

export const TRAVEL_LIST_TEMPLATES: TravelListTemplate[] = [
  { id:'domestic', name:'Domestic Travel', description:'国内旅行基础清单', items:DOMESTIC_ITEMS },
  { id:'international', name:'International Travel', description:'国际旅行基础清单', items:INTERNATIONAL_ITEMS },
  { id:'general', name:'General Travel', description:'你的个人通用必带清单', items:GENERAL_TRAVEL_ITEMS },
  { id:'daily', name:'Daily Carry', description:'每天随身携带', items:DAILY_ITEMS },
  { id:'medicine', name:'Medicine', description:'药品与基础急救', items:MEDICINE_ITEMS },
  { id:'beach', name:'Beach / Island', description:'海边、海岛、浮潜与水上活动', items:BEACH_ITEMS },
  { id:'hiking', name:'Hiking / Mountain', description:'徒步、爬山、山地活动', items:HIKING_ITEMS },
  { id:'hot-spring', name:'Hot Spring', description:'温泉、泡汤与水疗', items:HOT_SPRING_ITEMS },
  { id:'city', name:'City Break', description:'城市旅行与高步行量行程', items:CITY_ITEMS },
  { id:'family', name:'Family / Kids', description:'带孩子出行', items:FAMILY_ITEMS },
  { id:'road-trip', name:'Road Trip', description:'自驾旅行', items:ROAD_TRIP_ITEMS },
  { id:'business', name:'Business Trip', description:'商务出行', items:BUSINESS_ITEMS },
  { id:'cold-weather', name:'Cold Weather', description:'寒冷天气与冬季旅行', items:COLD_WEATHER_ITEMS },
  { id:'rainy-tropical', name:'Rainy / Tropical', description:'热带、雨季、高湿环境', items:RAINY_TROPICAL_ITEMS },
];

const LIST_ITEM_ALIASES: Array<[string, string]> = [
  ['高倍防晒', '防晒'],
  ['个人常用药', '常用药'],
  ['小型急救包', '急救包'],
];

export const listItemKey = (title: string): string => {
  const compact = title.trim().toLowerCase().replace(/[×x*\d]+/g, '').replace(/[\\/（）()、，,：:·.\s-]+/g, '');
  const alias = LIST_ITEM_ALIASES.find(([from]) => compact === from.replace(/[\\/（）()、，,：:·.\s-]+/g, ''));
  return alias ? alias[1].replace(/[\\/（）()、，,：:·.\s-]+/g, '') : compact;
};

export const filterDuplicateListItems = (existingLists: TripList[], titles: string[]): string[] => {
  const seen = new Set(existingLists.flatMap((list) => list.items.map((item) => listItemKey(item.title))));
  const result: string[] = [];
  for (const title of titles) {
    const key = listItemKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }
  return result;
};

const makeList = (tripId: string, name: string, titles: string[], sortOrder: number): TripList => {
  const t = now(); const listId = id();
  return { id:listId, tripId, name, sortOrder, createdAt:t, updatedAt:t, items:titles.map((title,index) => ({ id:id(), listId:listId, title, completed:false, sortOrder:index, createdAt:t, updatedAt:t })) };
};

export const isDomesticTrip = (trip: Trip): boolean => {
  const countries = trip.segments.flatMap(segment => segment.destinations.map(destination => destination.country.trim().toLowerCase())).filter(Boolean);
  return countries.length === 0 || countries.every(country => ['china','中国','cn'].includes(country));
};

export const createDefaultTripLists = (trip: Trip): TripList[] => {
  const domestic = isDomesticTrip(trip);
  const generalList = makeList(trip.id, 'General Travel', GENERAL_TRAVEL_ITEMS, 1);
  const baseList = makeList(
    trip.id,
    domestic ? 'Domestic Travel' : 'International Travel',
    filterDuplicateListItems([generalList], domestic ? DOMESTIC_ITEMS : INTERNATIONAL_ITEMS),
    0,
  );
  const medicineList = makeList(
    trip.id,
    'Medicine',
    filterDuplicateListItems([generalList, baseList], MEDICINE_ITEMS),
    2,
  );
  return [baseList, generalList, medicineList];
};

export const createListFromTemplate = (tripId: string, template: TravelListTemplate, sortOrder: number, existingLists: TripList[] = []): TripList =>
  makeList(tripId, template.name, filterDuplicateListItems(existingLists, template.items), sortOrder);

const listDedupPriority = (list: TripList): number => {
  const name = list.name.trim().toLowerCase();
  if (name === 'general travel') return 0;
  if (name === 'medicine') return 1;
  return 2;
};

export const dedupeTripLists = (lists: TripList[]): TripList[] => {
  const seen = new Set<string>();
  let changed = false;
  const priorityOrder = lists
    .map((list, index) => ({ list, index, priority: listDedupPriority(list) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  for (const { list } of priorityOrder) {
    const kept = list.items.filter((item) => {
      const key = listItemKey(item.title);
      if (!key || seen.has(key)) { changed = true; return false; }
      seen.add(key);
      return true;
    }).map((item, index) => ({ ...item, sortOrder:index }));
    if (kept.length !== list.items.length) changed = true;
    if (kept.length !== list.items.length) {
      const nextList = { ...list, items:kept, updatedAt:now() };
      const index = lists.findIndex((item) => item.id === list.id);
      lists = lists.map((item, i) => i === index ? nextList : item);
    }
  }

  const next = lists.map((list, index) => list.sortOrder === index ? list : { ...list, sortOrder:index });
  return changed ? next : lists;
};

export const ensureTripLists = (trip: Trip): Trip => {
  const lists = trip.lists?.length ? dedupeTripLists(trip.lists) : createDefaultTripLists(trip);
  return trip.lists === lists ? trip : { ...trip, lists };
};

export const cloneList = (source: TripList, tripId: string, sortOrder: number, existingLists: TripList[] = []): TripList => {
  const t = now(); const listId = id();
  const titles = filterDuplicateListItems(existingLists, source.items.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map((item) => item.title)); return { id:listId, tripId, name:source.name, sortOrder, createdAt:t, updatedAt:t, items:titles.map((title,index)=>({ id:id(), listId, title, completed:false, sortOrder:index, createdAt:t, updatedAt:t })) };
};

export const listStats = (list: TripList) => ({ total:list.items.length, completed:list.items.filter(item=>item.completed).length });
