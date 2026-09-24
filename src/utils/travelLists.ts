import type { Trip, TripList, ListItem } from '../core/domain';

const now = () => Date.now();
const id = () => crypto.randomUUID();

const DOMESTIC_ITEMS = [
  '身份证', '手机', '充电器', '充电宝', '数据线', '银行卡 / 钱包', '少量现金',
  '机票 / 车票', '酒店订单 / 行程单', '换洗衣物', '内衣裤', '袜子', '睡衣',
  '鞋', '洗漱用品', '护肤品', '防晒', '雨伞 / 雨衣', '眼镜 / 隐形眼镜',
  '耳机', '水杯', '纸巾 / 湿巾', '垃圾袋', '常用药', '小型急救包',
];

const INTERNATIONAL_ITEMS = [
  '护照', '签证 / 入境材料', '机票 / 行程单', '酒店订单', '旅行保险',
  '身份证', '手机', '充电器', '充电宝', '数据线', '银行卡 / 钱包', '少量当地现金',
  '换洗衣物', '内衣裤', '袜子', '睡衣', '鞋', '洗漱用品', '护肤品', '防晒',
  '转换插头', '耳机', '水杯', '行李牌', '备用证件复印件', '常用药', '小型急救包',
];

const DAILY_ITEMS = [
  '手机', '钱包 / 银行卡', '身份证 / 护照', '钥匙', '充电宝', '数据线',
  '纸巾', '湿巾', '水杯', '墨镜', '防晒', '雨伞 / 雨衣', '耳机',
];

const MEDICINE_ITEMS = [
  '个人长期用药', '备用药量', '常用外用药', '创可贴', '消毒用品',
  '体温计', '口罩', '药品说明 / 处方', '药品收纳袋',
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
  makeList(trip.id, 'Daily Carry', DAILY_ITEMS, 1),
  makeList(trip.id, 'Medicine', MEDICINE_ITEMS, 2),
];

export const ensureTripLists = (trip: Trip): Trip => trip.lists?.length ? trip : { ...trip, lists:createDefaultTripLists(trip) };

export const cloneList = (source: TripList, tripId: string, sortOrder: number): TripList => {
  const t = now(); const listId = id();
  return { id:listId, tripId, name:source.name, sortOrder, createdAt:t, updatedAt:t, items:source.items.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map((item,index)=>({ id:id(), listId, title:item.title, completed:false, sortOrder:index, ...(item.note ? {note:item.note} : {}), createdAt:t, updatedAt:t })) };
};

export const listStats = (list: TripList) => ({ total:list.items.length, completed:list.items.filter(item=>item.completed).length });
