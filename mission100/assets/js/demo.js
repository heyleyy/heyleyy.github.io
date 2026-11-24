// Simulated data for presentations and for trying the app before keys are connected.
// Clearly flagged in the UI as DEMO. "Clear all data" in Settings removes it.
import { db, uid } from './state.js';
import { today, addDays } from './ui.js';

export function loadDemo() {
  const t = today(), start = addDays(t, -14);
  db.set('rules', { ...db.get('rules', {}), start });
  const P1 = { id: 'p_box', name: '침대밑 수납함 바퀴형 대용량 2P', title: '침대밑 수납함 바퀴형 대용량 2P 이불 옷 정리함', price: 15900, supply: 7400, shipping: 3000, feeRate: 0.108, stock: 340, itemWinner: false, cvr: 0.031, status: 'live', keywords: ['침대밑수납함', '침대밑정리함', '바퀴수납함', '이불수납함'], supplier: { market: 'dome', no: '48210', url: 'https://domeggook.com/48210' }, sellerProductId: 'DEMO-1', vendorItemId: 'DEMO-11', competitorMin: 15400, lastRead: new Date().toISOString(), lastPriceChange: addDays(t, -12) };
  const P2 = { id: 'p_div', name: '서랍 칸막이 정리함 6P 세트', title: '서랍 칸막이 정리함 6P 세트 속옷 양말 정리', price: 9900, supply: 3100, shipping: 2500, feeRate: 0.108, stock: 3, itemWinner: true, cvr: 0.028, status: 'live', keywords: ['서랍칸막이', '양말정리함', '속옷정리함'], supplier: { market: 'supply', no: '48284', url: '' }, sellerProductId: 'DEMO-2', vendorItemId: 'DEMO-21', lastRead: new Date().toISOString() };
  db.set('products', [P1, P2]);

  // orders: ramping from ~1 to ~4.5 a day, 37 in total
  const perDay = [0, 1, 1, 2, 1, 2, 2, 3, 2, 3, 4, 3, 4, 5, 4];
  const orders = []; let n = 0;
  perDay.forEach((c, i) => {
    const d = addDays(start, i);
    for (let k = 0; k < c; k++) {
      const p = n % 4 === 3 ? P2 : P1, age = 14 - i;
      const status = age > 4 ? 'delivered' : age > 2 ? 'shipped' : age > 0 ? 'supplier_ordered' : 'new';
      orders.push({ id: 'ORD' + (202611000 + n), shipmentBoxId: String(800000 + n), productId: p.id, vendorItemId: p.vendorItemId, name: p.name, qty: 1, price: p.price,
        orderedAt: `${d}T${String(9 + (k * 3) % 12).padStart(2, '0')}:1${k}:00`, shipBy: addDays(d, 3), status,
        tracking: status === 'shipped' || status === 'delivered' ? '5' + String(61230000 + n * 77) : '', courier: 'CJGLS',
        steps: { ack: status !== 'new', supplier: status !== 'new', tracking: ['shipped', 'delivered'].includes(status), uploaded: ['shipped', 'delivered'].includes(status) } });
      n++;
    }
  });
  db.set('orders', orders);

  // ad data per day and per keyword
  const adDaily = {};
  perDay.forEach((c, i) => {
    const d = addDays(start, i), adOrders = Math.round(c * 0.6), revenue = adOrders * 15900;
    const spend = Math.round(i < 5 ? 3200 + revenue / 3 : revenue / 4.7 + 300), clicks = Math.round(spend / (i < 5 ? 340 : 104));
    adDaily[d] = { impressions: Math.round(clicks / (0.0103 + i * 0.0004)), clicks, spend, orders: adOrders, revenue };
  });
  db.set('adDaily', adDaily);
  db.set('adKeywords', [
    { keyword: '침대밑수납함', productId: 'p_box', bid: 120, impressions: 6120, clicks: 151, spend: 15704, orders: 6, revenue: 95400, status: 'active' },
    { keyword: '바퀴달린수납함', productId: 'p_box', bid: 110, impressions: 2980, clicks: 64, spend: 6656, orders: 3, revenue: 47700, status: 'active' },
    { keyword: '이불수납함', productId: 'p_box', bid: 100, impressions: 2310, clicks: 41, spend: 4264, orders: 1, revenue: 15900, status: 'active' },
    { keyword: '리빙박스', productId: 'p_box', bid: 100, impressions: 9400, clicks: 24, spend: 2496, orders: 0, revenue: 0, status: 'active' },
    { keyword: '화장품정리함', productId: 'p_div', bid: 100, impressions: 1500, clicks: 9, spend: 936, orders: 0, revenue: 0, status: 'active' },
    { keyword: '서랍칸막이', productId: 'p_div', bid: 100, impressions: 1980, clicks: 38, spend: 3952, orders: 2, revenue: 19800, status: 'active' },
  ]);

  db.set('experiments', [
    { id: uid('e'), productId: 'p_box', hypothesis: 'Long-tail keywords convert better than 리빙박스', action: 'Paused 리빙박스, added 3 long-tail keywords', metric: 'ROAS', before: '64%', after: '474%', start: addDays(t, -12), end: addDays(t, -5), effect: '+410 pts', learning: 'Broad keywords waste budget; keep bids at or below the max bid', status: 'done' },
    { id: uid('e'), productId: 'p_box', hypothesis: 'A lifestyle main image raises CTR', action: 'Thumbnail B (bedroom scene)', metric: 'CTR', before: '1.03%', after: '1.52%', start: addDays(t, -9), end: addDays(t, -2), effect: '+48%', learning: 'Real-room photos beat white background for this category', status: 'done' },
    { id: uid('e'), productId: 'p_div', hypothesis: 'Adding a second product doubles daily orders', action: 'Listed 서랍 칸막이 정리함', metric: 'orders / day', before: '1.4', after: '', start: addDays(t, -6), status: 'running' },
  ]);
  db.set('learnings', [
    { id: uid('l'), text: 'Broad keywords such as 리빙박스 spend budget without orders. Start every product with long-tail keywords only.', at: addDays(t, -5) },
    { id: uid('l'), text: 'Lifestyle thumbnails raised CTR by about half compared with the white-background supplier photo.', at: addDays(t, -2) },
    { id: uid('l'), text: 'Keep every bid at or below max bid = unit profit × CVR (₩113 for the storage box).', at: addDays(t, -5) },
  ]);
  db.set('approvals', [
    { id: uid('a'), kind: 'price_change', title: 'Cut 침대밑 수납함 to ₩15,300 to win the Item Winner', detail: 'Cheapest identical listing is ₩15,400. Price model: about +₩24,000 profit a week.', payload: { productId: 'p_box', oldPrice: 15900, newPrice: 15300 }, expectedProfit: 23968, status: 'pending', source: 'agent', createdAt: new Date().toISOString() },
    { id: uid('a'), kind: 'keyword_change', title: 'Exclude 화장품정리함 for the drawer divider', detail: 'Does not match the product (W5 negative keyword).', payload: { productId: 'p_div', keyword: '화장품정리함', verdict: 'exclude' }, expectedProfit: 900, status: 'pending', source: 'agent', createdAt: new Date().toISOString() },
  ]);
  db.set('posts', [
    { id: uid('post'), channel: 'instagram', caption: '침대 밑 공간, 그냥 두고 계신가요? 바퀴 달린 수납함 하나로 이불 정리 끝.', hashtags: '#침대밑수납 #자취방정리 #이불정리', status: 'posted', scheduledFor: addDays(t, -6), reach: 1240, clicks: 38, orders: 2 },
    { id: uid('post'), channel: 'threads', caption: '자취 3년차가 알려주는 침대 밑 수납 꿀팁 3가지', hashtags: '', status: 'posted', scheduledFor: addDays(t, -3), reach: 860, clicks: 21, orders: 1 },
    { id: uid('post'), channel: 'instagram', caption: '서랍 속 양말 대란, 칸막이 6개로 정리했어요', hashtags: '#서랍정리 #정리템', status: 'draft', scheduledFor: addDays(t, 1), reach: 0, clicks: 0, orders: 0 },
  ]);
  db.set('demo', true);
}
