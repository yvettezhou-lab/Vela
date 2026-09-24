import type { Trip, TripList, ListItem } from '../core/domain';

const now = () => Date.now();
const id = () => crypto.randomUUID();

const DOMESTIC_ITEMS = [
  '身份证 / 证件', '手机', '充电器', '充电宝', '数据线', '钱包 / 银行卡', '现金',
  '换洗衣物', '内衣裤', '袜子', '睡衣', '洗漱用品', '护肤品', '防晒',
  '常用药', '雨伞 / 雨衣', '纸巾 / 湿巾', '耳机', '水杯', '垃圾袋',
];
const INTERNATIONAL_ITEMS = [
  '护照', '签证 / 入境材料', '机票 / 行程单', '旅行保险', '手机', '充电器', '充电宝', '数据线',
  '钱包 / 银行卡', '少量当地现金', '换洗衣物', '内衣裤', '袜子', '睡衣', '洗漱用品',
  '护肤品', '防晒', '常用药', '转换插头', '耳机', '水杯', '行李牌', '备用证件复印件',
];

const makeList = (tripId: string, name: string, titles: string[], sortOrder: number): TripList => {
  const t = now(); const listId = id();
  return { id:listId, tripId, name, sortOrder, createdAt:t, updatedAt:t, items:titles.map((title,index) => ({ id:id(), listId:listId, title, completed:false, sortOrder:index, createdAt:t, updatedAt:t })) };
};

export const isDomesticTrip = (trip: Trip): boolean => {
  const countries = trip.segments.flatMap(segment => segment.destinations.map(destination => destination.country.trim().toLowerCase())).filter(Boolean);
  return countries.length === 0 || countries.every(country => ['china','中国','cn'].includes(country));
};

export const createDefaultTripLists = (trip: Trip): TripList[] => [
  makeList(trip.id, isDomesticTrip(trip) ? 'Domestic Travel' : 'International Travel', isDomesticTrip(trip) ? DOMESTIC_ITEMS : INTERNATIONAL_ITEMS, 0),
];

export const ensureTripLists = (trip: Trip): Trip => trip.lists?.length ? trip : { ...trip, lists:createDefaultTripLists(trip) };

export const cloneList = (source: TripList, tripId: string, sortOrder: number): TripList => {
  const t = now(); const listId = id();
  return { id:listId, tripId, name:source.name, sortOrder, createdAt:t, updatedAt:t, items:source.items.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map((item,index)=>({ id:id(), listId, title:item.title, completed:false, sortOrder:index, ...(item.note ? {note:item.note} : {}), createdAt:t, updatedAt:t })) };
};

export const listStats = (list: TripList) => ({ total:list.items.length, completed:list.items.filter(item=>item.completed).length });
